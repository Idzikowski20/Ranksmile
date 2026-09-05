import { assertArticleAccess, ensureUserTenancy } from '@/src/infrastructure/identity/tenancy';
import { getOrgUsage5h } from '@/src/infrastructure/ai/aiTokenUsage';
import { buildArticleContext } from '@/src/infrastructure/articles/articleContext';
import { needsTermEnrichment } from '@/src/infrastructure/articles/articleKeywordDiscovery';
import { getCurrentUserId } from '../../utils/getUser';
import verifyUser from '../../utils/verifyUser';
import handler from '../../pages/api/articles/optimize-sections';

jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({
  withOrgPaymentAccess: (h: unknown) => h,
  withOrgAccessPolicy: (h: unknown) => h,
}));
// Tenancy / auth guards + Precision AO contracts for optimize-sections.
jest.mock('sequelize', () => ({ Op: { in: 'Op.in' } }));
jest.mock('cheerio', () => jest.requireActual('cheerio'));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('@/src/infrastructure/identity/tenancy', () => ({ assertArticleAccess: jest.fn(), ensureUserTenancy: jest.fn() }));
// Opening-policy enforcement rewrites the lead independently of term coverage and
// consumes LLM calls, which breaks this suite's precision-guard assertions. It has
// its own suite (__tests__/lib/wie/openingPolicyEnforce.test.ts) — no-op it here.
// The post-run coverage regrade is an LLM judge pass; the guard test has no model.
jest.mock('@/src/infrastructure/coverage/regradeCoverageSnapshot', () => ({
  regradeCoverageSnapshot: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/src/infrastructure/wie/enforceOpeningPolicy', () => ({
  enforceOpeningPolicy: jest.fn(async (opts: { html: string }) => ({
    html: opts.html, attempted: false, applied: false, usedHeuristic: false, tokens: 0,
  })),
  heuristicProblemFirstInject: jest.fn((html: string) => html),
}));

jest.mock('@/src/infrastructure/articles/articleContext', () => ({
  buildArticleContext: jest.fn(async () => ({
    articleId: 1,
    keyword: 'k',
    scoreData: { terms: [], words_target: 0, words_min: 0, words_max: 0, headings_target: 0, headings_min: 0, headings_max: 0 },
    breakdown: null,
    coverage: {
      schemaVersion: 1,
      judgeVersion: 'v1',
      promptVersion: 'v1',
      model: 'm',
      createdAt: '',
      items: [],
      buckets: [],
      answersMainQuestionEarly: false,
      overall: 0,
    },
    paa: [],
    terms: [],
    competitors: [],
  })),
}));
const recordAiTokens = jest.fn(async (_orgId: number | null | undefined, _tokens: number) => {});
jest.mock('@/src/infrastructure/ai/aiTokenUsage', () => ({
  __esModule: true,
  AI_TOKEN_LIMIT_5H: 500000,
  getOrgUsage5h: jest.fn(async () => ({ used: 0, limit: 500000, resetsAt: 0, over: false })),
  recordAiTokens: (orgId: number | null | undefined, tokens: number) => recordAiTokens(orgId, tokens),
}));

const mockEnrichNlpTermsIfNeeded = jest.fn(async (opts: { terms: { term: string; target_count: number }[] }) => opts.terms);
jest.mock('@/src/infrastructure/articles/articleKeywordDiscovery', () => ({
  __esModule: true,
  needsTermEnrichment: jest.fn(() => false),
  enrichNlpTermsIfNeeded: (opts: { terms: { term: string; target_count: number }[] }) => mockEnrichNlpTermsIfNeeded(opts),
}));

jest.mock('@/src/infrastructure/articles/articleSql', () => ({
  getArticleIdSql: jest.fn(async () => 'id'),
}));

