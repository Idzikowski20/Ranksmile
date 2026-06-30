// Tenancy / auth guards for the section-by-section Auto-Optimize endpoint.
// Replaces the coverage lost when the legacy auto-optimize guard test was removed in AO-9.
jest.mock('sequelize', () => ({ Op: { in: 'Op.in' } }));
jest.mock('cheerio', () => ({ load: jest.fn() }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn(), ensureUserTenancy: jest.fn() }));
jest.mock('../../lib/aiTokenUsage', () => ({ getOrgUsage5h: jest.fn(), recordAiTokens: jest.fn() }));

import handler from '../../pages/api/articles/optimize-sections';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { assertArticleAccess, ensureUserTenancy } from '../../lib/tenancy';
import { getOrgUsage5h } from '../../lib/aiTokenUsage';

const mockVerifyUser = verifyUser as jest.MockedFunction<typeof verifyUser>;
const mockGetCurrentUserId = getCurrentUserId as jest.MockedFunction<typeof getCurrentUserId>;
const mockAssertArticleAccess = assertArticleAccess as jest.MockedFunction<typeof assertArticleAccess>;
const mockEnsureUserTenancy = ensureUserTenancy as jest.MockedFunction<typeof ensureUserTenancy>;
const mockGetOrgUsage5h = getOrgUsage5h as jest.MockedFunction<typeof getOrgUsage5h>;

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn();
  res.flushHeaders = jest.fn();
  return res;
};

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  method: 'POST',
  body: { content: '<h2>x</h2><p>body</p>', articleId: 123 },
  query: {},
  cookies: {},
  on: jest.fn(),
  off: jest.fn(),
  ...overrides,
}) as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyUser.mockResolvedValue('authorized');
  mockGetCurrentUserId.mockResolvedValue('user-1' as any);
  mockAssertArticleAccess.mockResolvedValue(true);
  mockEnsureUserTenancy.mockResolvedValue({ orgId: 1 } as any);
  mockGetOrgUsage5h.mockResolvedValue({ over: false, used: 0, limit: 500000, resetsAt: 0 } as any);
});

it('rejects an unauthenticated caller with 401 before any work', async () => {
  mockVerifyUser.mockResolvedValueOnce('Unauthorized' as any);
  const res = makeRes();
  await handler(makeReq(), res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.setHeader).not.toHaveBeenCalled(); // never opened the SSE stream
});

it('denies optimizing an article the caller cannot reach (403)', async () => {
  mockAssertArticleAccess.mockResolvedValue(false);
  const res = makeRes();
  await handler(makeReq(), res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.setHeader).not.toHaveBeenCalled();
});

it('blocks with 429 org_limit when the shared token pool is exhausted, before opening the stream', async () => {
  mockGetOrgUsage5h.mockResolvedValue({ over: true, used: 600000, limit: 500000, resetsAt: 1234 } as any);
  const res = makeRes();
  await handler(makeReq(), res);
  expect(res.status).toHaveBeenCalledWith(429);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'org_limit', resetsAt: 1234 }));
  expect(res.setHeader).not.toHaveBeenCalled();
});
