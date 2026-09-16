// GET /api/cron/automations — Railway cron (SSOT via cron.js)
// Executes due content-calendar events: creates the draft on the scheduled day, kicks the
// article pipeline, and (for `live`) publishes to WordPress once content is ready.
import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureArticlesTables } from '@/src/infrastructure/persistence/schema/ensureArticlesTables';
import { runAutomationsSweep } from '@/src/infrastructure/cron/automationsScheduler';
import { cronSecrets } from '@/src/infrastructure/cron/cronAuth';
import { getErrorMessage } from '@/src/core/shared/errors';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { withCronWatchdog } from '@/src/infrastructure/cron/cronWatchdog';
import { nextjsUrl } from '@/src/infrastructure/config/serviceUrls';
import db from '../../../database/database';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await db.sync();
    await ensureArticlesTables();
    const baseUrl = nextjsUrl();
    const result = await runAutomationsSweep({ baseUrl, cronSecret: cronSecrets()[0] || '' });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(withCronWatchdog('automations', handler));
