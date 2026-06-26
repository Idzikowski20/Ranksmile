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
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));

import handler from '../../pages/api/articles/deep-analysis';

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
