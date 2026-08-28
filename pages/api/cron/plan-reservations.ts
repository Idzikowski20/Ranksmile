import type { NextApiRequest, NextApiResponse } from 'next';
import { ensurePlanQuotaTables } from '@/src/infrastructure/persistence/schema/ensurePlanQuotaTables';
import { sweepExpiredReservations } from '@/src/infrastructure/quota/index';
import { getErrorMessage } from '@/src/core/shared/errors';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { withCronWatchdog } from '@/src/infrastructure/cron/cronWatchdog';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensurePlanQuotaTables();
    const released = await sweepExpiredReservations(200);
    return res.status(200).json({ ok: true, released });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(withCronWatchdog('plan-reservations', handler));
