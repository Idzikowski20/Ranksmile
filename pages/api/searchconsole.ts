import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../database/database';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import {
  cronRefreshSearchConsoleData,
  getDomainSearchConsoleData,
} from '../../lib/gsc/domainSearchData';

/**
 * Legacy alias — same handler as /api/gsc/search-data.
 * Prefer /api/gsc/search-data for new callers.
 */
export const config = {
  api: { responseLimit: '32mb' },
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }
  const userId = await getCurrentUserId(req, res);
  if (req.method === 'GET') {
    return getDomainSearchConsoleData(req, res, userId);
  }
  if (req.method === 'POST') {
    return cronRefreshSearchConsoleData(req, res);
  }
  return res.status(502).json({ error: 'Unrecognized Route.' });
}