const mockNeedsTermEnrichment = needsTermEnrichment as jest.MockedFunction<typeof needsTermEnrichment>;
const mockBuildArticleContext = buildArticleContext as jest.MockedFunction<typeof buildArticleContext>;
const mockVerifyUser = verifyUser as jest.MockedFunction<typeof verifyUser>;
const mockGetCurrentUserId = getCurrentUserId as jest.MockedFunction<typeof getCurrentUserId>;
const mockAssertArticleAccess = assertArticleAccess as jest.MockedFunction<typeof assertArticleAccess>;
const mockEnsureUserTenancy = ensureUserTenancy as jest.MockedFunction<typeof ensureUserTenancy>;
const mockGetOrgUsage5h = getOrgUsage5h as jest.MockedFunction<typeof getOrgUsage5h>;

const makeRes = () => {
  const res: Record<string, unknown> = {};
  const r = res as {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
    write: jest.Mock;
    end: jest.Mock;
    flushHeaders: jest.Mock;
  };
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  r.setHeader = jest.fn();
  r.write = jest.fn();
  r.end = jest.fn();
  r.flushHeaders = jest.fn();
  return r;
};

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  method: 'POST',
  body: { content: '<h2>x</h2><p>body</p>', articleId: 123 },
  query: {},
  cookies: {},
  // Next always populates headers, and assertCronSecret reads authorization off them —
  // but only once a CRON_SECRET exists, so omitting this passed on a machine with no
  // secret configured and threw on one whose .env.local defines it.
  headers: {},
  on: jest.fn(),
  off: jest.fn(),
  ...overrides,
});

type SseEvent = { event: string; data: Record<string, unknown> };
async function runHandler(bodyOverrides: Record<string, unknown> = {}): Promise<SseEvent[]> {
  const res = makeRes();
  const req = makeReq({ body: { content: '<h2>x</h2><p>body</p>', articleId: 123, ...bodyOverrides } });
  await handler(req as never, res as never);
  const frames: SseEvent[] = [];
  for (const call of res.write.mock.calls as unknown as [string][]) {
    const raw = call[0];
    const m = /^event: (.+)\ndata: (.+)\n\n$/.exec(raw);
    if (m) frames.push({ event: m[1], data: JSON.parse(m[2]) as Record<string, unknown> });
  }
  return frames;
}

/** Long enough section that a small sentence insert passes EditSafetyGate. */
const LONG_SECTION = `<h2>Guide</h2><p>${
  Array(80).fill('helpful guide content about usage and setup details here').join(' ')
}</p>`;

const ctxWithMissingTerm = {
  articleId: 1,
  keyword: 'gizmo',
  scoreData: {
    terms: [{ term: 'gizmo', target_count: 5 }],
    words_target: 0,
    words_min: 0,
    words_max: 0,
    headings_target: 0,
    headings_min: 0,
    headings_max: 0,
  },
  breakdown: null,
  coverage: {
    schemaVersion: 1,
    judgeVersion: 'v1',
    promptVersion: 'v1',
    model: 'm',
    createdAt: '',
    items: [],
    buckets: [],
    answersMainQuestionEarly: false,
    overall: 0,
  },
  paa: [],
  terms: [],
  competitors: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  recordAiTokens.mockClear();
  process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test';
  mockVerifyUser.mockResolvedValue('authorized');
  mockGetCurrentUserId.mockResolvedValue('user-1');
  mockAssertArticleAccess.mockResolvedValue(true);
  mockEnsureUserTenancy.mockResolvedValue({ orgId: 1 } as never);
  mockGetOrgUsage5h.mockResolvedValue({ over: false, used: 0, limit: 500000, resetsAt: 0 } as never);
  (global.fetch as unknown) = jest.fn();
  mockNeedsTermEnrichment.mockReturnValue(false);
  mockEnrichNlpTermsIfNeeded.mockImplementation(async (opts) => opts.terms);
});

it('rejects an unauthenticated caller with 401 before any work', async () => {
  mockVerifyUser.mockResolvedValueOnce('Unauthorized' as never);
  const res = makeRes();
  await handler(makeReq() as never, res as never);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.setHeader).not.toHaveBeenCalled();
});

it('denies optimizing an article the caller cannot reach (403)', async () => {
  mockAssertArticleAccess.mockResolvedValue(false);
  const res = makeRes();
  await handler(makeReq() as never, res as never);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.setHeader).not.toHaveBeenCalled();
});

