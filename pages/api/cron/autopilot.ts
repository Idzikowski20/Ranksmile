// GET /api/cron/autopilot — Railway cron (SSOT via cron.js)
// Follow-up tick for topic autopilot: writes articles whose deep-analysis finished and
// restarts analyses that failed or stalled. Seeding lives in /api/cron/daily.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { runAutopilotSweep } from '../../../lib/autopilot';
import { cronSecrets } from '../../../lib/cronAuth';
import { getErrorMessage } from '../../../lib/errors';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { withCronWatchdog } from '../../../lib/cronWatchdog';

export const config = { maxDuration: 60 };

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await db.sync();
    await ensureArticlesTables();
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXTJS_URL || 'http://localhost:3000';
    const result = await runAutopilotSweep({ baseUrl, cronSecret: cronSecrets()[0] || '' });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(withCronWatchdog('autopilot', handler));
