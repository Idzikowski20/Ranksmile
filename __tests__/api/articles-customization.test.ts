jest.mock('sequelize', () => ({ Op: { in: 'Op.in' }, QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT' } }));
jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('@/src/infrastructure/identity/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(true) }));
jest.mock('@/src/infrastructure/persistence/schema/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/src/infrastructure/articles/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@/src/infrastructure/competitors/competitorScan', () => ({ getCompetitors: jest.fn() }));
jest.mock('@/src/infrastructure/http/sidecar', () => ({
  isSidecarConfigured: jest.fn().mockReturnValue(true),
  callSidecar: jest.fn(),
}));

import handler from '../../pages/api/articles/[id]/customization';
import db from '../../database/database';
import { getCompetitors } from '@/src/infrastructure/competitors/competitorScan';
import { callSidecar } from '@/src/infrastructure/http/sidecar';

const mockDbQuery = db.query as jest.MockedFunction<typeof db.query>;
const dbResult = (value: unknown) => value as Awaited<ReturnType<typeof db.query>>;

const articleRow = {
  id: 30,
  domain_id: 2,
  target_keyword: 'jestem szantażowany',
  language: 'pl',
  score_data: JSON.stringify({ terms: [{ term: 'stary term', target_count: 2 }], words_target: 800, words_max: 1200 }),
};

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

const call = (body: Record<string, unknown>) => {
  const res = makeRes();
  return handler({ method: 'POST', query: { id: '30' }, body, headers: {}, cookies: {} } as any, res).then(() => res);
};

const lastWrite = () => {
  const writes = mockDbQuery.mock.calls.filter(([sql]) => String(sql).startsWith('UPDATE articles'));
  return JSON.parse((writes[writes.length - 1][1] as { replacements: string[] }).replacements[0]);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDbQuery.mockImplementation((sql: string) => {
    if (String(sql).startsWith('SELECT id, domain_id')) return Promise.resolve(dbResult([articleRow]));
    return Promise.resolve(dbResult([]));
  });
});

it('recalculates structure targets and terms from the selected competitors', async () => {
  (getCompetitors as jest.Mock).mockResolvedValue([
    { url: 'https://a.pl/x', selected: true, wordCount: 1500, headingCount: 14 },
    { url: 'https://b.pl/y', selected: true, wordCount: 2100, headingCount: 18 },
    { url: 'https://c.pl/z', selected: false, wordCount: 300, headingCount: 4 },
  ]);
  (callSidecar as jest.Mock).mockResolvedValue({
    terms: Array.from({ length: 10 }, (_, i) => ({ term: `nowy term ${i}`, target_count: 1 })),
  });

  const res = await call({ recalcCompetitors: true });

  expect(res.status).toHaveBeenCalledWith(200);
  const stored = lastWrite();
  expect(stored.words_target).toBe(1800);
  expect(stored.headings_target).toBe(16);
  expect(stored.terms).toHaveLength(10);
  expect(stored.competitor_count).toBe(2);
  // Only the SELECTED urls reach the term extractor.
  expect((callSidecar as jest.Mock).mock.calls[0][1].urls).toEqual(['https://a.pl/x', 'https://b.pl/y']);
});

it('keeps the old terms when the sidecar recalc fails', async () => {
  (getCompetitors as jest.Mock).mockResolvedValue([
    { url: 'https://a.pl/x', selected: true, wordCount: 1500, headingCount: 14 },
  ]);
  (callSidecar as jest.Mock).mockRejectedValue(new Error('sidecar down'));

  const res = await call({ recalcCompetitors: true });

  expect(res.status).toHaveBeenCalledWith(200);
  expect(lastWrite().terms[0].term).toBe('stary term');
});

it('raises words_max with a structure override so the writer is never punished for hitting it', async () => {
  await call({ structure: { words: 1600 } });
  const stored = lastWrite();
  expect(stored.words_target).toBe(1600);
  expect(stored.words_max).toBeGreaterThanOrEqual(1600 * 1.3);
});

it('adds and removes graded terms', async () => {
  await call({ addTerm: 'szantaż emocjonalny' });
  expect(lastWrite().terms.map((t: { term: string }) => t.term)).toEqual(['szantaż emocjonalny', 'stary term']);

  // Each call reads the stored row afresh (the mock has no cross-call persistence),
  // so removing the only stored term leaves an empty list.
  await call({ removeTerm: 'stary term' });
  expect(lastWrite().terms).toEqual([]);
});