it('blocks with 429 org_limit when the shared token pool is exhausted, before opening the stream', async () => {
  mockGetOrgUsage5h.mockResolvedValue({ over: true, used: 600000, limit: 500000, resetsAt: 1234 } as never);
  const res = makeRes();
  await handler(makeReq() as never, res as never);
  expect(res.status).toHaveBeenCalledWith(429);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'org_limit', resetsAt: 1234 }));
  expect(res.setHeader).not.toHaveBeenCalled();
});

it('covered content yields no accepted section edit', async () => {
  // V4 planner may still ATTEMPT a quality-driven rewrite (that's by design — it
  // diagnoses section quality, not just term coverage), but with no usable LLM
  // output nothing may be accepted or emitted as a change.
  const events = await runHandler({ content: '<h2>Covered</h2><p>full and complete</p>', articleId: 1 });
  expect(events.filter((e) => e.event === 'section' && e.data.changed === true)).toHaveLength(0);
  expect(events.find((e) => e.event === 'done')?.data.changedCount).toBe(0);
});

it('records tokens when a precision edit is accepted', async () => {
  mockBuildArticleContext.mockResolvedValueOnce(ctxWithMissingTerm as never);

  const edited = LONG_SECTION.replace(
    '</p>',
    ' A short clarification about gizmo usage.</p>',
  );

  (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      usage: { total_tokens: 200 },
      choices: [{ message: { content: edited } }],
    }),
  });

  await runHandler({ content: LONG_SECTION, articleId: 1, maxRounds: 1 });
  expect(recordAiTokens).toHaveBeenCalled();
});

it('rejects unsafe LLM rewrite via EditSafetyGate (no section accept)', async () => {
  mockBuildArticleContext.mockResolvedValueOnce(ctxWithMissingTerm as never);

  // Full rewrite — fails CHANGE_RATIO / PRESERVATION
  const rewrite = `<h2>Guide</h2><p>${Array(80).fill('completely different text about other topics').join(' ')}</p>`;
  (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      usage: { total_tokens: 100 },
      choices: [{ message: { content: rewrite } }],
    }),
  });

  const events = await runHandler({ content: LONG_SECTION, articleId: 1, maxRounds: 1 });
  expect(events.filter((e) => e.event === 'section' && e.data.changed === true)).toHaveLength(0);
  expect(events.find((e) => e.event === 'done')?.data.changedCount).toBe(0);
  expect(events.find((e) => e.event === 'done')?.data.outcome).toBe('no_usable_edit');
}, 20_000); // V4 runs multiple LLM rounds against the unsafe rewrite before giving up

it('done event carries trimmed + ignoredLift + precision strategy', async () => {
  // Explicit strategy — diagnosis routes structurally-weak content to deep_optimize
  // by design; this test checks the precision passthrough fields.
  const events = await runHandler({ content: '<h2>A</h2><p>aaa</p>', articleId: 1, optimizationStrategy: 'precision' });
  const done = events.find((e) => e.event === 'done');
  expect(done?.data).toHaveProperty('trimmed');
  expect(done?.data).toHaveProperty('ignoredLift');
  expect(done?.data.optimizationStrategy).toBe('precision');
  expect(done?.data.wholeArticle).toBe(false);
});

it('precision prompt asks for a bounded operation (not whole-article rewrite)', async () => {
  mockBuildArticleContext.mockResolvedValueOnce(ctxWithMissingTerm as never);

  (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      usage: { total_tokens: 1 },
      choices: [{ message: { content: LONG_SECTION } }],
    }),
  });

  await runHandler({ content: LONG_SECTION, articleId: 1, maxRounds: 1 });
  expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(0);
  const [, opts] = (global.fetch as jest.Mock).mock.calls[0] as [string, { body: string }];
  const body = JSON.parse(opts.body) as { messages: Array<{ content: string }> };
  // Prompt architecture: system = WIE Writer persona; the per-objective precision
  // contract lives in the user message (WHAT/WHERE/ACTION + word ceiling).
  expect(body.messages[1].content).toMatch(/precision content editor/i);
  expect(body.messages[1].content).toMatch(/ACTION:/);
  expect(body.messages[1].content).toMatch(/MAX NEW WORDS/i);
  expect(body.messages[1].content).not.toMatch(/rewrite the whole article/i);
});

