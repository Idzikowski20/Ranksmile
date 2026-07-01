// Tenancy / auth guards for the section-by-section Auto-Optimize endpoint.
// Replaces the coverage lost when the legacy auto-optimize guard test was removed in AO-9.
jest.mock('sequelize', () => ({ Op: { in: 'Op.in' } }));
// Real cheerio is required — splitSections/normalizeHtmlForDiff (used by the planner-path
// tests below) are genuine parsing logic, not something to stub. Re-export the actual module.
jest.mock('cheerio', () => jest.requireActual('cheerio'));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn(), ensureUserTenancy: jest.fn() }));

// LOCAL mocks for planner-path tests (skip short-circuit, token accounting, done payload).
// Scoped to this file only — do not touch global jest infra.
// `scoreData.terms` defaults empty (-> every section skips); tests that need a non-skip step
// (routing an under-target NLP term into `secTerms`) override via mockBuildArticleContext.mockResolvedValueOnce.
jest.mock('../../lib/articleContext', () => ({
  buildArticleContext: jest.fn(async () => ({
    articleId: 1, keyword: 'k', scoreData: { terms: [], words_target: 0, words_min: 0, words_max: 0, headings_target: 0, headings_min: 0, headings_max: 0 },
    breakdown: null,
    coverage: { schemaVersion: 1, judgeVersion: 'v1', promptVersion: 'v1', model: 'm', createdAt: '', items: [], buckets: [], answersMainQuestionEarly: false, overall: 0 },
    paa: [], terms: [], competitors: [],
  })),
}));
const recordAiTokens = jest.fn(async (_orgId: number | null | undefined, _tokens: number) => {});
jest.mock('../../lib/aiTokenUsage', () => ({
  __esModule: true,
  AI_TOKEN_LIMIT_5H: 500000,
  getOrgUsage5h: jest.fn(async () => ({ used: 0, limit: 500000, resetsAt: 0, over: false })),
  recordAiTokens: (orgId: number | null | undefined, tokens: number) => recordAiTokens(orgId, tokens),
}));

import handler from '../../pages/api/articles/optimize-sections';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { assertArticleAccess, ensureUserTenancy } from '../../lib/tenancy';
import { getOrgUsage5h } from '../../lib/aiTokenUsage';
import { buildArticleContext } from '../../lib/articleContext';

const mockBuildArticleContext = buildArticleContext as jest.MockedFunction<typeof buildArticleContext>;
const mockVerifyUser = verifyUser as jest.MockedFunction<typeof verifyUser>;
const mockGetCurrentUserId = getCurrentUserId as jest.MockedFunction<typeof getCurrentUserId>;
const mockAssertArticleAccess = assertArticleAccess as jest.MockedFunction<typeof assertArticleAccess>;
const mockEnsureUserTenancy = ensureUserTenancy as jest.MockedFunction<typeof ensureUserTenancy>;
const mockGetOrgUsage5h = getOrgUsage5h as jest.MockedFunction<typeof getOrgUsage5h>;

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

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  method: 'POST',
  body: { content: '<h2>x</h2><p>body</p>', articleId: 123 },
  query: {},
  cookies: {},
  on: jest.fn(),
  off: jest.fn(),
  ...overrides,
}) as any;

/** SSE-capturing harness: runs the handler against a `res.write`-recording mock and
 *  parses the `event: <name>\ndata: <json>\n\n` frames it was given into {event, data} objects. */
type SseEvent = { event: string; data: any };
async function runHandler(bodyOverrides: Record<string, unknown> = {}): Promise<SseEvent[]> {
  const res = makeRes();
  const req = makeReq({ body: { content: '<h2>x</h2><p>body</p>', articleId: 123, ...bodyOverrides } });
  await handler(req, res);
  const frames: SseEvent[] = [];
  for (const call of res.write.mock.calls as unknown as [string][]) {
    const raw = call[0];
    const m = /^event: (.+)\ndata: (.+)\n\n$/.exec(raw);
    if (!m) continue; // skip the leading ":ok\n\n" keepalive comment
    frames.push({ event: m[1], data: JSON.parse(m[2]) });
  }
  return frames;
}

