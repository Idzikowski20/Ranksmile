import { enqueueScheduledChecks } from '@/src/infrastructure/rankTracking/service';
import { advanceNextCheck, createRun, getDueConfigs } from '@/src/infrastructure/rankTracking/repository';

jest.mock('@/src/infrastructure/config/featureFlags', () => ({ isRankTrackingRunnerEnabled: () => true }));
jest.mock('@/src/infrastructure/rankTracking/repository', () => ({
  getDueConfigs: jest.fn(),
  getActiveRun: jest.fn(async () => null),
  listKeywords: jest.fn(async () => [{ id: 1 }]),
  createRun: jest.fn(async () => undefined),
  advanceNextCheck: jest.fn(async () => undefined),
}));
jest.mock('@/src/infrastructure/rankTracking/runner', () => ({ processRankCheckChunk: jest.fn() }));
jest.mock('@/src/infrastructure/rankTracking/defaultConfig', () => ({ ensureDefaultConfigForDomain: jest.fn() }));
jest.mock('@/src/infrastructure/rankTracking/results', () => ({ buildRankResultsPage: jest.fn() }));
jest.mock('@/src/infrastructure/rankTracking/analytics', () => ({ buildAnalyticsSummary: jest.fn(), listSummaryChartPoints: jest.fn() }));
const mockForDomain = jest.fn();
jest.mock('@/src/infrastructure/billing/orgAccess', () => ({
  createBillingAccessCheck: () => ({ forDomain: mockForDomain, forOrg: jest.fn() }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (getDueConfigs as jest.Mock).mockResolvedValue([
    { id: 1, domain_id: 9, schedule_interval: 'daily' },
    { id: 2, domain_id: 10, schedule_interval: 'daily' },
  ]);
});

it('only enqueues scheduled checks for orgs with billing access', async () => {
  mockForDomain.mockImplementation(async (domainId: number) => domainId === 9);
  await expect(enqueueScheduledChecks()).resolves.toBe(1);
  expect(createRun).toHaveBeenCalledTimes(1);
  expect(createRun).toHaveBeenCalledWith(1, 'scheduled', 1);
  // The unpaid config keeps its due date, so it runs as soon as the org pays again.
  expect(advanceNextCheck).toHaveBeenCalledTimes(1);
});
