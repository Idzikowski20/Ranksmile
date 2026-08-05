// GET|POST /api/cron/ccm-compile — refresh stale/missing CCM snapshots (07-runtime Cron)
import type { NextApiRequest, NextApiResponse } from 'next';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { withCronWatchdog } from '../../../lib/cronWatchdog';
import { getErrorMessage } from '../../../lib/errors';
import { runCcmCompileCron } from '../../../lib/intelligence/ccmStaleCron';

export const config = { maxDuration: 120 };

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body =
    req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : {};
  const qLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : NaN;
  const bodyLimit = typeof body.limit === 'number' ? body.limit : NaN;
  const limit = Number.isFinite(bodyLimit)
    ? bodyLimit
    : Number.isFinite(qLimit)
      ? qLimit
      : 20;

  try {
    const result = await runCcmCompileCron({
      limit,
      compiledAt: new Date().toISOString(),
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) || 'ccm_compile_cron_failed' });
  }
}

export default withOrgPaymentAccess(withCronWatchdog('ccm-compile', handler));
