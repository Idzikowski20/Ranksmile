import { makeWorkingDoc } from '../../../lib/ai/workingDoc';
import { buildTools } from '../../../lib/ai/tools';
import { callSidecar } from '../../../lib/sidecar';
import type { ToolCtx } from '../../../lib/ai/types';

jest.mock('../../../lib/seo/scoreContentClient', () => ({ scoreContent: jest.fn() }));
jest.mock('../../../lib/ai/articleMeta', () => ({ resolveArticleSeoMeta: jest.fn() }));

// Sidecar returns a fixture keyed on the request PATH.
jest.mock('../../../lib/sidecar', () => ({
  callSidecar: jest.fn(async (path: string) => {
    if (path === '/social-posts') return { variants: ['post A', 'post B'] };
    if (path === '/ai-readability') {
      return { score: 70, criteria: [{ key: 'k1', met: false, suggestions: ['split long sentence'] }, { key: 'k2', met: true }] };
    }
    if (path === '/apply-ai-readability') return { content: '<h1>R</h1><p>improved</p>' };
    return {};
  }),
}));

function ctxFor(html: string, over: Partial<ToolCtx> = {}): ToolCtx {
  const { $ } = makeWorkingDoc(html);
  return {
    $, keyword: 'seo', articleTitle: 'Title', articleMetaDescription: 'Desc',
    internalArticles: [], scoreData: null, changelog: [], htmlDirty: false, writeCount: 0, meta: null,
    articleId: 1, cache: {}, pendingAction: null,
    ...over,
  };
}

beforeEach(() => { (callSidecar as jest.Mock).mockClear(); });

// ── generate_social_posts (P3-T2) ──────────────────────────────────────────
it('generate_social_posts returns normalized posts from the sidecar variants', async () => {
  const tools = buildTools(ctxFor('<h1>A</h1><p>x</p>'));
  const out: any = await tools.generate_social_posts.execute({}, {} as any);
  expect(out.posts).toEqual(['post A', 'post B']);
  expect(callSidecar).toHaveBeenCalledWith('/social-posts', expect.objectContaining({ keyword: 'seo' }), expect.any(Number));
});

it('generate_social_posts is ok:false when no article id', async () => {
  const tools = buildTools(ctxFor('<p>x</p>', { articleId: null }));
  const out: any = await tools.generate_social_posts.execute({}, {} as any);
  expect(out.ok).toBe(false);
  expect(callSidecar).not.toHaveBeenCalled();
});

// ── apply_readability (P3-T3) ───────────────────────────────────────────────
it('apply_readability chains analyze→apply, stages the rewrite, returns a refreshed outline', async () => {
  const ctx = ctxFor('<h1>R</h1><p>long</p>');
  const tools = buildTools(ctx);
  const out: any = await tools.apply_readability.execute({}, {} as any);
  expect(out.ok).toBe(true);
  expect(callSidecar).toHaveBeenCalledWith('/ai-readability', expect.any(Object), expect.any(Number));
  expect(callSidecar).toHaveBeenCalledWith('/apply-ai-readability', expect.objectContaining({ suggestions: ['split long sentence'] }), expect.any(Number));
  expect(ctx.$.html()).toContain('improved');   // working copy replaced
  expect(ctx.htmlDirty).toBe(true);
  expect(out.outline).toContain('R');            // refreshed outline returned
});

it('apply_readability makes no changes when readability is already strong', async () => {
  (callSidecar as jest.Mock).mockImplementationOnce(async () => ({ score: 95, criteria: [{ key: 'k', met: true }] }));
  const ctx = ctxFor('<h1>R</h1><p>fine</p>');
  const out: any = await buildTools(ctx).apply_readability.execute({}, {} as any);
  expect(out.ok).toBe(true);
  expect(out.applied).toBeUndefined();
  expect(ctx.htmlDirty).toBe(false);
  expect(callSidecar).toHaveBeenCalledTimes(1); // analyze only; no apply
});

// ── publish_to_wordpress (P3-T4) ────────────────────────────────────────────
it('publish_to_wordpress proposes (sets pendingAction) and never calls the sidecar', async () => {
  const ctx = ctxFor('<p>x</p>');
  const out: any = await buildTools(ctx).publish_to_wordpress.execute({}, {} as any);
  expect(out.proposed).toBe(true);
  expect(ctx.pendingAction).toEqual({ type: 'publish_to_wordpress', target: 'wordpress', articleId: 1, title: 'Title', warning: undefined });
  expect(callSidecar).not.toHaveBeenCalled();
});

it('publish_to_wordpress warns when there are unsaved edits (htmlDirty)', async () => {
  const ctx = ctxFor('<p>x</p>', { htmlDirty: true });
  const out: any = await buildTools(ctx).publish_to_wordpress.execute({}, {} as any);
  expect(ctx.pendingAction?.warning).toMatch(/unsaved/i);
  expect(out.summary).toMatch(/save/i);
});

it('publish_to_wordpress is ok:false and leaves pendingAction null without an article id', async () => {
  const ctx = ctxFor('<p>x</p>', { articleId: null });
  const out: any = await buildTools(ctx).publish_to_wordpress.execute({}, {} as any);
  expect(out.ok).toBe(false);
  expect(ctx.pendingAction).toBeNull();
});
