jest.mock('../../lib/ensureRankTrackingTables', () => ({ ensureRankTrackingTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/featureFlags', () => ({ isRankTrackingRunnerEnabled: jest.fn().mockReturnValue(true) }));
jest.mock('../../lib/rankTracking/service', () => ({ enqueueScheduledChecks: jest.fn().mockResolvedValue(0) }));
jest.mock('../../lib/rankTracking/partitions', () => ({
  ensureSnapshotPartitionsAhead: jest.fn().mockResolvedValue(undefined),
  pruneOldSnapshotPartitions: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../lib/rankTracking/repository', () => ({ reclaimStaleRuns: jest.fn().mockResolvedValue(0) }));

import { ensureRankTrackingTables } from '../../lib/ensureRankTrackingTables';
import rankCronHandler from '../../pages/api/cron/rank-tracking';
import retentionCronHandler from '../../pages/api/cron/rank-snapshots-retention';

const makeRes = () => {
  const res: { status: jest.Mock; json: jest.Mock } = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

const OLD_CRON_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.CRON_SECRET;
});

afterAll(() => {
  if (OLD_CRON_SECRET === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = OLD_CRON_SECRET;
  }
});

it.each([
  ['rank tracking scheduler', rankCronHandler],
  ['rank snapshot retention', retentionCronHandler],
])('rejects %s when CRON_SECRET is unset', async (_name, cronHandler) => {
  const res = makeRes();

  await cronHandler({ headers: { authorization: 'Bearer undefined' } } as never, res as never);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(ensureRankTrackingTables).not.toHaveBeenCalled();
});
