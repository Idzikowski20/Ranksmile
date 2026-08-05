import type { NextApiRequest, NextApiResponse } from 'next';
import { buildBillingSnapshot } from '../../../lib/billing/buildBillingSnapshot';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUserId } from '../../../utils/getUser';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { orgId } = await ensureUserTenancy(userId);
  const snapshot = await buildBillingSnapshot(orgId);

  res.setHeader('ETag', `"${snapshot.etag}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json(snapshot);
}

export default withOrgPaymentAccess(handler);
