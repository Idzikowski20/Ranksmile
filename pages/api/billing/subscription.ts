import type { NextApiRequest, NextApiResponse } from 'next';
import { getSubscriptionDetails } from '../../../lib/subscriptionDetails';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUserId } from '../../../utils/getUser';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
