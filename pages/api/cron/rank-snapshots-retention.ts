import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureRankTrackingTables } from '../../../lib/ensureRankTrackingTables';
import { pruneOldSnapshotPartitions } from '../../../lib/rankTracking/partitions';
import { getErrorMessage } from '../../../lib/errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await ensureRankTrackingTables();
    const dropped = await pruneOldSnapshotPartitions();
    return res.status(200).json({ ok: true, dropped });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}
