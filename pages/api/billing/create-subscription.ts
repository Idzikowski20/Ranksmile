import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import type { BillingPeriod } from '../../../lib/billingPlans';
import { getCheckoutPlan } from '../../../lib/billingPlans';
import { getOrgBillingState } from '../../../lib/orgBilling';
import { getStripe } from '../../../lib/stripe';
import { ensureStripeCustomer } from '../../../lib/stripeCustomer';
import { getStripePriceId, type PlanSlug } from '../../../lib/stripePrices';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUser } from '../../../utils/getUser';
import type Stripe from 'stripe';

const createSubscriptionSchema = z.object({
  planSlug: z.string().min(1),
  billing: z.enum(['monthly', 'yearly']),
  mode: z.enum(['trial', 'upfront']),
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!publishableKey) {
    return res.status(503).json({ error: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured' });
  }

  const user = await getCurrentUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const parsed = createSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
  }

  const { planSlug: rawSlug, billing, mode } = parsed.data;
  const planSlug = rawSlug.trim().toLowerCase();

  const plan = getCheckoutPlan(planSlug);
  if (!plan) return res.status(400).json({ error: 'Unknown plan' });

  const priceId = getStripePriceId(plan.slug as PlanSlug, billing);
  if (!priceId) {
    return res.status(503).json({ error: 'Stripe price is not configured for this plan' });
  }

  const { orgId } = await ensureUserTenancy(user.id);
  const billingState = await getOrgBillingState(orgId);
  const stripe = getStripe();

  const customerId = await ensureStripeCustomer(
    stripe,
    orgId,
    user.email,
    billingState?.stripeCustomerId ?? null,
  );

  const subscription = await stripe.subscriptions.create({
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
    },
    ...(mode === 'trial' ? { trial_period_days: 7 } : {}),
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
  });
}
