jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h, withOrgAccessPolicy: (h: unknown) => h }));
jest.mock('@/src/infrastructure/config/featureFlags', () => ({
  isRankTrackingUiEnabled: jest.fn().mockReturnValue(true),
  isRankTrackingRunnerEnabled: jest.fn().mockReturnValue(true),
}));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../utils/verifyDomainOwnership', () => ({
  verifyDomainOwnershipBySlug: jest.fn().mockResolvedValue(false),
}));
jest.mock('@/src/infrastructure/persistence/schema/ensureRankTrackingTables', () => ({ ensureRankTrackingTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/src/infrastructure/rankTracking/service', () => ({
  getConfigsForDomain: jest.fn().mockResolvedValue([]),
  getConfig: jest.fn(),
}));
jest.mock('@/src/infrastructure/rankTracking/repository', () => ({
  getActiveRun: jest.fn(),
}));
jest.mock('@/src/infrastructure/rankTracking/snapshotQueries', () => ({
  getKeywordHistory: jest.fn(),
}));

import handler from '../../pages/api/rank-tracking/[slug]/configs';
import latestRunHandler from '../../pages/api/rank-tracking/[slug]/runs/latest';
import historyHandler from '../../pages/api/rank-tracking/[slug]/history/[keywordId]';
import { verifyDomainOwnershipBySlug } from '../../utils/verifyDomainOwnership';
import { getConfig } from '@/src/infrastructure/rankTracking/service';
import { getActiveRun } from '@/src/infrastructure/rankTracking/repository';
import { getKeywordHistory } from '@/src/infrastructure/rankTracking/snapshotQueries';

const makeRes = () => {
  const res: { status: jest.Mock; json: jest.Mock; setHeader: jest.Mock } = {
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  (verifyDomainOwnershipBySlug as jest.Mock).mockResolvedValue(false);
});

it('denies rank-tracking configs for domains the caller cannot access', async () => {
  const res = makeRes();
  await handler({ method: 'GET', query: { slug: 'example-com' }, cookies: {} } as never, res as never);
  expect(res.status).toHaveBeenCalledWith(403);
});

it('does not expose latest run metadata for configs outside the owned domain', async () => {
  (verifyDomainOwnershipBySlug as jest.Mock).mockResolvedValue({ ID: 10 });
  (getConfig as jest.Mock).mockResolvedValue(undefined);
  const res = makeRes();

  await latestRunHandler({ method: 'GET', query: { slug: 'example-com', configId: '77' }, cookies: {} } as never, res as never);

  expect(res.status).toHaveBeenCalledWith(404);
  expect(getActiveRun).not.toHaveBeenCalled();
});

it('scopes keyword history by config id before querying snapshots', async () => {
  (verifyDomainOwnershipBySlug as jest.Mock).mockResolvedValue({ ID: 10 });
  (getConfig as jest.Mock).mockResolvedValue({ id: 7, domain_id: 10 });
  (getKeywordHistory as jest.Mock).mockResolvedValue([]);
  const res = makeRes();

  await historyHandler({
    method: 'GET',
    query: { slug: 'example-com', configId: '7', keywordId: '99' },
    cookies: {},
  } as never, res as never);

  expect(getKeywordHistory).toHaveBeenCalledWith(7, 99, 'desktop', 100);
  expect(res.status).toHaveBeenCalledWith(200);
});