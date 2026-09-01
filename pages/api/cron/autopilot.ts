// GET /api/cron/autopilot — Railway cron (SSOT via cron.js)
// Follow-up tick for topic autopilot: writes articles whose deep-analysis finished and
// restarts analyses that failed or stalled. Seeding lives in /api/cron/daily.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import { ensureArticlesTables } from '@/src/infrastructure/persistence/schema/ensureArticlesTables';
import { runAutopilotSweep } from '@/src/infrastructure/cron/autopilot';
import { cronSecrets } from '@/src/infrastructure/cron/cronAuth';
import { getErrorMessage } from '@/src/core/shared/errors';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { withCronWatchdog } from '@/src/infrastructure/cron/cronWatchdog';
import { nextjsUrl } from '@/src/infrastructure/config/serviceUrls';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await db.sync();
    await ensureArticlesTables();
    // nextjsUrl() honors APP_BASE_URL/NEXTJS_URL and falls back to the real production
    // HTTPS host in prod runtimes — a bare 'http://localhost:3000' fallback here would
    // send the cron secret in cleartext the moment either env var is unset.
    const baseUrl = nextjsUrl();
    const result = await runAutopilotSweep({ baseUrl, cronSecret: cronSecrets()[0] || '' });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(withCronWatchdog('autopilot', handler));
