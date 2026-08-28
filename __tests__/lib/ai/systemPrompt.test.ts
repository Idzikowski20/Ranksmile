import { makeWorkingDoc } from '@/src/infrastructure/ai/workingDoc';
import { buildSystemPrompt } from '@/src/infrastructure/ai/systemPrompt';
import type { ToolCtx } from '@/src/infrastructure/ai/types';

it('embeds the keyword, the outline, and tool guidance', () => {
  const { $, outline } = makeWorkingDoc('<h1>Hello</h1><p>World</p>');
  const ctx: ToolCtx = {
    $, keyword: 'pozycjonowanie', articleTitle: 'T', articleMetaDescription: 'D',
    internalArticles: [], scoreData: null, changelog: [], htmlDirty: false, writeCount: 0, meta: null,
    articleId: null, cache: {}, pendingAction: null,
  };
  const sys = buildSystemPrompt(ctx, outline);
  expect(sys).toContain('pozycjonowanie');
  expect(sys).toContain('[sid 0] <h1> Hello');
  expect(sys).toContain('apply_edit');
  expect(sys).toMatch(/Greetings \/ small talk/i);
  expect(sys).toMatch(/Do NOT call tools/i);
});
