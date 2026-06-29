import { makeWorkingDoc } from '../../../lib/ai/workingDoc';
import { buildTools } from '../../../lib/ai/tools';
import type { ToolCtx } from '../../../lib/ai/types';

jest.mock('../../../lib/seo/scoreContentClient', () => ({
  scoreContent: jest.fn(async () => ({
    ranking_score: 70,
    ranking_signals: { signals: [
      { name: 'keyword_in_title', score: 20, recommendation: 'add keyword to title' },
      { name: 'word_count', score: 90, recommendation: 'ok' },
    ] },
  })),
}));

function ctxFor(html: string): ToolCtx {
  const { $ } = makeWorkingDoc(html);
  return {
    $, keyword: 'seo', articleTitle: 't', articleMetaDescription: 'd',
    internalArticles: [{ title: 'Guide to SEO', url: '/seo' }, { title: 'Pricing', url: '/pricing' }],
    scoreData: { terms: [
      { term: 'seo', target_count: 4 },
      { term: 'ranking', target_count: 3 },
    ], words_target: 100, words_min: 80, words_max: 120, headings_target: 3, headings_min: 2, headings_max: 5 },
    changelog: [], htmlDirty: false, writeCount: 0, meta: null,
  };
}

it('read_block returns the exact tag/text/html of a sid', async () => {
  const ctx = ctxFor('<h1>Hi</h1><p>Body <b>bold</b></p>');
  const tools = buildTools(ctx);
  const out: any = await tools.read_block.execute({ sid: 1 }, {} as any);
  expect(out.tag).toBe('p');
  expect(out.html).toContain('<b>bold</b>');     // inner
  expect(out.outerHtml).toContain('<p');         // whole block incl. tag
});

it('get_outline returns the current outline', async () => {
  const ctx = ctxFor('<h1>Hi</h1><p>Body</p>');
  const tools = buildTools(ctx);
  const out: any = await tools.get_outline.execute({}, {} as any);
  expect(out.outline).toContain('[sid 0] <h1> Hi');
});

it('get_content_score reports term coverage from current text', async () => {
  const ctx = ctxFor('<h1>SEO SEO</h1><p>seo seo seo seo about ranking</p>');
  const tools = buildTools(ctx);
  const out: any = await tools.get_content_score.execute({}, {} as any);
  expect(out.headings.current).toBe(1);
  const seo = out.terms.find((t: any) => t.term === 'seo');
  expect(seo.current).toBeGreaterThanOrEqual(4);
  expect(seo.status).toBe('ok');
});

it('list_missing_terms returns only under-target terms', async () => {
  const ctx = ctxFor('<p>seo seo seo seo</p>'); // ranking has 0 occurrences
  const tools = buildTools(ctx);
  const out: any = await tools.list_missing_terms.execute({}, {} as any);
  expect(out.missing.map((t: any) => t.term)).toContain('ranking');
  expect(out.missing.map((t: any) => t.term)).not.toContain('seo');
});

it('get_ranking_signals returns weakest signals first', async () => {
  const ctx = ctxFor('<p>hi</p>');
  const tools = buildTools(ctx);
  const out: any = await tools.get_ranking_signals.execute({}, {} as any);
  expect(out.ranking_score).toBe(70);
  expect(out.weakest_signals[0].name).toBe('keyword_in_title');
});

it('list_internal_link_targets filters by query', async () => {
  const ctx = ctxFor('<p>hi</p>');
  const tools = buildTools(ctx);
  const out: any = await tools.list_internal_link_targets.execute({ query: 'seo' }, {} as any);
  expect(out.targets).toEqual([{ title: 'Guide to SEO', url: '/seo' }]);
});
