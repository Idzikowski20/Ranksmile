import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../database/database';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import {
  cronRefreshSearchConsoleData,
  getDomainSearchConsoleData,
} from '../../lib/gsc/domainSearchData';
import { withOrgPaymentAccess } from '../../lib/requireOrgPaymentAccess';
import { assertCronSecret } from '../../lib/cronAuth';

/**
 * Legacy alias — same handler as /api/gsc/search-data.
 * Prefer /api/gsc/search-data for new callers.
 */
export const config = {
  api: { responseLimit: '32mb' },
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  if (req.method === 'POST' && assertCronSecret(req)) {
    return cronRefreshSearchConsoleData(req, res);
  }
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }
  const userId = await getCurrentUserId(req, res);
  if (req.method === 'GET') {
    return getDomainSearchConsoleData(req, res, userId);
  }
  if (req.method === 'POST') {
    // Session POST: still full refresh only for cron; users should use gsc APIs
    if (!userId) return res.status(401).json({ error: 'Not authorized' });
    return cronRefreshSearchConsoleData(req, res);
  }
  return res.status(502).json({ error: 'Unrecognized Route.' });
}

export default withOrgPaymentAccess(handler);
