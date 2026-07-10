jest.mock('sequelize', () => ({ Op: { in: 'Op.in' }, QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT' } }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('intruder') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(false) }));
// false = domain exists but the caller's workspace can't reach it → 403.
// null = the caller can reach no domain at all → 403 on the no-domainId fallback.
jest.mock('../../utils/verifyDomainOwnership', () => ({
  verifyDomainOwnershipById: jest.fn().mockResolvedValue(false),
  firstAccessibleDomainId: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));
jest.mock('../../lib/contentScore', () => ({ computeContentScore: jest.fn() }));
jest.mock('../../lib/seo/keywordData', () => ({ getAiSearchInfo: jest.fn() }));
jest.mock('../../lib/aiVisibilityStore', () => ({ persistAiVisibilityRun: jest.fn() }));
jest.mock('../../lib/aiSearchScore', () => ({}));
jest.mock('../../lib/sidecar', () => ({ callSidecar: jest.fn(), sidecarBase: jest.fn() }));
jest.mock('../../lib/ssrfGuard', () => ({ assertPublicUrl: jest.fn().mockResolvedValue(new URL('https://safe.example/post')) }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));

import handler from '../../pages/api/articles/deep-analysis';
import db from '../../database/database';
import { assertArticleAccess } from '../../lib/tenancy';
import { sidecarBase } from '../../lib/sidecar';
import { assertPublicUrl } from '../../lib/ssrfGuard';

const mockDbQuery = db.query as jest.MockedFunction<typeof db.query>;
const mockAssertArticleAccess = assertArticleAccess as jest.MockedFunction<typeof assertArticleAccess>;
const mockSidecarBase = sidecarBase as jest.MockedFunction<typeof sidecarBase>;
const mockAssertPublicUrl = assertPublicUrl as jest.MockedFunction<typeof assertPublicUrl>;

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

beforeEach(() => {
  jest.clearAllMocks();
  mockAssertArticleAccess.mockResolvedValue(false);
  mockAssertPublicUrl.mockResolvedValue(new URL('https://safe.example/post'));
});

it('denies re-analyzing an existing article the caller cannot reach', async () => {
  const res = makeRes();
  await handler({ method: 'POST', body: { articleId: 123, url: 'http://victim.example' }, query: {}, cookies: {} } as any, res);
  expect(res.status).toHaveBeenCalledWith(403);
});

it('denies keyword-mode creation under a domain the caller does not own', async () => {
  const res = makeRes();
  await handler({ method: 'POST', body: { keywords: ['x'], domainId: 999 }, query: {}, cookies: {} } as any, res);
  expect(res.status).toHaveBeenCalledWith(403);
});

it('denies URL-mode creation with no domainId when the caller can reach no domain', async () => {
  const res = makeRes();
  await handler({ method: 'POST', body: { url: 'http://victim.example' }, query: {}, cookies: {} } as any, res);
  expect(res.status).toHaveBeenCalledWith(403);
});

it('blocks private deep-analysis URLs before creating a job', async () => {
  mockAssertPublicUrl.mockRejectedValueOnce(new Error('Blocked private address'));
  const res = makeRes();

  await handler({ method: 'POST', body: { articleId: 123, url: 'http://169.254.169.254/latest/meta-data/' }, query: {}, cookies: {} } as any, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(mockDbQuery).not.toHaveBeenCalled();
});

it('preserves existing article content when the sidecar pipeline fails', async () => {
  mockAssertArticleAccess.mockResolvedValueOnce(true);
  mockSidecarBase.mockReturnValue('http://sidecar.test');
  (global.fetch as unknown) = jest.fn().mockResolvedValue({
    ok: false,
    text: async () => 'sidecar exploded',
  });
  mockDbQuery
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce([{ status: 'running', attempts: 1 }])
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce([{ id: 'job_123_current' }])
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined);

  const res = makeRes();
  await handler({ method: 'POST', body: { articleId: 123, url: 'http://example.com/page' }, query: {}, cookies: {} } as any, res);

  const articleErrorSql = mockDbQuery.mock.calls
    .map(([sql]) => String(sql))
    .find((sql) => sql.includes("UPDATE articles SET status = 'error'"));
  expect(articleErrorSql).toBeDefined();
  expect(articleErrorSql).not.toContain('content');
});

it('does not mark the article error when a failing job was already superseded', async () => {
  mockAssertArticleAccess.mockResolvedValueOnce(true);
  mockSidecarBase.mockReturnValue('http://sidecar.test');
  (global.fetch as unknown) = jest.fn().mockResolvedValue({
    ok: false,
    text: async () => 'late failure',
  });
  mockDbQuery
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce([{ status: 'running', attempts: 1 }])
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce([]);

  const res = makeRes();
  await handler({ method: 'POST', body: { articleId: 123, url: 'http://example.com/page' }, query: {}, cookies: {} } as any, res);

  const articleErrorSql = mockDbQuery.mock.calls
    .map(([sql]) => String(sql))
    .find((sql) => sql.includes("UPDATE articles SET status = 'error'"));
  expect(articleErrorSql).toBeUndefined();
  expect(res.end).toHaveBeenCalled();
});
