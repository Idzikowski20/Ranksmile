import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureRankTrackingTables } from '@/src/infrastructure/persistence/schema/ensureRankTrackingTables';
import { isRankTrackingRunnerEnabled } from '@/src/infrastructure/config/featureFlags';
import { enqueueScheduledChecks } from '@/src/infrastructure/rankTracking/service';
import { ensureSnapshotPartitionsAhead } from '@/src/infrastructure/rankTracking/partitions';
import { reclaimStaleRuns } from '@/src/infrastructure/rankTracking/repository';
import { getErrorMessage } from '@/src/core/shared/errors';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { withCronWatchdog } from '@/src/infrastructure/cron/cronWatchdog';

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
