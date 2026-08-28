import type { NextApiRequest, NextApiResponse } from 'next';
import { runStarterNudgeCron } from '@/src/infrastructure/email/runStarterNudgeCron';
import { getErrorMessage } from '@/src/core/shared/errors';
import { withOrgPaymentAccess } from '@/src/infrastructure/requireOrgPaymentAccess';
import { withCronWatchdog } from '@/src/infrastructure/cronWatchdog';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await runStarterNudgeCron();
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(withCronWatchdog('starter-nudge', handler));
