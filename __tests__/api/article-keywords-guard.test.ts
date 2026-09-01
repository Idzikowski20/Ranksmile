jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h, withOrgAccessPolicy: (h: unknown) => h }));
jest.mock('sequelize', () => ({ Op: { in: 'Op.in' } }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('intruder') }));
jest.mock('@/src/infrastructure/identity/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(false) }));
jest.mock('@/src/infrastructure/persistence/schema/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));

import handler from '../../pages/api/articles/[id]/keywords/index';

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

it('denies access to keywords for an article the caller cannot reach', async () => {
  const res = makeRes();
  await handler({ method: 'GET', query: { id: '123' }, cookies: {} } as any, res);
  expect(res.status).toHaveBeenCalledWith(403);
});