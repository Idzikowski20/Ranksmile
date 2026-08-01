import type { NextApiRequest, NextApiResponse } from 'next';
import { ensurePlanQuotaTables } from '../../../lib/ensurePlanQuotaTables';
import { sweepExpiredReservations } from '../../../lib/quota';
import { getErrorMessage } from '../../../lib/errors';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { withCronWatchdog } from '../../../lib/cronWatchdog';

export const config = { maxDuration: 60 };

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