beforeEach(() => {
  jest.clearAllMocks();
  recordAiTokens.mockClear();
  mockVerifyUser.mockResolvedValue('authorized');
  mockGetCurrentUserId.mockResolvedValue('user-1' as any);
  mockAssertArticleAccess.mockResolvedValue(true);
  mockEnsureUserTenancy.mockResolvedValue({ orgId: 1 } as any);
  mockGetOrgUsage5h.mockResolvedValue({ over: false, used: 0, limit: 500000, resetsAt: 0 } as any);
  (global.fetch as unknown) = jest.fn();
});

it('rejects an unauthenticated caller with 401 before any work', async () => {
  mockVerifyUser.mockResolvedValueOnce('Unauthorized' as any);
  const res = makeRes();
  await handler(makeReq(), res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.setHeader).not.toHaveBeenCalled(); // never opened the SSE stream
});

it('denies optimizing an article the caller cannot reach (403)', async () => {
  mockAssertArticleAccess.mockResolvedValue(false);
  const res = makeRes();
  await handler(makeReq(), res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.setHeader).not.toHaveBeenCalled();
});

it('blocks with 429 org_limit when the shared token pool is exhausted, before opening the stream', async () => {
  mockGetOrgUsage5h.mockResolvedValue({ over: true, used: 600000, limit: 500000, resetsAt: 1234 } as any);
  const res = makeRes();
  await handler(makeReq(), res);
  expect(res.status).toHaveBeenCalledWith(429);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'org_limit', resetsAt: 1234 }));
  expect(res.setHeader).not.toHaveBeenCalled();
});

it('skip step emits changed:false and makes NO fetch call', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch');
  // content: one already-covered section, no guidelines, no terms -> planner returns focus:skip
  const events = await runHandler({ content: '<h2>Covered</h2><p>full and complete</p>', articleId: 1 });
  const sectionEvt = events.find((e) => e.event === 'section');
  expect(sectionEvt?.data.changed).toBe(false);
  expect(fetchSpy).not.toHaveBeenCalled();       // zero LLM calls for a skip
});

it('records tokens in finally even if a mid-run step throws', async () => {
  // An under-target NLP term routes BOTH sections to focus:seo-terms (non-skip),
  // so section A's fetch succeeds and section B's fetch exhausts its retries.
  mockBuildArticleContext.mockResolvedValueOnce({
    articleId: 1, keyword: 'k',
    scoreData: { terms: [{ term: 'widget', target_count: 5 }], words_target: 0, words_min: 0, words_max: 0, headings_target: 0, headings_min: 0, headings_max: 0 } as any,
    breakdown: null,
    coverage: { schemaVersion: 1, judgeVersion: 'v1', promptVersion: 'v1', model: 'm', createdAt: '', items: [], buckets: [], answersMainQuestionEarly: false, overall: 0 } as any,
    paa: [], terms: [], competitors: [],
  });
  (global.fetch as jest.Mock) = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ usage: { total_tokens: 200 }, choices: [{ message: { content: '<h2>A</h2><p>edited enough to be usable here</p>' } }] }) })
    .mockRejectedValue(new Error('boom'));       // second section throws all retries
  await runHandler({ content: '<h2>A</h2><p>aaa</p><h2>B</h2><p>bbb</p>', articleId: 1 });
  expect(recordAiTokens).toHaveBeenCalled();      // finally recorded the 200 from section A
});

it('done event carries trimmed + ignoredLift', async () => {
  const events = await runHandler({ content: '<h2>A</h2><p>aaa</p>', articleId: 1 });
  const done = events.find((e) => e.event === 'done');
  expect(done?.data).toHaveProperty('trimmed');
  expect(done?.data).toHaveProperty('ignoredLift');
});

