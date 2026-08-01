import type { NextApiRequest, NextApiResponse } from 'next';
import { assertCronSecret } from '../../../lib/cronAuth';
import { latestCronRuns } from '../../../lib/cronWatchdog';
import { getCurrentUserId } from '../../../utils/getUser';
import { getCallerRole } from '../../../lib/members';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { getErrorMessage } from '../../../lib/errors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronOk = assertCronSecret(req);
  if (!cronOk) {
    const userId = await getCurrentUserId(req, res);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const role = await getCallerRole(String(userId)).catch(() => null);
    if (role !== 'owner') return res.status(403).json({ error: 'FORBIDDEN' });
  }

  try {
    const runs = await latestCronRuns();
    return res.status(200).json({ ok: true, runs });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(handler);
