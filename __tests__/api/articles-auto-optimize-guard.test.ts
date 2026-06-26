jest.mock('sequelize', () => ({ Op: { in: 'Op.in' } }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('intruder') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(false) }));
jest.mock('cheerio', () => ({ load: jest.fn() }));
jest.mock('../../lib/contentScore', () => ({ countOccurrences: jest.fn() }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));
jest.mock('../../lib/seo/keywordData', () => ({ enrichTerms: jest.fn(), getAiSearchInfo: jest.fn() }));
jest.mock('../../lib/aiVisibilityStore', () => ({ persistAiVisibilityRun: jest.fn() }));
jest.mock('../../lib/seo/signalTactics', () => ({ SIGNAL_TACTICS: {} }));
jest.mock('../../lib/seo/antiHallucinationRules', () => ({ ANTI_HALLUCINATION_RULES: '' }));
jest.mock('../../lib/seo/scoreContentClient', () => ({ scoreContent: jest.fn() }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));

import handler from '../../pages/api/articles/auto-optimize';

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

it('denies auto-optimizing an article the caller cannot reach', async () => {
  const res = makeRes();
  await handler({ method: 'POST', body: { content: '<p>x</p>', articleId: 123 }, query: {}, cookies: {} } as any, res);
  expect(res.status).toHaveBeenCalledWith(403);
});
