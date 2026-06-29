import { makeWorkingDoc } from '../../../lib/ai/workingDoc';
import { buildTools } from '../../../lib/ai/tools';
import type { ToolCtx } from '../../../lib/ai/types';

jest.mock('../../../lib/seo/scoreContentClient', () => ({ scoreContent: jest.fn() }));
jest.mock('../../../lib/ai/articleMeta', () => ({ resolveArticleSeoMeta: jest.fn() }));

function ctxFor(html: string): ToolCtx {
  const { $ } = makeWorkingDoc(html);
  return {
    $, keyword: 'seo', articleTitle: 'T', articleMetaDescription: 'D',
    internalArticles: [], scoreData: null, changelog: [], htmlDirty: false, writeCount: 0, meta: null,
    articleId: 1, cache: {}, pendingAction: null,
  };
}

it('get_tool_catalog lists every tool with a category and description', async () => {
  const out: any = await buildTools(ctxFor('<p>x</p>')).get_tool_catalog.execute({}, {} as any);
  expect(Array.isArray(out.tools)).toBe(true);
  for (const t of out.tools) {
    expect(typeof t.name).toBe('string');
    expect(typeof t.category).toBe('string');
    expect(typeof t.description).toBe('string');
  }
  const names = out.tools.map((t: any) => t.name);
  expect(names).toEqual(expect.arrayContaining(['get_content_score', 'apply_edit', 'publish_to_wordpress']));
});

it('every advertised catalog tool actually exists in buildTools', () => {
  const tools = buildTools(ctxFor('<p>x</p>')) as Record<string, unknown>;
  const catalogNames = [
    'get_content_score', 'list_missing_terms', 'get_ranking_signals', 'list_internal_link_targets',
    'get_ai_search_score', 'check_plagiarism', 'fetch_competitor_outline', 'get_headings_outline',
    'get_outline', 'read_block', 'apply_edit', 'insert_section', 'set_meta',
    'generate_social_posts', 'apply_readability', 'publish_to_wordpress',
  ];
  for (const name of catalogNames) expect(tools[name]).toBeDefined();
});
