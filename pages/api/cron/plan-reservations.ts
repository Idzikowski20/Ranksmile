import type { NextApiRequest, NextApiResponse } from 'next';
import { ensurePlanQuotaTables } from '../../../lib/ensurePlanQuotaTables';
import { sweepExpiredReservations } from '../../../lib/quota';
import { getErrorMessage } from '../../../lib/errors';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await ensurePlanQuotaTables();
    const released = await sweepExpiredReservations(200);
    return res.status(200).json({ ok: true, released });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}
