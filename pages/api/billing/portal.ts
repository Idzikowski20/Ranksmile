import type { NextApiRequest, NextApiResponse } from 'next';
import { getOrgBillingState } from '../../../lib/orgBilling';
import { assertCanManage } from '../../../lib/members';
import { getStripe } from '../../../lib/stripe';
import { getAppOrigin } from '../../../lib/appOrigin';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUserId } from '../../../utils/getUser';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { orgId } = await ensureUserTenancy(userId);
  try { await assertCanManage(userId); } catch { return res.status(403).json({ error: 'FORBIDDEN' }); }
  const billing = await getOrgBillingState(orgId);
  if (!billing?.stripeCustomerId) {
    return res.status(400).json({ error: 'No Stripe customer on file' });
  }

  const stripe = getStripe();
  const origin = getAppOrigin(req);
  const portal = await stripe.billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: `${origin}/settings/billing_subscription`,
  });

  return res.status(200).json({ url: portal.url });
}
