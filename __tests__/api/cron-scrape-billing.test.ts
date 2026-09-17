import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/cron';
import Keyword from '@/database/models/keyword';
import refreshAndUpdateKeywords from '@/utils/refresh';

jest.mock('sequelize', () => ({ Op: { in: 'in' } }));
jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({
  withOrgPaymentAccess: <T>(h: T) => h,
}));
jest.mock('@/src/infrastructure/cron/cronAuth', () => ({ assertCronSecret: () => true }));
jest.mock('@/src/infrastructure/identity/members', () => ({ getCallerRole: jest.fn() }));
jest.mock('@/src/infrastructure/identity/tenancy', () => ({ ensureUserTenancy: jest.fn() }));
jest.mock('@/utils/verifyUser', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/utils/getUser', () => ({ getCurrentUserId: jest.fn() }));
jest.mock('@/utils/refresh', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/pages/api/settings', () => ({ getAppSettings: jest.fn(async () => ({ scraper_type: 'serpapi' })) }));
jest.mock('@/database/database', () => ({ __esModule: true, default: { sync: jest.fn() } }));
jest.mock('@/database/models/keyword', () => ({
  __esModule: true,
  default: { update: jest.fn(), findAll: jest.fn(async () => []) },
}));
jest.mock('@/database/models/domain', () => ({ __esModule: true, default: { findAll: jest.fn(async () => []) } }));
jest.mock('@/src/infrastructure/db/query', () => ({
  queryRows: jest.fn(async () => [
    { domain: 'paid.pl', org_id: 1 },
    { domain: 'expired.pl', org_id: 2 },
    { domain: 'orphan.pl', org_id: null },
  ]),
}));
jest.mock('@/src/infrastructure/billing/orgAccess', () => ({
  createBillingAccessCheck: () => ({ forOrg: async (orgId: number | null) => orgId === 1, forDomain: jest.fn() }),
}));

function run() {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return handler({ method: 'POST', headers: {} } as NextApiRequest, res as unknown as NextApiResponse).then(() => res);
}

it('cron scrape only refreshes keywords of orgs with billing access', async () => {
  const res = await run();
  expect(res.status).toHaveBeenCalledWith(200);
  expect(Keyword.update).toHaveBeenCalledWith({ updating: true }, { where: { domain: { in: ['paid.pl'] } } });
  expect(refreshAndUpdateKeywords).toHaveBeenCalled();
});
