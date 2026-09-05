import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getCheckoutPlan } from '@/src/core/domain/billing/plans';
import { cancelDanglingCheckouts } from '@/src/infrastructure/billing/billingActivateTrial';
import { BillingSource, emitBillingEvent } from '@/src/infrastructure/billing/billingAudit';
import { blocksNewPaidCheckout, getLockedCheckoutPlanSlug } from '@/src/core/domain/billing/planLock';
import { assertTrialAllowed } from '@/src/infrastructure/billing/billingTrial';
import { getOrgBillingState, updateOrgBillingState } from '@/src/infrastructure/billing/orgBilling';
import { assertCanManage } from '@/src/infrastructure/identity/members';
import { getStripe } from '@/src/infrastructure/billing/stripe';
import { assertStripeModeOrThrow } from '@/src/infrastructure/billing/stripeMode';
import { ensureStripeCustomer } from '@/src/infrastructure/billing/stripeCustomer';
import { clientSecretFromSubscriptionInvoice } from '@/src/infrastructure/billing/stripeInvoiceClientSecret';
import { getStripePriceId, type PlanSlug } from '@/src/core/domain/billing/prices';
import { ensureUserTenancy } from '@/src/infrastructure/identity/tenancy';
import { isCheckoutAttemptId } from '@/src/infrastructure/billing/checkoutAttemptId';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { getCurrentUser } from '../../../utils/getUser';

const createSubscriptionSchema = z.object({
  planSlug: z.string().min(1),
  billing: z.enum(['monthly', 'yearly']),
  mode: z.enum(['trial', 'upfront']),
  checkoutAttemptId: z.string().min(1),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    assertStripeModeOrThrow();
  } catch (e) {
    return res.status(503).json({ error: e instanceof Error ? e.message : 'Stripe mode misconfigured' });
  }

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!publishableKey) {
    return res.status(503).json({ error: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured' });
  }

  const user = await getCurrentUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const parsed = createSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
  }

  const { planSlug: rawSlug, billing, mode, checkoutAttemptId: rawAttempt } = parsed.data;
  if (!isCheckoutAttemptId(rawAttempt)) {
    return res.status(400).json({ error: 'checkoutAttemptId must be a UUID' });
  }
  const checkoutAttemptId = rawAttempt.trim();
  const planSlug = rawSlug.trim().toLowerCase();

  const plan = getCheckoutPlan(planSlug);
  if (!plan) return res.status(400).json({ error: 'Unknown plan' });

  const priceId = getStripePriceId(plan.slug as PlanSlug, billing);
  if (!priceId) {
    return res.status(503).json({ error: 'Stripe price is not configured for this plan' });
  }

  const { orgId } = await ensureUserTenancy(user.id);
  try { await assertCanManage(user.id); } catch { return res.status(403).json({ error: 'FORBIDDEN' }); }
  const billingState = await getOrgBillingState(orgId);
  const lockedPlanSlug = getLockedCheckoutPlanSlug(billingState);
  if (lockedPlanSlug && lockedPlanSlug === plan.slug) {
    return res.status(409).json({ error: 'You are already on this plan' });
  }
  if (blocksNewPaidCheckout(billingState?.subscriptionStatus)) {
    return res.status(409).json({ error: 'An active Stripe subscription already exists for this organization' });
  }

  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(
    stripe,
    orgId,
    user.email,
    billingState?.stripeCustomerId ?? null,
  );

  await cancelDanglingCheckouts(stripe, customerId);

  // Trial: SetupIntent ONLY — subscription is created after confirmSetup (activate-trial).
  // Creating a Subscription with trial_period_days makes Stripe status=trialing immediately
  // with no card, which previously granted entitlements via webhooks.
  if (mode === 'trial') {
    const trialGate = assertTrialAllowed(plan.slug, billingState);
    if (!trialGate.ok) {
      return res.status(trialGate.status).json({ error: trialGate.error });
    }

    const setupIntent = await stripe.setupIntents.create(
      {
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: {
          org_id: String(orgId),
          user_id: user.id,
          plan_slug: plan.slug,
          billing_period: billing,
          checkout_mode: 'trial',
          checkout_attempt_id: checkoutAttemptId,
        },
      },
      { idempotencyKey: `org-${orgId}-setup-${checkoutAttemptId}` },
    );

    if (!setupIntent.client_secret) {
      return res.status(502).json({ error: 'Could not initialize payment' });
    }

    await emitBillingEvent({
      kind: 'SETUP_INTENT_CREATED',
      source: BillingSource.CHECKOUT,
      reason: 'mode=trial create-subscription',
      decision: 'ALLOW',
      correlationId: checkoutAttemptId,
      orgId,
      actorUserId: user.id,
      setupIntentId: setupIntent.id,
      meta: { planSlug: plan.slug, billing },
    });

    await updateOrgBillingState(orgId, {
      stripeCustomerId: customerId,
      planSlug: null,
      billingPeriod: null,
      subscriptionStatus: null,
      stripeSubscriptionId: null,
      trialEndsAt: null,
      cancelAtPeriodEnd: false,
      lastCheckoutStartedAt: new Date(),
    }, {
      source: BillingSource.CHECKOUT,
      reason: 'mode=trial clear_entitlements_pre_setup',
      correlationId: checkoutAttemptId,
      actorUserId: user.id,
      setupIntentId: setupIntent.id,
    });

    return res.status(200).json({
      clientSecret: setupIntent.client_secret,
      intentType: 'setup' as const,
      setupIntentId: setupIntent.id,
      publishableKey,
      checkoutAttemptId,
    });
  }

  const subscription = await stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      automatic_tax: { enabled: true },
      payment_settings: { save_default_payment_method: 'on_subscription' },
      // Basil+ (stripe-node 22 / API 2025-03-31+): payment_intent removed from Invoice.
      expand: ['latest_invoice.confirmation_secret'],
      metadata: {
        org_id: String(orgId),
        user_id: user.id,
        plan_slug: plan.slug,
        billing_period: billing,
        checkout_mode: mode,
        checkout_attempt_id: checkoutAttemptId,
      },
    },
    { idempotencyKey: `org-${orgId}-checkout-${checkoutAttemptId}` },
  );

  const secret = clientSecretFromSubscriptionInvoice(subscription);
  if (!secret) {
    await stripe.subscriptions.cancel(subscription.id).catch((err) => {
      console.warn('[billing] cancel incomplete without client_secret', subscription.id, err);
    });
    return res.status(502).json({ error: 'Could not initialize payment' });
  }

  await emitBillingEvent({
    kind: 'BILLING_EVENT',
    source: BillingSource.CHECKOUT,
    reason: 'mode=upfront subscription.incomplete_created',
    decision: 'ALLOW',
    correlationId: checkoutAttemptId,
    orgId,
    actorUserId: user.id,
    stripeSubscriptionId: subscription.id,
    newStatus: 'incomplete',
    meta: { planSlug: plan.slug, billing },
  });

  await updateOrgBillingState(orgId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    planSlug: null,
    billingPeriod: null,
    subscriptionStatus: 'incomplete',
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    lastCheckoutStartedAt: new Date(),
  }, {
    source: BillingSource.CHECKOUT,
    reason: 'mode=upfront incomplete',
    correlationId: checkoutAttemptId,
    actorUserId: user.id,
    stripeSubscriptionId: subscription.id,
  });

  return res.status(200).json({
    clientSecret: secret.clientSecret,
    intentType: secret.intentType,
    subscriptionId: subscription.id,
    publishableKey,
    checkoutAttemptId,
  });
}

export default withOrgPaymentAccess(handler);
