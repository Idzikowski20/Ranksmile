jest.mock('sequelize', () => ({ Op: { in: 'Op.in' }, QueryTypes: { INSERT: 'INSERT', SELECT: 'SELECT' } }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(false) }));
jest.mock('../../utils/verifyDomainOwnership', () => ({ verifyDomainOwnershipById: jest.fn().mockResolvedValue(false) }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));
jest.mock('../../lib/db/query', () => ({ queryOne: jest.fn() }));
jest.mock('../../lib/sidecar', () => ({ callSidecar: jest.fn() }));
jest.mock('../../lib/aiBudget', () => ({ resolveOrgId: jest.fn(), orgBudgetBlocked: jest.fn(), recordAiTokens: jest.fn() }));
jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import db from '../../database/database';
import competitorOutlinesHandler from '../../pages/api/articles/competitor-outlines';
import internalLinksHandler from '../../pages/api/articles/suggest-internal-links';
import plagiarismHandler from '../../pages/api/articles/plagiarism';
import publishTargetsHandler from '../../pages/api/articles/publish-targets';
import keywordsHandler from '../../pages/api/articles/[id]/keywords';
import { assertArticleAccess } from '../../lib/tenancy';
import { verifyDomainOwnershipById } from '../../utils/verifyDomainOwnership';
import { queryOne } from '../../lib/db/query';
import { callSidecar } from '../../lib/sidecar';

const mockDbQuery = db.query as jest.MockedFunction<typeof db.query>;
const mockAssertArticleAccess = assertArticleAccess as jest.MockedFunction<typeof assertArticleAccess>;
const mockVerifyDomainOwnershipById = verifyDomainOwnershipById as jest.MockedFunction<typeof verifyDomainOwnershipById>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockCallSidecar = callSidecar as jest.MockedFunction<typeof callSidecar>;
const mockAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;

const makeRes = (): NextApiResponse => {
  const res = {} as NextApiResponse;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAssertArticleAccess.mockResolvedValue(false);
  mockVerifyDomainOwnershipById.mockResolvedValue(false);
});

it('denies plagiarism scans for articles outside the caller workspace before sidecar work', async () => {
  const res = makeRes();

  await plagiarismHandler(
    { method: 'POST', body: { articleId: 123 }, query: {}, cookies: {} } as unknown as NextApiRequest,
    res,
  );

  expect(mockAssertArticleAccess).toHaveBeenCalledWith('user-1', 123);
  expect(mockCallSidecar).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(403);
});

it('denies internal-link cache access for articles outside the caller workspace', async () => {
  const res = makeRes();

  await internalLinksHandler(
    {
      method: 'POST',
      body: {
        articleId: 123,
        content: '<p>body</p>',
        keyword: 'topic',
        articles: [{ id: 1, title: 'Target', url: '/target' }],
      },
      query: {},
      cookies: {},
    } as unknown as NextApiRequest,
    res,
  );

  expect(mockAssertArticleAccess).toHaveBeenCalledWith('user-1', 123);
  expect(mockDbQuery).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(403);
});

it('denies competitor outline cache access for articles outside the caller workspace', async () => {
  const res = makeRes();

  await competitorOutlinesHandler(
    { method: 'POST', body: { articleId: 123, keyword: 'topic' }, query: {}, cookies: {} } as unknown as NextApiRequest,
    res,
  );

  expect(mockAssertArticleAccess).toHaveBeenCalledWith('user-1', 123);
  expect(mockAxiosPost).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(403);
});

it('denies publish target upserts for domains outside the caller workspace', async () => {
  const res = makeRes();

  await publishTargetsHandler(
    {
      method: 'POST',
      body: { domain_id: 99, type: 'wordpress', url: 'https://example.com', api_key: 'secret' },
      query: {},
      cookies: {},
    } as unknown as NextApiRequest,
    res,
  );

  expect(mockVerifyDomainOwnershipById).toHaveBeenCalledWith(99, 'user-1');
  expect(mockDbQuery).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(403);
});

it('denies publish target deletes when the target belongs to an inaccessible domain', async () => {
  mockQueryOne.mockResolvedValueOnce({ domain_id: 99 });
  const res = makeRes();

  await publishTargetsHandler(
    { method: 'DELETE', body: {}, query: { id: '7' }, cookies: {} } as unknown as NextApiRequest,
    res,
  );

  expect(mockVerifyDomainOwnershipById).toHaveBeenCalledWith(99, 'user-1');
  expect(mockDbQuery).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(403);
});

it('scopes article keyword updates to the guarded article id', async () => {
  mockAssertArticleAccess.mockResolvedValueOnce(true);
  const res = makeRes();

  await keywordsHandler(
    {
      method: 'PUT',
      body: { keywordId: 456, is_covered: true, relevance_score: 7 },
      query: { id: '123' },
      cookies: {},
    } as unknown as NextApiRequest,
    res,
  );

  expect(mockDbQuery).toHaveBeenCalledWith(
    expect.stringContaining('WHERE id = ? AND article_id = ?'),
    { replacements: [1, 7, 456, 123] },
  );
  expect(res.status).toHaveBeenCalledWith(200);
});
