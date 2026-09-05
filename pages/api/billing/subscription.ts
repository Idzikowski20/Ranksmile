import type { NextApiRequest, NextApiResponse } from 'next';
import { getSubscriptionDetails } from '@/src/infrastructure/billing/subscriptionDetails';
import { ensureUserTenancy } from '@/src/infrastructure/identity/tenancy';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { getCurrentUserId } from '../../../utils/getUser';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { orgId } = await ensureUserTenancy(userId);
  const subscription = await getSubscriptionDetails(orgId);

  return res.status(200).json({ subscription });
}

export default withOrgPaymentAccess(handler);
