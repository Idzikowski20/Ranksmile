jest.mock('../../lib/featureFlags', () => ({
  isRankTrackingUiEnabled: jest.fn().mockReturnValue(true),
  isRankTrackingRunnerEnabled: jest.fn().mockReturnValue(true),
}));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../utils/verifyDomainOwnership', () => ({
  verifyDomainOwnershipBySlug: jest.fn().mockResolvedValue(false),
}));
jest.mock('../../lib/ensureRankTrackingTables', () => ({ ensureRankTrackingTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/rankTracking/service', () => ({
  getConfigsForDomain: jest.fn().mockResolvedValue([]),
}));

import handler from '../../pages/api/rank-tracking/[slug]/configs';

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

it('denies rank-tracking configs for domains the caller cannot access', async () => {
  const res = makeRes();
  await handler({ method: 'GET', query: { slug: 'example-com' }, cookies: {} } as never, res as never);
  expect(res.status).toHaveBeenCalledWith(403);
});
