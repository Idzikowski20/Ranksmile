jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h, withOrgAccessPolicy: (h: unknown) => h }));
jest.mock('sequelize', () => ({ Op: { in: 'Op.in' } }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('@/src/infrastructure/identity/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(true) }));
jest.mock('@/src/infrastructure/persistence/schema/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn().mockResolvedValue([]), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('@/src/infrastructure/articles/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));
jest.mock('@/src/infrastructure/db/query', () => ({ queryOne: jest.fn(), queryRows: jest.fn().mockResolvedValue([]) }));
jest.mock('@/src/core/intelligence/compileAfterArticleChange', () => ({ compileIfStale: jest.fn().mockResolvedValue({ ok: true }) }));

import handler from '../../pages/api/articles/[id]/index';
import db from '../../database/database';
import { queryOne } from '@/src/infrastructure/db/query';
import { reviewOutlineToHtml } from '@/src/infrastructure/contentPlanner/reviewOutline';

const mockQuery = db.query as jest.Mock;
const mockQueryOne = queryOne as jest.Mock;

const ARTICLE = '<h1>Były pracownik przejmuje klientów</h1><h2>Zasady</h2><p>Były pracownik może konkurować o klientów, ale nie każdą metodą.</p>';
const OUTLINE = reviewOutlineToHtml([
  { level: 1, text: 'Były pracownik przejmuje klientów' },
  { level: 2, text: 'Zasady', instructions: ['Odpowiedz na główne pytanie w dwóch zdaniach.', 'Wyjaśnij, że były pracownik może konkurować.'] },
]);

const makeRes = () => {
  const res: { status: jest.Mock; json: jest.Mock; setHeader: jest.Mock } = {
    status: jest.fn(), json: jest.fn(), setHeader: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

const put = (body: Record<string, unknown>) => handler(
  { method: 'PUT', query: { id: '166' }, cookies: {}, body } as never,
  makeRes() as never,
);

/** The UPDATE articles statement's `content` replacement (second slot). */
const savedContent = () => {
  const call = mockQuery.mock.calls.find(([sql]) => String(sql).includes('UPDATE articles'));
  return (call?.[1] as { replacements: unknown[] }).replacements[1];
};

beforeEach(() => {
  mockQuery.mockClear();
  mockQueryOne.mockReset();
});

/**
 * Article 166: a written article, then an autosave carrying its outline — the plan the
 * editor renders during review — and the article was gone. The server is the layer that
 * makes this impossible whatever client path let the outline reach autosave.
 */
it('keeps a written article when the save carries its outline', async () => {
  mockQueryOne.mockResolvedValue({ content_score: 90, score_data: null, content: ARTICLE });
  const res = makeRes();
  await handler({ method: 'PUT', query: { id: '166' }, cookies: {}, body: { content: OUTLINE, version_type: 'manual_save' } } as never, res as never);

  expect(savedContent()).toBeNull();
  // No version is snapshotted for a body that was refused.
  expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO article_versions'))).toBe(false);
  expect(res.json).toHaveBeenCalledWith({ updated: true, contentKept: true });
});

it('still accepts an outline over an empty draft or over an older outline', async () => {
  mockQueryOne.mockResolvedValue({ content_score: null, score_data: null, content: '' });
  await put({ content: OUTLINE });
  expect(savedContent()).toBe(OUTLINE);

  mockQuery.mockClear();
  mockQueryOne.mockResolvedValue({ content_score: null, score_data: null, content: OUTLINE });
  await put({ content: OUTLINE });
  expect(savedContent()).toBe(OUTLINE);
});

it('accepts an edited article over a written article', async () => {
  mockQueryOne.mockResolvedValue({ content_score: 90, score_data: null, content: ARTICLE });
  const edited = `${ARTICLE}<p>Dopisany akapit.</p>`;
  await put({ content: edited });
  expect(savedContent()).toBe(edited);
});
