jest.mock('../../lib/featureFlags', () => ({
  isRankTrackingUiEnabled: jest.fn().mockReturnValue(false),
  isRankTrackingRunnerEnabled: jest.fn().mockReturnValue(false),
}));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../utils/verifyDomainOwnership', () => ({
  verifyDomainOwnershipBySlug: jest.fn().mockResolvedValue({ ID: 42 }),
}));
jest.mock('../../lib/ensureRankTrackingTables', () => ({
  ensureRankTrackingTables: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../lib/organicResearch', () => ({
  loadOrganicDatasetForDomainId: jest.fn().mockResolvedValue({
    ok: true,
    dataset: { domain: 'protektyw.pl', keywords: [], metrics: {}, meta: {}, chart: [], topics: [] },
    gscConnected: false,
  }),
  getOrganicObservations: jest.fn().mockReturnValue([]),
  isOrganicProviderConfigured: jest.fn().mockReturnValue(true),
  exportOrganic: jest.fn(),
  viewOrganicTable: jest.fn(),
}));

import handler from '../../pages/api/rank-tracking/[slug]/organic';
import { isRankTrackingUiEnabled } from '../../lib/featureFlags';
import { loadOrganicDatasetForDomainId } from '../../lib/organicResearch';

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

describe('GET /api/rank-tracking/[slug]/organic', () => {
  it('serves Search Intelligence even when ENABLE_RANK_TRACKING_UI is off', async () => {
    expect(isRankTrackingUiEnabled()).toBe(false);
    const res = makeRes();
    await handler(
      { method: 'GET', query: { slug: 'protektyw-pl' }, cookies: {} } as never,
      res as never,
    );
    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(loadOrganicDatasetForDomainId).toHaveBeenCalledWith(42, 'user-1');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
