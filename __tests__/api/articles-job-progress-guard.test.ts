jest.mock('sequelize', () => ({ Op: { in: 'Op.in' }, QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT' } }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('intruder') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(false) }));
jest.mock('../../database/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn().mockResolvedValue([{
      id: 'job_999_1',
      article_id: 999,
      status: 'running',
      current_stage: 'scrape_serp',
      stage_progress: 10,
      total_progress: 20,
      progress_message: 'working',
      updated_at: new Date().toISOString(),
    }]),
  },
}));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/articles/job-progress';

const makeRes = (): NextApiResponse & { statusCode?: number } => {
  const res = {} as NextApiResponse & { statusCode?: number };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('GET /api/articles/job-progress tenancy', () => {
  it('returns 403 when caller cannot access articleId', async () => {
    const res = makeRes();
    await handler(
      { method: 'GET', query: { articleId: '999' }, cookies: {}, headers: {} } as NextApiRequest,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 403 when caller cannot access job article_id', async () => {
    const res = makeRes();
    await handler(
      { method: 'GET', query: { jobId: 'job_999_1' }, cookies: {}, headers: {} } as NextApiRequest,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
