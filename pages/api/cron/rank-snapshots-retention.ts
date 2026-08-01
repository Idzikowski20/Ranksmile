import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureRankTrackingTables } from '../../../lib/ensureRankTrackingTables';
import { pruneOldSnapshotPartitions } from '../../../lib/rankTracking/partitions';
import { getErrorMessage } from '../../../lib/errors';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { withCronWatchdog } from '../../../lib/cronWatchdog';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureRankTrackingTables();
    const dropped = await pruneOldSnapshotPartitions();
    return res.status(200).json({ ok: true, dropped });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(withCronWatchdog('rank-snapshots-retention', handler));
