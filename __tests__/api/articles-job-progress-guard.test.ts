jest.mock('sequelize', () => ({ Op: { in: 'Op.in' }, QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT' } }));
jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn(), transaction: jest.fn() },
}));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn() }));
jest.mock('../../utils/verifyDomainOwnership', () => ({ verifyDomainOwnershipById: jest.fn() }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/requireOrgPaymentAccess', () => ({
  withOrgPaymentAccess: (handler: import('next').NextApiHandler) => handler,
}));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/articles/job-progress';
import db from '../../database/database';
import verifyUser from '../../utils/verifyUser';
import { assertArticleAccess } from '../../lib/tenancy';
import { verifyDomainOwnershipById } from '../../utils/verifyDomainOwnership';

const mockDbQuery = db.query as jest.MockedFunction<typeof db.query>;
const mockDbTransaction = db.transaction as jest.MockedFunction<typeof db.transaction>;
const mockVerifyUser = verifyUser as jest.MockedFunction<typeof verifyUser>;
const mockAssertArticleAccess = assertArticleAccess as jest.MockedFunction<typeof assertArticleAccess>;
const mockVerifyDomainOwnership = verifyDomainOwnershipById as jest.MockedFunction<typeof verifyDomainOwnershipById>;
const dbResult = (value: unknown) => value as Awaited<ReturnType<typeof db.query>>;

const makeRes = (): NextApiResponse & { statusCode?: number } => {
  const res = {} as NextApiResponse & { statusCode?: number };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.INTERNAL_PIPELINE_TOKEN = 'internal-secret';
  mockVerifyUser.mockResolvedValue('authorized');
});

it('rejects browser-session POST callbacks before mutating a job', async () => {
  const res = makeRes();

  await handler({
    method: 'POST',
    headers: {},
    body: { jobId: 'gen_123_456', status: 'done', result: { article_html: '<p>forged</p>' } },
    query: {},
    cookies: {},
  } as NextApiRequest, res);

  expect(mockVerifyUser).toHaveBeenCalled();
  expect(mockDbQuery).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(401);
});

it('returns 403 when caller cannot access articleId query', async () => {
  mockAssertArticleAccess.mockResolvedValueOnce(false);
  const res = makeRes();

  await handler(
    { method: 'GET', query: { articleId: '999' }, cookies: {}, headers: {} } as NextApiRequest,
    res,
  );

  expect(mockAssertArticleAccess).toHaveBeenCalledWith('user-1', 999);
  expect(res.status).toHaveBeenCalledWith(403);
});

it('denies polling a job for an article the caller cannot reach', async () => {
  mockDbQuery.mockResolvedValueOnce(dbResult([{
    id: 'job_123_456',
    job_type: 'deep_analysis',
    domain_id: null,
    article_id: 123,
    status: 'running',
    current_stage: 'fetch_page',
    stage_progress: null,
    total_progress: null,
    progress_message: 'Starting analysis...',
    updated_at: new Date(),
  }]));
  mockAssertArticleAccess.mockResolvedValueOnce(false);
  const res = makeRes();

  await handler({
    method: 'GET',
    headers: {},
    body: {},
    query: { jobId: 'job_123_456' },
    cookies: {},
  } as NextApiRequest, res);

  expect(mockAssertArticleAccess).toHaveBeenCalledWith('user-1', 123);
  expect(res.status).toHaveBeenCalledWith(403);
});

it('returns the stored job error instead of stale progress for failed jobs', async () => {
  mockDbQuery.mockResolvedValueOnce(dbResult([{
    id: 'job_123_456',
    job_type: 'deep_analysis',
    domain_id: null,
    article_id: 123,
    status: 'failed',
    current_stage: 'scrape_serp',
    stage_progress: null,
    total_progress: null,
    progress_message: 'Scraping competitor 7/10',
    error: 'SERP collection failed',
    updated_at: new Date(),
  }]));
  mockAssertArticleAccess.mockResolvedValueOnce(true);
  const res = makeRes();

  await handler({
    method: 'GET',
    headers: {},
    body: {},
    query: { jobId: 'job_123_456' },
    cookies: {},
  } as NextApiRequest, res);

  expect(mockDbQuery.mock.calls[0]?.[0]).toContain('progress_message, error, updated_at');
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    error: 'SERP collection failed',
    progressMessage: 'SERP collection failed',
  }));
});

it('does not let the article cancellation endpoint cancel a domain setup job', async () => {
  mockDbQuery.mockResolvedValueOnce(dbResult([{
    id: 'domain_123', status: 'running', job_type: 'domain_setup', domain_id: 12, article_id: null,
  }]));
  mockVerifyDomainOwnership.mockResolvedValueOnce(true);
  const res = makeRes();

  await handler({
    method: 'DELETE', headers: {}, body: {}, query: { jobId: 'domain_123' }, cookies: {},
  } as NextApiRequest, res);

  expect(res.status).toHaveBeenCalledWith(409);
  expect(db.transaction).not.toHaveBeenCalled();
});

it('atomically cancels an article job only while it is still running', async () => {
  mockDbQuery
    .mockResolvedValueOnce(dbResult([{
      id: 'gen_123', status: 'running', job_type: 'article_generate', domain_id: null, article_id: 55,
    }]))
    .mockResolvedValueOnce(dbResult([[], { changes: 1 }]))
    .mockResolvedValueOnce(dbResult([[], { changes: 1 }]));
  mockAssertArticleAccess.mockResolvedValueOnce(true);
  mockDbTransaction.mockImplementation(async (callback) => callback({} as never));
  const res = makeRes();

  await handler({
    method: 'DELETE', headers: {}, body: {}, query: { jobId: 'gen_123' }, cookies: {},
  } as NextApiRequest, res);

  expect(mockDbQuery.mock.calls[1]?.[0]).toContain("status IN ('queued', 'running')");
  expect(mockDbQuery.mock.calls[2]?.[1]).toMatchObject({ transaction: expect.anything() });
  expect(res.status).toHaveBeenCalledWith(200);
});

it('recovers a stale finalizing job so polling can stop waiting forever', async () => {
  mockDbQuery
    .mockResolvedValueOnce(dbResult([{
      id: 'gen_finalizing',
      job_type: 'article_generate',
      domain_id: null,
      article_id: 55,
      status: 'finalizing',
      current_stage: null,
      stage_progress: null,
      total_progress: null,
      progress_message: 'Saving article',
      updated_at: new Date(Date.now() - 6 * 60 * 1000),
    }]))
    .mockResolvedValueOnce(dbResult([[], { changes: 1 }]))
    .mockResolvedValueOnce(dbResult([[], { changes: 1 }]));
  mockAssertArticleAccess.mockResolvedValueOnce(true);
  mockDbTransaction.mockImplementation(async (callback) => callback({} as never));
  const res = makeRes();

  await handler({
    method: 'GET', headers: {}, body: {}, query: { jobId: 'gen_finalizing' }, cookies: {},
  } as NextApiRequest, res);

  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    status: 'failed', error: 'finalizing timed out', progressMessage: 'finalizing timed out',
  }));
});
