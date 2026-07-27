import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getCheckoutPlan } from '../../../lib/billingPlans';
import { getOrgBillingState, updateOrgBillingState } from '../../../lib/orgBilling';
import { assertCanManage } from '../../../lib/members';
import { getStripe } from '../../../lib/stripe';
import { assertStripeModeOrThrow } from '../../../lib/stripeMode';
import { ensureStripeCustomer } from '../../../lib/stripeCustomer';
import { getStripePriceId, type PlanSlug } from '../../../lib/stripePrices';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUser } from '../../../utils/getUser';
import { isCheckoutAttemptId } from '../../../lib/checkoutAttemptId';
import type Stripe from 'stripe';

const createSubscriptionSchema = z.object({
  planSlug: z.string().min(1),
  billing: z.enum(['monthly', 'yearly']),
  mode: z.enum(['trial', 'upfront']),
  checkoutAttemptId: z.string().min(1),
});

type CheckoutMode = z.infer<typeof createSubscriptionSchema>['mode'];

function clientSecretFromSubscription(
  subscription: Stripe.Subscription,
  mode: CheckoutMode,
): { clientSecret: string; intentType: 'setup' | 'payment' } | null {
  if (mode === 'trial') {
    const setup = subscription.pending_setup_intent;
    if (setup && typeof setup === 'object' && setup.client_secret) {
      return { clientSecret: setup.client_secret, intentType: 'setup' };
    }
    return null;
  }

  const invoice = subscription.latest_invoice;
  if (invoice && typeof invoice === 'object') {
    const paymentIntent = (invoice as { payment_intent?: { client_secret?: string | null } | string | null }).payment_intent;
    if (paymentIntent && typeof paymentIntent === 'object' && paymentIntent.client_secret) {
      return { clientSecret: paymentIntent.client_secret, intentType: 'payment' };
    }
  }
  return null;
}

function blocksNewPaidCheckout(status: string | null | undefined): boolean {
  return status === 'active'
    || status === 'trialing'
    || status === 'past_due'
    || status === 'unpaid';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  const subscription = await stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['pending_setup_intent', 'latest_invoice.payment_intent'],
      metadata: {
        org_id: String(orgId),
        user_id: user.id,
        plan_slug: plan.slug,
        billing_period: billing,
        checkout_mode: mode,
        checkout_attempt_id: checkoutAttemptId,
      },
      ...(mode === 'trial' ? { trial_period_days: 7 } : {}),
    },
    { idempotencyKey: `org-${orgId}-checkout-${checkoutAttemptId}` },
  );

  // Cancel other incompletes (not this attempt's sub) so Opcja B doesn't leave dangling A.
  try {
    const incompletes = await stripe.subscriptions.list({
      customer: customerId,
      status: 'incomplete',
      limit: 20,
    });
    for (const other of incompletes.data) {
      if (other.id === subscription.id) continue;
      await stripe.subscriptions.cancel(other.id).catch((err) => {
        console.warn('[create-subscription] cancel other incomplete', other.id, err);
      });
    }
  } catch (err) {
    console.warn('[create-subscription] list incompletes', err);
  }

  await updateOrgBillingState(orgId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    planSlug: plan.slug as PlanSlug,
    billingPeriod: billing,
    subscriptionStatus: 'incomplete',
    cancelAtPeriodEnd: false,
    lastCheckoutStartedAt: new Date(),
  });

  const secret = clientSecretFromSubscription(subscription, mode);
  if (!secret) {
    return res.status(502).json({ error: 'Could not initialize payment' });
  }

  return res.status(200).json({
    clientSecret: secret.clientSecret,
    intentType: secret.intentType,
    subscriptionId: subscription.id,
    publishableKey,
    checkoutAttemptId,
  });
}
