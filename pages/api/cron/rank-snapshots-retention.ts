import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureRankTrackingTables } from '@/src/infrastructure/persistence/schema/ensureRankTrackingTables';
import { pruneOldSnapshotPartitions } from '@/src/infrastructure/rankTracking/partitions';
import { getErrorMessage } from '@/src/core/shared/errors';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { withCronWatchdog } from '@/src/infrastructure/cron/cronWatchdog';

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
