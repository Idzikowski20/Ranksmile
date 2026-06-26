jest.mock('sequelize', () => ({ Op: { in: 'Op.in' } }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('intruder') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(false) }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/aiSearchScore', () => ({ computeAiSearchScore: jest.fn() }));
jest.mock('../../lib/aiVisibilityStore', () => ({ persistAiVisibilityRun: jest.fn() }));
jest.mock('../../lib/sidecar', () => ({ callSidecar: jest.fn() }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));

import handler from '../../pages/api/articles/ai-visibility';

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn();
  return res;
};

it('denies an ai-visibility run for an article the caller cannot reach', async () => {
  const res = makeRes();
  await handler({ method: 'POST', body: { articleId: 123 }, query: {}, cookies: {} } as any, res);
  expect(res.status).toHaveBeenCalledWith(403);
});
