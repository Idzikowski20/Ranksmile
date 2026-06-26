jest.mock('sequelize', () => ({ Op: { in: 'Op.in' } }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('intruder') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(false) }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));

import db from '../../database/database';
import handler from '../../pages/api/articles/accept';

const mockQuery = db.query as jest.Mock;

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

beforeEach(() => mockQuery.mockReset());

it('denies status changes on an article the caller cannot reach', async () => {
  const res = makeRes();
  await handler({ method: 'POST', body: { articleId: '123', action: 'accept' }, cookies: {} } as any, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(mockQuery).not.toHaveBeenCalled();
});
