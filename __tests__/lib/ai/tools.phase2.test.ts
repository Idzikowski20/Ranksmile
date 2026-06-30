import { makeWorkingDoc } from '../../../lib/ai/workingDoc';
import { buildTools } from '../../../lib/ai/tools';
import { callSidecar } from '../../../lib/sidecar';
import type { ToolCtx } from '../../../lib/ai/types';

// scoreContentClient is unused by the Phase-2 tools but pulled in by buildTools;
// stub it so the registry imports cleanly (mirrors tools.read.test).
jest.mock('../../../lib/seo/scoreContentClient', () => ({
  scoreContent: jest.fn(),
}));

// Sidecar returns a fixture keyed on the request PATH.
jest.mock('../../../lib/sidecar', () => ({
  callSidecar: jest.fn(async (path: string) => {
    if (path === '/ai-visibility') {
      return { prompts_total: 5, prompts_cited: 2, competitor_citations: 1, extractability_score: 60, citations: [] };
    }
    if (path === '/plagiarism') {
      return { available: true, checked: 10, matched: 2, uniqueness: 80, matches: [{ text: 't', url: 'u', title: 'ti', domain: 'd', sources: 1 }] };
    }
    if (path === '/competitor-outlines') {
      return { competitors: [{ title: 'Comp', url: 'http://c', headings: [{ level: 2, text: 'H' }] }] };
    }
    return {};
  }),
}));

// Real computeAiSearchScore runs; only the DB resolver is mocked.
jest.mock('../../../lib/ai/articleMeta', () => ({
  resolveArticleSeoMeta: jest.fn(async () => ({ domain: 'x.com', language: 'pl', targetKeyword: 'seo', competitorDomains: ['c.com'] })),
}));

function ctxFor(html: string, scoreData: any = null): ToolCtx {
  const { $ } = makeWorkingDoc(html);
  return {
    $, keyword: 'seo', articleTitle: 'Title', articleMetaDescription: 'Desc',
    internalArticles: [], scoreData, changelog: [], htmlDirty: false, writeCount: 0, meta: null,
    articleId: 1, cache: {}, pendingAction: null,
  };
}

beforeEach(() => { (callSidecar as jest.Mock).mockClear(); });

it('get_headings_outline returns the H1–H4 hierarchy (no sidecar)', async () => {
  const tools = buildTools(ctxFor('<h1>A</h1><h2>B</h2><p>x</p>'));
  const out: any = await tools.get_headings_outline.execute({}, {} as any);
  expect(out.headings).toEqual([{ level: 1, text: 'A' }, { level: 2, text: 'B' }]);
  expect(out.outline).toContain('A');
  expect(out.outline).toContain('B');
  expect(callSidecar).not.toHaveBeenCalled();
});

it('get_ai_search_score returns a numeric score + citation signals', async () => {
  const tools = buildTools(ctxFor('<h1>A</h1><p>body</p>'));
  const out: any = await tools.get_ai_search_score.execute({}, {} as any);
  expect(typeof out.score).toBe('number');
  expect(out.prompts_cited).toBe(2);
  expect(callSidecar).toHaveBeenCalledWith('/ai-visibility', expect.any(Object), expect.any(Number));
});

it('check_plagiarism returns uniqueness, total matched, and sample matches', async () => {
  const tools = buildTools(ctxFor('<p>some text</p>'));
  const out: any = await tools.check_plagiarism.execute({}, {} as any);
  expect(out.uniqueness).toBe(80);
  expect(out.matched).toBe(2);
  expect(out.sample_matches).toHaveLength(1);
  expect(out.sample_matches[0]).toEqual({ text: 't', domain: 'd', url: 'u' });
});

it('per-run cache: calling get_ai_search_score twice hits the sidecar once', async () => {
  const ctx = ctxFor('<h1>A</h1><p>body</p>');
  const tools = buildTools(ctx);
  await tools.get_ai_search_score.execute({}, {} as any);
  const second: any = await tools.get_ai_search_score.execute({}, {} as any);
  expect(second.prompts_cited).toBe(2);
  expect(callSidecar).toHaveBeenCalledTimes(1);
});

it('fetch_competitor_outline returns PAA instantly when present and no flag (no sidecar)', async () => {
  const tools = buildTools(ctxFor('<p>x</p>', { paa_questions: ['q1', 'q2'] }));
  const out: any = await tools.fetch_competitor_outline.execute({}, {} as any);
  expect(out.paa_questions).toEqual(['q1', 'q2']);
  expect(out.source).toBe('paa');
  expect(callSidecar).not.toHaveBeenCalled();
});

it('fetch_competitor_outline with competitors:true ALSO scrapes outlines', async () => {
  const tools = buildTools(ctxFor('<p>x</p>', { paa_questions: ['q1', 'q2'] }));
  const out: any = await tools.fetch_competitor_outline.execute({ competitors: true }, {} as any);
  expect(callSidecar).toHaveBeenCalledWith('/competitor-outlines', expect.any(Object), expect.any(Number));
  expect(out.competitors).toEqual([{ title: 'Comp', url: 'http://c', headings_outline: 'H' }]);
  expect(out.source).toBe('live_serp+paa');
});

it('fetch_competitor_outline auto-fetches outlines when there is no PAA', async () => {
  const tools = buildTools(ctxFor('<p>x</p>', null));
  await tools.fetch_competitor_outline.execute({}, {} as any);
  expect(callSidecar).toHaveBeenCalledWith('/competitor-outlines', expect.any(Object), expect.any(Number));
});