it('accepted precision edit emits section with Precision reason', async () => {
  mockBuildArticleContext.mockResolvedValueOnce(ctxWithMissingTerm as never);

  const edited = LONG_SECTION.replace(
    '</p>',
    ' A short clarification about gizmo usage.</p>',
  );

  (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      usage: { total_tokens: 50 },
      choices: [{ message: { content: edited } }],
    }),
  });

  const events = await runHandler({ content: LONG_SECTION, articleId: 1, maxRounds: 1 });
  const sectionEvts = events.filter((e) => e.event === 'section');
  expect(sectionEvts.some((e) => e.data.changed === true)).toBe(true);
  // Section events now come from the before/after diff (buildArticleSectionDiffEvents):
  // changed events carry an inferred focus + mode; the old per-edit reason string is gone.
  const changed = sectionEvts.find((e) => e.data.changed);
  expect(String(changed?.data.newHtml)).toContain('A short clarification about gizmo usage.');
  expect(changed?.data).toHaveProperty('focus');
}, 20_000);

it('emits a terms SSE event when NLP enrichment grows the term list', async () => {
  const thinTerms = [{ term: 'detektyw', target_count: 2 }, { term: 'warszawa', target_count: 2 }];
  const enrichedTerms = [
    ...thinTerms,
    { term: 'detektyw warszawa', target_count: 3 },
    { term: 'prywatny detektyw', target_count: 2 },
  ];
  mockBuildArticleContext.mockResolvedValueOnce({
    articleId: 1,
    keyword: 'detektyw warszawa',
    scoreData: { terms: thinTerms, words_target: 0, words_min: 0, words_max: 0, headings_target: 0, headings_min: 0, headings_max: 0 },
    breakdown: null,
    coverage: {
      schemaVersion: 1,
      judgeVersion: 'v1',
      promptVersion: 'v1',
      model: 'm',
      createdAt: '',
      items: [],
      buckets: [],
      answersMainQuestionEarly: false,
      overall: 0,
    },
    paa: [],
    terms: [],
    competitors: [],
  } as never);
  mockNeedsTermEnrichment.mockReturnValueOnce(true);
  mockEnrichNlpTermsIfNeeded.mockResolvedValueOnce(enrichedTerms);
  const events = await runHandler({ content: '<h2>A</h2><p>aaa</p>', articleId: 1 });
  const termsEvt = events.find((e) => e.event === 'terms');
  expect(termsEvt?.data.terms).toHaveLength(4);
});

it('restores terms from article_terms instead of shrinking score_data', async () => {
  const thinTerms = [
    { term: 'detektyw warszawa', target_count: 4 },
    { term: 'detektyw', target_count: 36 },
    { term: 'warszawa', target_count: 8 },
  ];
  const tableTerms = Array.from({ length: 12 }, (_, i) => ({
    term: `prywatny detektyw usluga ${i + 1}`,
    target_min: 1,
    target_max: 2,
    importance: 1,
    current_count: 0,
    term_type: 'topic',
    source: 'serp',
  }));
  mockBuildArticleContext.mockResolvedValueOnce({
    articleId: 1,
    keyword: 'detektyw warszawa',
    scoreData: { terms: thinTerms, words_target: 0, words_min: 0, words_max: 0, headings_target: 0, headings_min: 0, headings_max: 0 },
    breakdown: null,
    coverage: {
      schemaVersion: 1,
      judgeVersion: 'v1',
      promptVersion: 'v1',
      model: 'm',
      createdAt: '',
      items: [],
      buckets: [],
      answersMainQuestionEarly: false,
      overall: 0,
    },
    paa: [],
    terms: tableTerms,
    competitors: [],
  } as never);
  const events = await runHandler({ content: '<h2>A</h2><p>aaa</p>', articleId: 1 });
  const termsEvt = events.find((e) => e.event === 'terms');
  expect((termsEvt?.data.terms as unknown[]).length).toBeGreaterThanOrEqual(12);
  expect((termsEvt?.data.terms as unknown[]).length).not.toBe(3);
});
