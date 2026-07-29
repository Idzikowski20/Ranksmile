import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getCheckoutPlan } from '../../../lib/billingPlans';
import {
  assertCanUpgradeSubscription,
  applySubscriptionUpgrade,
  resolveUpgradePriceId,
} from '../../../lib/billingUpgrade';
import { assertCanManage } from '../../../lib/members';
import { getOrgBillingState } from '../../../lib/orgBilling';
import { getStripe } from '../../../lib/stripe';
import { syncSubscriptionToOrg } from '../../../lib/stripeBillingSync';
import { assertStripeModeOrThrow } from '../../../lib/stripeMode';
import type { PlanSlug } from '../../../lib/stripePrices';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUser } from '../../../utils/getUser';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

const schema = z.object({
  planSlug: z.string().min(1),
  billing: z.enum(['monthly', 'yearly']),
  prorationDate: z.number().int().positive().optional(),
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

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
  }

  const planSlug = parsed.data.planSlug.trim().toLowerCase();
  const billing = parsed.data.billing;
  const targetPlan = getCheckoutPlan(planSlug);
  if (!targetPlan) return res.status(400).json({ error: 'Unknown plan' });

  const priceId = resolveUpgradePriceId(planSlug, billing);
  if (!priceId) return res.status(503).json({ error: 'Stripe price is not configured for this plan' });

  const { orgId } = await ensureUserTenancy(user.id);
  try { await assertCanManage(user.id); } catch { return res.status(403).json({ error: 'FORBIDDEN' }); }

  const billingState = await getOrgBillingState(orgId);
  const gate = assertCanUpgradeSubscription(billingState, targetPlan.slug, billing);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error });
  if (!billingState?.stripeSubscriptionId) {
    return res.status(400).json({ error: 'No active Stripe subscription to upgrade' });
  }

  try {
    const stripe = getStripe();
    const { subscription, result } = await applySubscriptionUpgrade(stripe, {
      orgId,
      userId: user.id,
      subscriptionId: billingState.stripeSubscriptionId,
      targetPriceId: priceId,
      targetSlug: targetPlan.slug as PlanSlug,
      targetBilling: billing,
      prorationDate: parsed.data.prorationDate,
    });

    await syncSubscriptionToOrg(orgId, subscription, {
      slug: targetPlan.slug as PlanSlug,
      billing,
    });

    if (result.status === 'requires_payment') {
      return res.status(200).json({
        status: 'requires_payment',
        clientSecret: result.clientSecret,
        intentType: result.intentType,
        subscriptionId: result.subscriptionId,
        publishableKey,
      });
    }

    return res.status(200).json({
      status: 'upgraded',
      subscriptionId: result.subscriptionId,
      publishableKey,
    });
  } catch (err) {
    console.error('[upgrade-subscription]', err);
    return res.status(502).json({
      error: err instanceof Error ? err.message : 'Could not upgrade subscription',
    });
  }
}

export default withOrgPaymentAccess(handler);
