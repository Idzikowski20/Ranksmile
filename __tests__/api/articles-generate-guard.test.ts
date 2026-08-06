jest.mock('sequelize', () => ({ Op: { in: 'Op.in' }, QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT' } }));
jest.mock('../../lib/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h }));
jest.mock('../../lib/cronAuth', () => ({ assertCronSecret: jest.fn().mockReturnValue(false) }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(true) }));
jest.mock('../../lib/aiBudget', () => ({
  resolveOrgId: jest.fn().mockResolvedValue(1),
  orgBudgetBlocked: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));

import handler from '../../pages/api/articles/[id]/generate';
import db from '../../database/database';

const mockDbQuery = db.query as jest.MockedFunction<typeof db.query>;
const dbResult = (value: unknown) => value as Awaited<ReturnType<typeof db.query>>;

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('rejects a second generate request while one is already in-flight', async () => {
  mockDbQuery
    .mockResolvedValueOnce(dbResult([])) // ON CONFLICT claim: someone else already holds the row
    .mockResolvedValueOnce(dbResult([{ id: 'job_123_current' }])); // inflight lookup for the response body

  const res = makeRes();
  await handler(
    { method: 'POST', query: { id: '123' }, body: {}, headers: {}, cookies: {} } as any,
    res,
  );

  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'generation_in_progress', jobId: 'job_123_current' }));
  // Only the claim + inflight lookup — never reaches article/planner queries once the claim is lost.
  expect(mockDbQuery).toHaveBeenCalledTimes(2);
});
