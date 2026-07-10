jest.mock('sequelize', () => ({ Op: { in: 'Op.in' }, QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT' } }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn() }));
jest.mock('../../utils/verifyDomainOwnership', () => ({ verifyDomainOwnershipById: jest.fn() }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/articles/job-progress';
import db from '../../database/database';
import verifyUser from '../../utils/verifyUser';
import { assertArticleAccess } from '../../lib/tenancy';

const mockDbQuery = db.query as jest.MockedFunction<typeof db.query>;
const mockVerifyUser = verifyUser as jest.MockedFunction<typeof verifyUser>;
const mockAssertArticleAccess = assertArticleAccess as jest.MockedFunction<typeof assertArticleAccess>;

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
  mockDbQuery.mockResolvedValueOnce([{
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
  }]);
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
