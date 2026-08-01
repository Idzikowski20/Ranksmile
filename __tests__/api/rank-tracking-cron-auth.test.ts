jest.mock('../../lib/ensureRankTrackingTables', () => ({ ensureRankTrackingTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/featureFlags', () => ({ isRankTrackingRunnerEnabled: jest.fn().mockReturnValue(true) }));
jest.mock('../../lib/rankTracking/service', () => ({ enqueueScheduledChecks: jest.fn().mockResolvedValue(0) }));
jest.mock('../../lib/rankTracking/partitions', () => ({
  ensureSnapshotPartitionsAhead: jest.fn().mockResolvedValue(undefined),
  pruneOldSnapshotPartitions: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../lib/rankTracking/repository', () => ({ reclaimStaleRuns: jest.fn().mockResolvedValue(0) }));
jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn().mockResolvedValue([[], null]), sync: jest.fn() },
}));

import { ensureRankTrackingTables } from '../../lib/ensureRankTrackingTables';
import rankCronHandler from '../../pages/api/cron/rank-tracking';
import retentionCronHandler from '../../pages/api/cron/rank-snapshots-retention';

const makeRes = () => {
  const res: { status: jest.Mock; json: jest.Mock; statusCode?: number } = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockReturnValue(res);
  return res;
};

const OLD = {
  CRON_SECRET: process.env.CRON_SECRET,
  CRON_SECRET_CURRENT: process.env.CRON_SECRET_CURRENT,
  CRON_SECRET_PREVIOUS: process.env.CRON_SECRET_PREVIOUS,
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.CRON_SECRET;
  delete process.env.CRON_SECRET_CURRENT;
  delete process.env.CRON_SECRET_PREVIOUS;
});

afterAll(() => {
  for (const [k, v] of Object.entries(OLD)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
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

it('accepts PREVIOUS secret during rotation', async () => {
  process.env.CRON_SECRET_CURRENT = 'new';
  process.env.CRON_SECRET_PREVIOUS = 'old';
  const res = makeRes();
  await rankCronHandler({ headers: { authorization: 'Bearer old' }, method: 'GET' } as never, res as never);
  expect(res.status).toHaveBeenCalledWith(200);
});
