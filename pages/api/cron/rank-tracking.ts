import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureRankTrackingTables } from '../../../lib/ensureRankTrackingTables';
import { isRankTrackingRunnerEnabled } from '../../../lib/featureFlags';
import { enqueueScheduledChecks } from '../../../lib/rankTracking/service';
import { ensureSnapshotPartitionsAhead } from '../../../lib/rankTracking/partitions';
import { reclaimStaleRuns } from '../../../lib/rankTracking/repository';
import { getErrorMessage } from '../../../lib/errors';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { withCronWatchdog } from '../../../lib/cronWatchdog';

export const config = { maxDuration: 60 };

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isRankTrackingRunnerEnabled()) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  try {
    await ensureRankTrackingTables();
    await ensureSnapshotPartitionsAhead();
    const reclaimed = await reclaimStaleRuns();
    const enqueued = await enqueueScheduledChecks();
    return res.status(200).json({ ok: true, enqueued, reclaimed });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(withCronWatchdog('rank-tracking', handler));
