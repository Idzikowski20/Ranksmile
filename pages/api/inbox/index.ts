import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { ensureUserTenancy, getAccessibleWorkspaceIds } from '../../../lib/tenancy';
import { listInboxForUser } from '../../../lib/notifications/inboxService';
import { syncOptimizationInbox } from '../../../lib/notifications/syncOptimizationInbox';
import { getErrorMessage } from '../../../lib/errors';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const unreadOnly = req.query.unreadOnly === '1' || req.query.unreadOnly === 'true';
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 50;

    const { orgId } = await ensureUserTenancy(userId);
    const accessible = await getAccessibleWorkspaceIds(userId);
    await syncOptimizationInbox(orgId, accessible);

    const result = await listInboxForUser(userId, { unreadOnly, limit });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
  }
}

export default withOrgPaymentAccess(handler);
