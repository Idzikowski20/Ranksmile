import { makeWorkingDoc } from '../../../lib/ai/workingDoc';
import { buildTools } from '../../../lib/ai/tools';
import type { ToolCtx } from '../../../lib/ai/types';

function ctxFor(html: string): ToolCtx {
  const { $ } = makeWorkingDoc(html);
  return {
    $, keyword: 'seo', articleTitle: 't', articleMetaDescription: 'd',
    internalArticles: [], scoreData: null, changelog: [], htmlDirty: false, writeCount: 0, meta: null,
  };
}

it('apply_edit replace swaps inner content, marks dirty, returns fresh outline', async () => {
  const ctx = ctxFor('<p>old</p>');
  const tools = buildTools(ctx);
  const r: any = await tools.apply_edit.execute({ sid: 0, op: 'replace', html: 'new' }, {} as any);
  expect(r.ok).toBe(true);
  expect(ctx.htmlDirty).toBe(true);
  expect(ctx.writeCount).toBe(1);
  expect(r.outline).toContain('[sid 0] <p> new');
  expect(ctx.$.html()).toContain('>new<');
  expect(ctx.$.html()).not.toContain('>old<');
});

it('apply_edit remove deletes the block', async () => {
  const ctx = ctxFor('<p>a</p><p>b</p>');
  const tools = buildTools(ctx);
  const r: any = await tools.apply_edit.execute({ sid: 0, op: 'remove' }, {} as any);
  expect(r.ok).toBe(true);
  expect(ctx.$('p').length).toBe(1);
  expect(ctx.$.html()).not.toContain('>a<');
});

it('apply_edit sanitizes injected html (drops <script>)', async () => {
  const ctx = ctxFor('<p>a</p>');
  const tools = buildTools(ctx);
  await tools.apply_edit.execute({ sid: 0, op: 'replace', html: 'ok<script>evil()</script>' }, {} as any);
  expect(ctx.$.html()).toContain('ok');
  expect(ctx.$.html()).not.toContain('script');
});

it('apply_edit replace rejects block-level HTML inside a <p> (invalid nesting)', async () => {
  const ctx = ctxFor('<p>old</p>');
  const tools = buildTools(ctx);
  const r: any = await tools.apply_edit.execute({ sid: 0, op: 'replace', html: '<h2>x</h2><p>y</p>' }, {} as any);
  expect(r.ok).toBe(false);
  expect(ctx.htmlDirty).toBe(false);
  expect(ctx.$.html()).toContain('>old<'); // unchanged
});

it('apply_edit append inserts a sibling block after the target', async () => {
  const ctx = ctxFor('<p>a</p>');
  const tools = buildTools(ctx);
  await tools.apply_edit.execute({ sid: 0, op: 'append', html: '<p>b</p>' }, {} as any);
  expect(ctx.$('p').length).toBe(2);
});

it('apply_edit returns ok:false for an unknown sid', async () => {
  const ctx = ctxFor('<p>a</p>');
  const tools = buildTools(ctx);
  const r: any = await tools.apply_edit.execute({ sid: 99, op: 'replace', html: 'x' }, {} as any);
  expect(r.ok).toBe(false);
  expect(ctx.htmlDirty).toBe(false);
});

it('insert_section at end appends a heading + body', async () => {
  const ctx = ctxFor('<p>a</p>');
  const tools = buildTools(ctx);
  const r: any = await tools.insert_section.execute(
    { heading: 'FAQ', html: '<p>q</p>', position: 'end' }, {} as any,
  );
  expect(r.ok).toBe(true);
  expect(ctx.$('h2').first().text()).toBe('FAQ'); // heading carries a reindexed data-sid
  expect(ctx.htmlDirty).toBe(true);
});

it('set_meta stages meta without touching html', async () => {
  const ctx = ctxFor('<p>a</p>');
  const tools = buildTools(ctx);
  const r: any = await tools.set_meta.execute({ metaTitle: 'New Title' }, {} as any);
  expect(r.ok).toBe(true);
  expect(ctx.meta).toEqual({ metaTitle: 'New Title' });
  expect(ctx.htmlDirty).toBe(false);
});
