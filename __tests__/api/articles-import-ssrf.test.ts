jest.mock('sequelize', () => ({ Op: { in: 'Op.in' }, QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT' } }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { sync: jest.fn().mockResolvedValue(undefined), query: jest.fn() },
}));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/articles/import';

const makeRes = (): NextApiResponse => {
  const res = {} as NextApiResponse;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('POST /api/articles/import SSRF guard', () => {
  it.each([
    'http://127.0.0.1/',
    'http://localhost/secret',
    'http://169.254.169.254/latest/meta-data/',
  ])('blocks private URL %s', async (url) => {
    const res = makeRes();
    await handler(
      { method: 'POST', body: { url }, query: {}, cookies: {} } as NextApiRequest,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
