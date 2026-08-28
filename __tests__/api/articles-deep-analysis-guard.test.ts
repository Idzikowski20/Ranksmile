jest.mock('../../lib/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h, withOrgAccessPolicy: (h: unknown) => h }));
jest.mock('sequelize', () => ({ Op: { in: 'Op.in' }, QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT' } }));
jest.mock('../../lib/cronAuth', () => ({ assertCronSecret: jest.fn().mockReturnValue(false), cronSecrets: () => [] }));
// Locale resolution runs its own DB queries the ordered db.query mock chain below
// doesn't account for; stub it so the chain stays aligned with the job queries.
jest.mock('../../lib/domainLanguage', () => ({
  resolveContentLocale: jest.fn().mockResolvedValue({ languageCode: 'pl', countryCode: 'PL' }),
}));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('intruder') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(false) }));
// false = domain exists but the caller's workspace can't reach it → 403.
// null = the caller can reach no domain at all → 403 on the no-domainId fallback.
jest.mock('../../utils/verifyDomainOwnership', () => ({
  verifyDomainOwnershipById: jest.fn().mockResolvedValue(false),
  firstAccessibleDomainId: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/src/infrastructure/persistence/schema/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/src/infrastructure/articles/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));
jest.mock('../../lib/contentScore', () => ({ computeContentScore: jest.fn() }));
jest.mock('@/src/infrastructure/seo/keywordData', () => ({ getAiSearchInfo: jest.fn() }));
jest.mock('@/src/infrastructure/aiVisibility/aiVisibilityStore', () => ({ persistAiVisibilityRun: jest.fn() }));
jest.mock('@/src/core/domain/aiScore/aiSearchScore', () => ({}));
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
// Sequelize resolves `[rows, metadata]`; call sites destructure `const [rows] = ...`.
// Model that shape so rows land in the right slot (a bare value isn't iterable).
const dbResult = (value: unknown) => [value, {}] as unknown as Awaited<ReturnType<typeof db.query>>;

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
  // Route by SQL, not by call order — the handler's query sequence shifts as it
  // evolves. Calls with `type: QueryTypes.SELECT` get flat rows (Sequelize
  // semantics); everything else gets the [rows, meta] tuple.
  mockDbQuery.mockImplementation((async (sql: unknown, opts?: { type?: string }) => {
    const s = String(sql);
    const rows = s.includes('SELECT status, attempts')
      ? [{ status: 'running', attempts: 1 }]
      : s.includes('FROM analysis_jobs current_job')
        ? [{ id: 'job_123_current' }]
        : [];
    return (opts?.type === 'SELECT' ? rows : [rows, {}]) as never;
  }) as never);

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
    .mockResolvedValueOnce(dbResult(undefined))
    .mockResolvedValueOnce(dbResult(undefined))
    .mockResolvedValueOnce(dbResult(undefined))
    .mockResolvedValueOnce(dbResult(undefined))
    .mockResolvedValueOnce(dbResult([{ status: 'running', attempts: 1 }]))
    .mockResolvedValueOnce(dbResult(undefined))
    .mockResolvedValueOnce(dbResult([]));

  const res = makeRes();
  await handler({ method: 'POST', body: { articleId: 123, url: 'http://example.com/page' }, query: {}, cookies: {} } as any, res);

  const articleErrorSql = mockDbQuery.mock.calls
    .map(([sql]) => String(sql))
    .find((sql) => sql.includes("UPDATE articles SET status = 'error'"));
  expect(articleErrorSql).toBeUndefined();
  expect(res.end).toHaveBeenCalled();
});