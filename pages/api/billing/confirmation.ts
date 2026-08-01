import type { NextApiRequest, NextApiResponse } from 'next';
import { getBillingConfirmation } from '../../../lib/billingConfirmation';
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
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : null;
  const planSlug = typeof req.query.plan === 'string' ? req.query.plan : null;

  const confirmation = await getBillingConfirmation(orgId, { sessionId, planSlug });
  return res.status(200).json({ confirmation });
}

export default withOrgPaymentAccess(handler);
