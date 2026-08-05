import type { NextApiRequest, NextApiResponse } from 'next';
import type { BillingPeriod } from '../../../lib/billingPlans';
import { getCheckoutPlan } from '../../../lib/billingPlans';
import { getLockedCheckoutPlanSlug } from '../../../lib/billingPlanLock';
import { assertTrialAllowed, TRIAL_PERIOD_DAYS } from '../../../lib/billingTrial';
import { getOrgBillingState, hasNonTerminalStripeSubscription } from '../../../lib/orgBilling';
import { assertCanManage } from '../../../lib/members';
import { getStripe } from '../../../lib/stripe';
import { getStripePriceId, type PlanSlug } from '../../../lib/stripePrices';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getAppOrigin } from '../../../lib/appOrigin';
import { getCurrentUser } from '../../../utils/getUser';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

type CheckoutMode = 'trial' | 'upfront';

function isCheckoutMode(value: unknown): value is CheckoutMode {
  return value === 'trial' || value === 'upfront';
}

function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === 'monthly' || value === 'yearly';
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getCurrentUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const planSlug = typeof req.body?.planSlug === 'string' ? req.body.planSlug.trim().toLowerCase() : '';
  const billing = req.body?.billing;
  const mode = req.body?.mode;

  if (!isBillingPeriod(billing)) {
    return res.status(400).json({ error: 'billing must be monthly or yearly' });
  }
  if (!isCheckoutMode(mode)) {
    return res.status(400).json({ error: 'mode must be trial or upfront' });
  }

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
  if (hasNonTerminalStripeSubscription(billingState)) {
    return res.status(409).json({ error: 'An active Stripe subscription already exists for this organization' });
  }
  if (mode === 'trial') {
    const trialGate = assertTrialAllowed(plan.slug, billingState);
    if (!trialGate.ok) {
      return res.status(trialGate.status).json({ error: trialGate.error });
    }
  }
  const origin = getAppOrigin(req);

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing/confirmation/success?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(plan.slug)}&billing=${billing}`,
      cancel_url: `${origin}/billing/checkout/${plan.slug}?billing=${billing}&mode=${mode}`,
      customer: billingState?.stripeCustomerId ?? undefined,
      customer_email: billingState?.stripeCustomerId ? undefined : user.email ?? undefined,
      client_reference_id: String(orgId),
      metadata: {
        org_id: String(orgId),
        user_id: user.id,
        plan_slug: plan.slug,
        billing_period: billing,
        checkout_mode: mode,
      },
      subscription_data: {
        metadata: {
          org_id: String(orgId),
          plan_slug: plan.slug,
          billing_period: billing,
        },
        ...(mode === 'trial' ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      tax_id_collection: { enabled: true },
    },
    { idempotencyKey: `org-${orgId}-checkout-${plan.slug}-${billing}-${mode}` },
  );

  if (!session.url) return res.status(502).json({ error: 'Stripe did not return a checkout URL' });
  return res.status(200).json({ url: session.url });
}

export default withOrgPaymentAccess(handler);
