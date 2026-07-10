import type { NextApiRequest, NextApiResponse } from 'next';
import { getOrgBillingState } from '../../../lib/orgBilling';
import { assertCanManage } from '../../../lib/members';
import { getStripe, isStripeConfigured } from '../../../lib/stripe';
import { syncSubscriptionToOrg } from '../../../lib/stripeBillingSync';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUserId } from '../../../utils/getUser';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { orgId } = await ensureUserTenancy(userId);
  try { await assertCanManage(userId); } catch { return res.status(403).json({ error: 'FORBIDDEN' }); }
  const billing = await getOrgBillingState(orgId);

  if (!billing?.stripeSubscriptionId) {
    return res.status(400).json({ error: 'No active subscription to cancel' });
  }

  const stripe = getStripe();
  const updated = await stripe.subscriptions.update(billing.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
  await syncSubscriptionToOrg(orgId, updated);

  return res.status(200).json({ ok: true, cancelAtPeriodEnd: updated.cancel_at_period_end });
}
