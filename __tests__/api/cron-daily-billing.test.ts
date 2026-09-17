import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/cron/daily';
import { createAutopilotDraft } from '@/src/infrastructure/cron/autopilot';
import { fetchDomainSCData } from '@/utils/searchConsole';
import { queryRows } from '@/src/infrastructure/db/query';

jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({
  withOrgPaymentAccess: <T>(h: T) => h,
}));
jest.mock('@/src/infrastructure/cron/cronWatchdog', () => ({
  withCronWatchdog: <T>(_name: string, h: T) => h,
}));
jest.mock('@/database/database', () => ({ __esModule: true, default: { sync: jest.fn(), query: jest.fn(async () => [[]]) } }));
jest.mock('@/database/models/domain', () => ({
  __esModule: true,
  default: { findAll: jest.fn(async () => [{ get: () => ({ ID: 9, domain: 'x.pl' }) }]) },
}));
jest.mock('@/utils/searchConsole', () => ({
  getSearchConsoleApiInfo: jest.fn(async () => ({})),
  hasValidSCAuth: jest.fn(() => true),
  fetchDomainSCData: jest.fn(async () => undefined),
}));
jest.mock('@/src/composition/gsc', () => ({ getWeeklyDrops: jest.fn() }));
jest.mock('@/src/infrastructure/gsc/gscSnapshots', () => ({ captureWeeklySnapshot: jest.fn(), weekStartFor: jest.fn() }));
jest.mock('@/src/infrastructure/gsc/gscDigestEmail', () => ({ buildGscDigest: jest.fn() }));
jest.mock('@/src/infrastructure/persistence/schema/ensureGscSnapshotTables', () => ({ ensureGscSnapshotTables: jest.fn() }));
jest.mock('@/src/infrastructure/email/sendMail', () => ({ sendMail: jest.fn() }));
jest.mock('@/src/infrastructure/wie/gscOutcomeSync', () => ({ syncDueWieOutcomesFromGsc: jest.fn(async () => ({ synced: 0 })) }));
jest.mock('@/src/infrastructure/wie/patternStore', () => ({ persistConfidenceDecay: jest.fn(async () => ({ updated: 0 })) }));
jest.mock('@/src/infrastructure/db/query', () => ({ queryRows: jest.fn() }));
jest.mock('@/src/infrastructure/cron/cronAuth', () => ({ cronSecrets: () => ['s'] }));
jest.mock('@/src/infrastructure/config/serviceUrls', () => ({ nextjsUrl: () => 'http://x' }));
jest.mock('@/src/infrastructure/cron/autopilot', () => ({
  createAutopilotDraft: jest.fn(async () => 1),
  discardAutopilotDraft: jest.fn(),
  triggerAutopilotAnalysis: jest.fn(async () => true),
}));
const mockForDomain = jest.fn();
jest.mock('@/src/infrastructure/billing/orgAccess', () => ({
  createBillingAccessCheck: () => ({ forDomain: mockForDomain, forOrg: jest.fn(async () => false) }),
}));

function run() {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return handler({ method: 'GET' } as NextApiRequest, res as unknown as NextApiResponse).then(() => res);
}

beforeEach(() => {
  jest.clearAllMocks();
  (queryRows as jest.Mock).mockImplementation(async (sql: string) => (
    sql.includes('site_context') ? [{ ID: 9, domain: 'x.pl', topics: '["seo"]' }] : []
  ));
});

it('refreshes GSC and seeds autopilot for an org with billing access', async () => {
  mockForDomain.mockResolvedValue(true);
  const res = await run();
  expect(fetchDomainSCData).toHaveBeenCalled();
  expect(createAutopilotDraft).toHaveBeenCalledWith(9, 'seo');
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ triggered: 1 }));
});

it('skips GSC refresh and autopilot seeding for an org without billing access', async () => {
  mockForDomain.mockResolvedValue(false);
  const res = await run();
  expect(mockForDomain).toHaveBeenCalledWith(9);
  expect(fetchDomainSCData).not.toHaveBeenCalled();
  expect(createAutopilotDraft).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ triggered: 0 }));
});
