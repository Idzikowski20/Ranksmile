import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../utils/getUser';
import { getBootstrap } from '../../../lib/getBootstrap';

/** GET /api/session/bootstrap — thin wrapper around lib/getBootstrap(). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const cookie = typeof req.cookies?.active_workspace === 'string'
    ? req.cookies.active_workspace
    : undefined;

  const bootstrap = await getBootstrap(userId, { activeWorkspaceCookie: cookie });
  return res.status(200).json({ ...bootstrap, userId });
}
