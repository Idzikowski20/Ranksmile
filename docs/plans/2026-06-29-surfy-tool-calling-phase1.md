# Surfy Tool-Calling Agent — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Surfy's single-shot LLM call (article mode) with a multi-step tool-calling agent that reads SEO data and edits the article HTML across several steps, then returns the final HTML for the existing Apply/Dismiss UI.

**Architecture:** Server-authoritative agent loop in a Next.js pages-router API route, built on the Vercel AI SDK (`generateText` + tools) with the `@ai-sdk/deepseek` provider. The article HTML is held server-side in a `cheerio` working copy; read tools compute SEO data from it, write tools mutate it, and the final HTML is returned to the client which applies it via `editor.commands.setContent(...)`. The model targets blocks via injected `data-sid` handles (stripped before output). Base64 images are stripped before the model sees them and restored on output.

**Tech Stack:** Next.js 12 (pages-router), TypeScript, Tiptap v3 (client), DeepSeek `deepseek-chat`, Vercel AI SDK `ai@7.0.4` + `@ai-sdk/deepseek@3.0.1`, `zod@3.25.76`, `cheerio@1.0.0-rc.12`, Jest + ts-jest.

**Spec:** `docs/specs/2026-06-29-surfy-tool-calling-phase1.md`

---

## Review responses (v2 — after external review)

The external review (8.5/10) raised valid issues. Triage:

**Accepted & folded into this plan:**
- **Stale `data-sid` + stale outline after writes (the critical one).** Fixed: every write tool
  calls `reindexSids()` (renumber all top-level blocks) and **returns the fresh `outline` in its
  result**, so the model always sees the current structure. Also added a `get_outline` read tool.
- **`read_block(sid)` tool.** Added — outline previews (80 chars) aren't enough on long articles;
  the model can now fetch a block's exact tag/text/HTML before editing it (prevents clobbering).
- **HTML sanitization of model output.** Added `sanitizeFragment()` (strips
  `script/style/iframe/object/embed/...` + `on*` handlers + `javascript:` URLs); write tools
  sanitize before inserting. (Tiptap's schema is a second backstop on `setContent`.)
- **Runaway edits.** Added a per-turn write cap (`MAX_WRITES = 12`); over the cap, write tools
  return `ok:false`. (`isStepCount(8)` bounds *steps*, not *tool calls per step* — so this is a
  distinct guard.)
- **Empty-output guard.** The route discards a `finalHtml` whose visible text is empty, so the
  agent can never blank the article.
- **Edit flexibility for lists/tables.** Added a `remove` op and an optional heading `level` to
  `insert_section`. Container edits (ul/ol/table) use **`read_block` then `apply_edit replace`**
  with the full new inner HTML — this covers the reviewer's list/table case without nested sids.
- **Minimal logging.** The route logs `steps / writes / tokens`; enough to debug Phase 1.

**Deferred with rationale (over-engineering for a Phase-1 MVP):**
- **Full edit-op zoo** (`replace_outer/append_child/insert_before/...`) — `read_block` +
  `apply_edit replace` already covers nested edits; per-`<li>` sids are scope creep. Revisit if
  real usage shows it's needed.
- **Granular `dirtyBlocks/changedSids` tracking** — we already ship a word-level **Compare
  versions** diff (original vs new HTML), so block-level change tracking adds nothing for review.
  Kept `htmlDirty: boolean` + the human `changelog`.
- **Full parse-and-rollback validation** — `cheerio.html()` is *always* well-formed (it's a
  serializer), so there's no malformed-HTML failure mode to roll back; the lighter empty-output
  guard covers the real risk.
- **Splitting `ToolCtx`** — a single mutable per-request ctx is fine at 8 tools (Twenty threads a
  context object too); revisit if it grows.
- **Full telemetry pipeline** (persisted per-tool ms/tokens) — Phase 4; minimal `console` logging
  now.

### Round 2 (second review pass)

**Accepted:**
- **Read tools must not mutate.** `reindexSids` was being called from the `get_outline` read tool.
  Split into `buildOutline($)` (pure — reads existing sids) and `reindexSids($)` (sets sids by
  index, then returns `buildOutline`). Read tools (`get_outline`) use `buildOutline`; only write
  tools (and initial `makeWorkingDoc`) call `reindexSids`.
- **`read_block` returns `outerHtml` too.** Added alongside `tag`/`text`/`html` (inner), so the
  model can see and reproduce the whole block (incl. its tag) when replacing.
- **Invalid-nesting guard on `apply_edit replace` (the important one).** `op:'replace'` sets
  *inner* HTML; if the model passes block-level HTML into a phrasing-only container (`<p>`,
  `<h1>`–`<h6>`), the result is invalid nesting (e.g. `<p><h2>…</h2></p>`) that the browser/Tiptap
  silently mangles. Added a guard: replace into a phrasing-only block is rejected with actionable
  guidance ("pass inline HTML, or use append/prepend for sibling blocks, or remove + insert_section").

**Deferred with rationale:**
- **Structured (JSON) outline instead of the `[sid N] <tag> text` text form.** Kept the compact
  text form: it's ~2–3× cheaper in tokens on long articles (100+ blocks), a *flat* list reads
  unambiguously as text for an LLM, and the reviewer agrees it's a non-blocker. Easy to switch to
  `OutlineBlock[]` in a later phase if real usage shows parsing errors — `buildOutline` is the
  single seam to change.

---

## File Structure

| File | Responsibility | Created in |
|---|---|---|
| `lib/ai/workingDoc.ts` | Cheerio working copy: base64 strip/restore, `reindexSids` (annotate + outline), `sanitizeFragment`, sid strip | Task 1 |
| `lib/ai/types.ts` | `ToolCtx`, `ToolResult` shared types | Task 2 |
| `lib/ai/tools.ts` | The 8 Phase-1 tools (4 read + 2 nav + 3 write… `read_block`/`get_outline` are the nav tools) + `buildTools(ctx)` | Tasks 3–4 |
| `lib/ai/systemPrompt.ts` | `buildSystemPrompt(ctx, outline)` | Task 5 |
| `lib/ai/deepseek.ts` | Configured `@ai-sdk/deepseek` provider instance | Task 6 |
| `pages/api/articles/surfy-agent.ts` | The agent route (loop) | Task 7 |
| `components/articles/ArticleEditor.tsx` | Client: call agent in article mode, apply `finalHtml` + `meta` | Task 8 |

Tests live under `__tests__/lib/ai/`. Run the suite with `npx jest <path>` (the repo already uses Jest + ts-jest; `npx tsc --noEmit` is the type gate). All bash commands assume the working directory is the repo root `C:\Users\patry\Desktop\serpbear` (in Git Bash: `cd /c/Users/patry/Desktop/serpbear`).

> **DeepSeek API key:** the agent route reads `process.env.DEEPSEEK_API_KEY` (already configured in `.env`, same key the current `ask-surfy.ts` uses). Do NOT edit `.env`.

---

## Task 0: Install & verify the AI SDK + DeepSeek tool-calling

**Why first:** de-risk the whole plan. If DeepSeek + AI SDK tool-calling doesn't work end-to-end, we must know before building tools. This is a hard gate.

**Files:**
- Modify: `package.json` (add deps)
- Create (temporary): `scratch/surfy-smoke.ts` (delete after — NOT committed)

- [ ] **Step 1: Install pinned dependencies**

```bash
cd /c/Users/patry/Desktop/serpbear
npm install --save-exact ai@7.0.4 @ai-sdk/deepseek@3.0.1 zod@3.25.76
```
Expected: installs without peer-dep errors. `zod@3.25.76` is already present (transitive); this pins it as a direct dependency. Confirm `package.json` now lists `ai`, `@ai-sdk/deepseek`, `zod`.

- [ ] **Step 2: Write a smoke script that exercises a real tool call**

Create `scratch/surfy-smoke.ts`:
```ts
import 'dotenv/config';
import { generateText, tool, isStepCount } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { z } from 'zod';

const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });

async function main() {
  const result = await generateText({
    model: deepseek('deepseek-chat'),
    system: 'You are a helper. Use the add tool to compute sums; never compute them yourself.',
    prompt: 'What is 21 + 21? Use the tool, then state the result.',
    tools: {
      add: tool({
        description: 'Add two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }: { a: number; b: number }) => ({ sum: a + b }),
      }),
    },
    stopWhen: isStepCount(4),
  });
  console.log('STEPS:', result.steps.length);
  console.log('TOOL CALLS:', JSON.stringify(result.steps.flatMap((s) => s.toolCalls), null, 2));
  console.log('TEXT:', result.text);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run the smoke script**

```bash
cd /c/Users/patry/Desktop/serpbear
npx tsx scratch/surfy-smoke.ts
```
Expected: prints `STEPS: 2` (or more), a non-empty `TOOL CALLS` array containing an `add` call with `{a:21,b:21}`, and `TEXT` mentioning `42`.

> If `tsx` is unavailable, run `npx ts-node scratch/surfy-smoke.ts` or `npm i -D tsx` first.
> If the API names differ from the installed version (e.g. `isStepCount` was renamed), fix them here and adjust every later task that uses `generateText`/`tool`/`isStepCount` to match. This step is the source of truth for the AI SDK API.

- [ ] **Step 4: Delete the scratch script and commit deps**

```bash
cd /c/Users/patry/Desktop/serpbear
rm scratch/surfy-smoke.ts
git add package.json package-lock.json
git commit -m "build: add ai SDK + @ai-sdk/deepseek + zod for Surfy agent"
```

---

## Task 1: `lib/ai/workingDoc.ts` — cheerio working copy

**Files:**
- Create: `lib/ai/workingDoc.ts`
- Test: `__tests__/lib/ai/workingDoc.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/ai/workingDoc.test.ts`:
```ts
import {
  stripDataImages, restoreDataImages, stripSids, makeWorkingDoc, reindexSids, buildOutline, sanitizeFragment,
} from '../../../lib/ai/workingDoc';

describe('stripDataImages / restoreDataImages', () => {
  it('round-trips base64 image sources through placeholders', () => {
    const html = '<p>hi</p><img src="data:image/png;base64,AAAA"><img src="https://x/y.png">';
    const { stripped, map } = stripDataImages(html);
    expect(stripped).not.toContain('data:image/png;base64,AAAA');
    expect(stripped).toContain('__SURFY_IMG_0__');
    expect(stripped).toContain('https://x/y.png'); // non-data src untouched
    expect(restoreDataImages(stripped, map)).toContain('data:image/png;base64,AAAA');
  });
});

describe('makeWorkingDoc', () => {
  it('annotates top-level blocks with sequential data-sid and builds an outline', () => {
    const { $, outline } = makeWorkingDoc('<h1>Title</h1><p>First para</p><p>Second</p>');
    expect($('[data-sid="0"]').prop('tagName')?.toLowerCase()).toBe('h1');
    expect($('[data-sid="1"]').text()).toBe('First para');
    expect($('[data-sid="2"]').length).toBe(1);
    expect(outline).toContain('[sid 0] <h1> Title');
    expect(outline).toContain('[sid 1] <p> First para');
  });
});

describe('reindexSids', () => {
  it('renumbers blocks after an out-of-band insert and returns the fresh outline', () => {
    const { $ } = makeWorkingDoc('<p>A</p><p>B</p>');     // sids 0,1
    $('[data-sid="0"]').before('<p>NEW</p>');             // inserted block has no sid yet
    const outline = reindexSids($);                        // renumber 0,1,2
    expect($('[data-sid="0"]').text()).toBe('NEW');
    expect($('[data-sid="2"]').text()).toBe('B');
    expect(outline).toContain('[sid 0] <p> NEW');
  });
});

describe('buildOutline', () => {
  it('reads existing sids without mutating them (pure)', () => {
    const { $ } = makeWorkingDoc('<p>A</p><p>B</p>');
    $('[data-sid="0"]').attr('data-sid', '7'); // deliberately non-contiguous
    const outline = buildOutline($);
    expect(outline).toContain('[sid 7] <p> A'); // reflects current sid, did not renumber
    expect($('[data-sid="7"]').length).toBe(1);
  });
});

describe('sanitizeFragment', () => {
  it('strips scripts, iframes, and on* handlers but keeps safe content', () => {
    const out = sanitizeFragment('<p onclick="x()">hi</p><script>evil()</script><iframe src="z"></iframe>');
    expect(out).toContain('hi');
    expect(out).not.toContain('script');
    expect(out).not.toContain('iframe');
    expect(out).not.toContain('onclick');
  });
});

describe('stripSids', () => {
  it('removes all data-sid attributes from html', () => {
    const out = stripSids('<p data-sid="0">a</p><p data-sid="12">b</p>');
    expect(out).not.toContain('data-sid');
    expect(out).toBe('<p>a</p><p>b</p>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/ai/workingDoc.test.ts
```
Expected: FAIL — `Cannot find module '../../../lib/ai/workingDoc'`.

- [ ] **Step 3: Implement `lib/ai/workingDoc.ts`**

```ts
import * as cheerio from 'cheerio';

/**
 * Replace base64 data-URL image sources with short placeholders before the HTML
 * reaches the LLM (those can be megabytes). Restore them on the way out.
 */
export function stripDataImages(html: string): { stripped: string; map: Map<string, string> } {
  const map = new Map<string, string>();
  let i = 0;
  const stripped = html.replace(/(<img[^>]*\ssrc=)["'](data:[^"']+)["']/gi, (_m, pre, dataUrl) => {
    const token = `__SURFY_IMG_${i}__`;
    i += 1;
    map.set(token, dataUrl);
    return `${pre}"${token}"`;
  });
  return { stripped, map };
}

export function restoreDataImages(html: string, map: Map<string, string>): string {
  let out = html;
  map.forEach((dataUrl, token) => { out = out.split(token).join(dataUrl); });
  return out;
}

/** Remove the data-sid handles we inject for the model before saving the article. */
export function stripSids(html: string): string {
  return html.replace(/\s+data-sid="\d+"/g, '');
}

export interface WorkingDoc {
  $: cheerio.CheerioAPI;
  /** One line per top-level block: `[sid N] <tag> preview` */
  outline: string;
}

/**
 * PURE read: build the outline (one line per top-level block) from the sids that
 * are already on the document. No mutation — safe to call from read tools.
 */
export function buildOutline($: cheerio.CheerioAPI): string {
  const lines: string[] = [];
  $.root().children().each((_i, el) => {
    const sid = $(el).attr('data-sid');
    if (sid == null) return; // skip unindexed nodes (shouldn't happen post-reindex)
    const tag = (el as cheerio.Element).tagName || (el as { name?: string }).name || '?';
    const preview = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 80);
    lines.push(`[sid ${sid}] <${tag}> ${preview}`);
  });
  return lines.join('\n');
}

/**
 * MUTATES: renumber every top-level block's `data-sid` to 0..n (contiguous), then
 * return the fresh outline. Call this only after a structural edit (or initial load).
 */
export function reindexSids($: cheerio.CheerioAPI): string {
  $.root().children().each((i, el) => { $(el).attr('data-sid', String(i)); });
  return buildOutline($);
}

/**
 * Load article HTML as a cheerio fragment and tag each top-level block with a
 * stable `data-sid` so tools can target it.
 */
export function makeWorkingDoc(html: string): WorkingDoc {
  const $ = cheerio.load(html, null, false); // fragment mode: no <html>/<body> wrapper
  const outline = reindexSids($);
  return { $, outline };
}

const UNSAFE_TAGS = 'script,style,iframe,object,embed,noscript,link,meta,base,form,input,button,svg';

/**
 * Defense-in-depth: strip dangerous tags/attributes from model-authored HTML
 * before it enters the article. (Tiptap's schema is a second backstop on apply.)
 */
export function sanitizeFragment(html: string): string {
  const $ = cheerio.load(html, null, false);
  $(UNSAFE_TAGS).remove();
  $('*').each((_i, el) => {
    const attribs = (el as cheerio.Element).attribs || {};
    Object.keys(attribs).forEach((name) => {
      if (/^on/i.test(name)) { $(el).removeAttr(name); return; }
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attribs[name])) {
        $(el).removeAttr(name);
      }
    });
  });
  return $.root().html() || '';
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/ai/workingDoc.test.ts
npx tsc --noEmit
```
Expected: all tests PASS; `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/workingDoc.ts __tests__/lib/ai/workingDoc.test.ts
git commit -m "feat(surfy): cheerio working-doc helpers (sid annotation, image strip)"
```

---

## Task 2: `lib/ai/types.ts` — shared tool types

**Files:**
- Create: `lib/ai/types.ts`

(No test — type-only module. Type-checked transitively by Tasks 3–4.)

- [ ] **Step 1: Implement `lib/ai/types.ts`**

```ts
import type * as cheerio from 'cheerio';
import type { ScoreData } from '../contentScore';

export interface InternalArticleRef {
  id?: number;
  title: string;
  url: string;
}

/** Per-request context shared by every tool. Write tools mutate `$`, `meta`,
 *  `htmlDirty`, and `changelog`. */
export interface ToolCtx {
  $: cheerio.CheerioAPI;
  keyword: string;
  scoreData: ScoreData | null;
  internalArticles: InternalArticleRef[];
  articleTitle: string;
  articleMetaDescription: string;
  changelog: Array<{ tool: string; summary: string }>;
  htmlDirty: boolean;
  /** Number of write-tool executions this turn (bounded by MAX_WRITES). */
  writeCount: number;
  meta: { metaTitle?: string; metaDescription?: string } | null;
}

export interface ToolResult {
  ok: boolean;
  summary: string;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/types.ts
git commit -m "feat(surfy): shared ToolCtx/ToolResult types"
```

---

## Task 3: `lib/ai/tools.ts` — read tools

**Files:**
- Create: `lib/ai/tools.ts`
- Test: `__tests__/lib/ai/tools.read.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/ai/tools.read.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/ai/tools.read.test.ts
```
Expected: FAIL — `Cannot find module '../../../lib/ai/tools'`.

- [ ] **Step 3: Implement `lib/ai/tools.ts` (read tools + helpers + `buildTools` skeleton)**

```ts
import { tool } from 'ai';
import { z } from 'zod';
import type * as cheerio from 'cheerio';
import { countOccurrences } from '../contentScore';
import { scoreContent } from '../seo/scoreContentClient';
import { reindexSids, buildOutline, sanitizeFragment } from './workingDoc';
import type { ToolCtx } from './types';

const MAX_WRITES = 12; // cap on write-tool executions per turn

// Phrasing-only containers can't legally hold block-level children; replacing
// their inner HTML with a block creates invalid nesting (e.g. <p><h2>…</h2></p>)
// that the browser/Tiptap silently mangles.
const PHRASING_ONLY = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dt', 'figcaption']);
const BLOCK_TAG_RE = /<(p|div|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|blockquote|section|article|figure|pre|hr)[\s/>]/i;
function wouldNestBlock(tag: string, html: string): boolean {
  return PHRASING_ONLY.has(tag.toLowerCase()) && BLOCK_TAG_RE.test(html);
}

function workingText($: cheerio.CheerioAPI): string {
  return $.root().text().replace(/\s+/g, ' ').trim();
}

export function buildTools(ctx: ToolCtx) {
  return {
    read_block: tool({
      description: 'Get the current tag, text, and exact inner HTML of a block by its sid. Read a block before editing it so you replace the right content accurately (essential for lists and tables).',
      inputSchema: z.object({ sid: z.number().int() }),
      execute: async ({ sid }) => {
        const el = ctx.$(`[data-sid="${sid}"]`);
        if (el.length === 0) return { ok: false, summary: `sid ${sid} not found` };
        const node = el.get(0) as { tagName?: string; name?: string } | undefined;
        return {
          sid,
          tag: node?.tagName || node?.name || '?',
          text: el.text().trim(),
          html: el.html() || '',          // inner HTML (for op:'replace')
          outerHtml: ctx.$.html(el) || '', // whole block incl. its own tag
        };
      },
    }),

    get_outline: tool({
      description: 'Get the current article outline (one line per block with its sid). Call this after edits to see the up-to-date structure before making more edits.',
      inputSchema: z.object({}),
      execute: async () => ({ outline: buildOutline(ctx.$) }), // pure read — never renumbers
    }),

    get_content_score: tool({
      description:
        'Get the current SEO content score: word/heading/paragraph counts vs targets and per-NLP-term coverage (missing/low/ok/overuse). Call this to see how the article scores right now.',
      inputSchema: z.object({}),
      execute: async () => {
        const text = workingText(ctx.$);
        const words = text.split(/\s+/).filter(Boolean).length;
        const sd = ctx.scoreData;
        const terms = (sd?.terms || []).map((t) => {
          const current = countOccurrences(text, t.term);
          const min = Math.max(1, Math.round(t.target_count * 0.7));
          const max = Math.round(t.target_count * 1.5);
          const status = current === 0 ? 'missing' : current < min ? 'low' : current > max ? 'overuse' : 'ok';
          return { term: t.term, current, target: t.target_count, status };
        });
        return {
          words: { current: words, target: sd?.words_target ?? null },
          headings: { current: ctx.$('h1,h2,h3,h4').length, target: sd?.headings_target ?? null },
          paragraphs: { current: ctx.$('p').length, target: sd?.paragraphs_target ?? null },
          terms,
        };
      },
    }),

    list_missing_terms: tool({
      description: 'List NLP terms the article under-uses (current count below the minimum), biggest gap first.',
      inputSchema: z.object({ limit: z.number().int().positive().max(50).optional() }),
      execute: async ({ limit }) => {
        const text = workingText(ctx.$);
        const gaps = (ctx.scoreData?.terms || [])
          .map((t) => ({ term: t.term, current: countOccurrences(text, t.term), target: t.target_count }))
          .filter((t) => t.current < Math.max(1, Math.round(t.target * 0.7)))
          .sort((a, b) => (b.target - b.current) - (a.target - a.current));
        return { missing: gaps.slice(0, limit ?? 10) };
      },
    }),

    get_ranking_signals: tool({
      description: 'Run the ranking-signal analysis and return the overall ranking score plus the weakest signals with fix recommendations.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const r: any = await scoreContent(
            ctx.$.html(), ctx.keyword, (ctx.scoreData as any) || {}, ctx.articleTitle, ctx.articleMetaDescription,
          );
          const weakest = [...(r?.ranking_signals?.signals || [])]
            .sort((a: any, b: any) => a.score - b.score)
            .slice(0, 5)
            .map((s: any) => ({ name: s.name, score: s.score, recommendation: s.recommendation }));
          return { ranking_score: r?.ranking_score ?? null, weakest_signals: weakest };
        } catch (e: any) {
          return { ok: false, error: `ranking analysis unavailable: ${e?.message || 'error'}` };
        }
      },
    }),

    list_internal_link_targets: tool({
      description: 'List internal articles you can link to. Optional query filters by title substring.',
      inputSchema: z.object({ query: z.string().optional() }),
      execute: async ({ query }) => {
        const q = (query || '').toLowerCase().trim();
        const targets = ctx.internalArticles
          .filter((a) => !q || a.title.toLowerCase().includes(q))
          .slice(0, 20)
          .map((a) => ({ title: a.title, url: a.url }));
        return { targets };
      },
    }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/ai/tools.read.test.ts
npx tsc --noEmit
```
Expected: all 4 tests PASS; `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/tools.ts __tests__/lib/ai/tools.read.test.ts
git commit -m "feat(surfy): read tools (score, missing terms, ranking signals, link targets)"
```

---

## Task 4: `lib/ai/tools.ts` — write tools

**Files:**
- Modify: `lib/ai/tools.ts` (add 3 tools inside the `buildTools` return object)
- Test: `__tests__/lib/ai/tools.write.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/ai/tools.write.test.ts`:
```ts
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
  expect(ctx.$.html()).toContain('<h2>FAQ</h2>');
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/ai/tools.write.test.ts
```
Expected: FAIL — `tools.apply_edit` is undefined (`Cannot read properties of undefined`).

- [ ] **Step 3: Add write tools to `buildTools`**

In `lib/ai/tools.ts`, add these three properties to the object returned by `buildTools` (alongside the read tools — i.e. inside the same `return { ... }`). Place them after `list_internal_link_targets`:

```ts
    apply_edit: tool({
      description:
        'Edit a block by its sid. op="replace" replaces the block\'s inner HTML; "append" inserts a new block AFTER it; "prepend" inserts a new block BEFORE it; "remove" deletes the block. For lists/tables, call read_block first then "replace" with the full new inner HTML. Returns the refreshed outline.',
      inputSchema: z.object({
        sid: z.number().int(),
        op: z.enum(['replace', 'append', 'prepend', 'remove']),
        html: z.string().optional(),
      }),
      execute: async ({ sid, op, html }) => {
        if (ctx.writeCount >= MAX_WRITES) return { ok: false, summary: 'edit limit reached for this turn' };
        const el = ctx.$(`[data-sid="${sid}"]`);
        if (el.length === 0) return { ok: false, summary: `sid ${sid} not found` };
        if (op !== 'remove' && !html) return { ok: false, summary: `html is required for op "${op}"` };
        const safe = html ? sanitizeFragment(html) : '';
        if (op === 'replace') {
          const node = el.get(0) as { tagName?: string; name?: string } | undefined;
          const tag = node?.tagName || node?.name || '';
          if (wouldNestBlock(tag, safe)) {
            return { ok: false, summary: `<${tag}> can't contain block-level HTML. Pass inline HTML only, or use op "append"/"prepend" to add sibling blocks, or "remove" then insert_section.` };
          }
        }
        if (op === 'replace') el.html(safe);
        else if (op === 'append') el.after(safe);
        else if (op === 'prepend') el.before(safe);
        else el.remove();
        ctx.htmlDirty = true;
        ctx.writeCount += 1;
        ctx.changelog.push({ tool: 'apply_edit', summary: `${op} on sid ${sid}` });
        return { ok: true, summary: `Applied ${op} to sid ${sid}`, outline: reindexSids(ctx.$) };
      },
    }),

    insert_section: tool({
      description:
        'Insert a new section (a heading plus body HTML) at a position. position="start"|"end" relative to the article; "after_sid"/"before_sid" relative to a block (requires sid). level is the heading level (2–4, default 2). Returns the refreshed outline.',
      inputSchema: z.object({
        heading: z.string(),
        html: z.string(),
        position: z.enum(['start', 'end', 'after_sid', 'before_sid']),
        sid: z.number().int().optional(),
        level: z.number().int().min(2).max(4).optional(),
      }),
      execute: async ({ heading, html, position, sid, level }) => {
        if (ctx.writeCount >= MAX_WRITES) return { ok: false, summary: 'edit limit reached for this turn' };
        const h = level ?? 2;
        const block = `<h${h}>${heading}</h${h}>\n${sanitizeFragment(html)}`;
        if (position === 'start') ctx.$.root().prepend(block);
        else if (position === 'end') ctx.$.root().append(block);
        else {
          if (sid == null) return { ok: false, summary: 'sid is required for after_sid/before_sid' };
          const el = ctx.$(`[data-sid="${sid}"]`);
          if (el.length === 0) return { ok: false, summary: `sid ${sid} not found` };
          if (position === 'after_sid') el.after(block);
          else el.before(block);
        }
        ctx.htmlDirty = true;
        ctx.writeCount += 1;
        ctx.changelog.push({ tool: 'insert_section', summary: `Inserted "${heading}" (${position})` });
        return { ok: true, summary: `Inserted section "${heading}"`, outline: reindexSids(ctx.$) };
      },
    }),

    set_meta: tool({
      description: 'Stage updated SEO meta tags (title and/or description). Does not change the article body; the client applies these on accept.',
      inputSchema: z.object({
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
      }),
      execute: async ({ metaTitle, metaDescription }) => {
        ctx.meta = {
          ...(ctx.meta || {}),
          ...(metaTitle != null ? { metaTitle } : {}),
          ...(metaDescription != null ? { metaDescription } : {}),
        };
        ctx.changelog.push({ tool: 'set_meta', summary: 'Updated meta tags' });
        return { ok: true, summary: 'Meta tags staged for apply' };
      },
    }),
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/ai/tools.write.test.ts
npx tsc --noEmit
```
Expected: all 5 tests PASS; `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/tools.ts __tests__/lib/ai/tools.write.test.ts
git commit -m "feat(surfy): write tools (apply_edit, insert_section, set_meta)"
```

---

## Task 5: `lib/ai/systemPrompt.ts` — system prompt builder

**Files:**
- Create: `lib/ai/systemPrompt.ts`
- Test: `__tests__/lib/ai/systemPrompt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/ai/systemPrompt.test.ts`:
```ts
import { makeWorkingDoc } from '../../../lib/ai/workingDoc';
import { buildSystemPrompt } from '../../../lib/ai/systemPrompt';
import type { ToolCtx } from '../../../lib/ai/types';

it('embeds the keyword, the outline, and tool guidance', () => {
  const { $, outline } = makeWorkingDoc('<h1>Hello</h1><p>World</p>');
  const ctx: ToolCtx = {
    $, keyword: 'pozycjonowanie', articleTitle: 'T', articleMetaDescription: 'D',
    internalArticles: [], scoreData: null, changelog: [], htmlDirty: false, meta: null,
  };
  const sys = buildSystemPrompt(ctx, outline);
  expect(sys).toContain('pozycjonowanie');
  expect(sys).toContain('[sid 0] <h1> Hello');
  expect(sys).toContain('apply_edit');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/ai/systemPrompt.test.ts
```
Expected: FAIL — `Cannot find module '../../../lib/ai/systemPrompt'`.

- [ ] **Step 3: Implement `lib/ai/systemPrompt.ts`**

```ts
import { ANTI_HALLUCINATION_RULES } from '../seo/antiHallucinationRules';
import type { ToolCtx } from './types';

export function buildSystemPrompt(ctx: ToolCtx, outline: string): string {
  return `You are Surfy, an SEO content-editing agent working inside an article editor.
You operate by calling tools, reading their results, and looping until the task is done.

TARGET KEYWORD: ${ctx.keyword || '(none)'}

TOOLS
Read (inform yourself before editing):
- get_content_score — current word/heading/paragraph counts vs targets + per-term coverage
- list_missing_terms — NLP terms the article under-uses
- get_ranking_signals — ranking score + weakest signals with fix tactics
- list_internal_link_targets — internal articles you can link to
Navigate (read exact structure/content):
- get_outline — the current outline (sid + tag + preview per block); call after edits
- read_block { sid } — the exact tag/text/HTML of one block; read before editing it
Write (mutate the article; only when the user asked for changes):
- apply_edit { sid, op: replace|append|prepend|remove, html? } — edit/remove a block by sid
- insert_section { heading, html, position, sid?, level? } — add a new heading + body section
- set_meta { metaTitle?, metaDescription? } — stage SEO meta changes

ARTICLE OUTLINE (target edits by sid):
${outline || '(empty article)'}

STRATEGY
1. If the user asks a question or for analysis, use read tools and answer in text — do NOT edit.
2. If the user asks for changes: read what you need (score / missing terms / signals), and
   read_block the block you intend to change, then edit it with a write tool targeting its sid.
3. Every write tool returns the REFRESHED outline — use that updated outline (sids may have
   shifted) for any further edits in the same turn; do not rely on the original outline after a write.
4. After editing, briefly verify (e.g. re-check get_content_score) when relevant.
5. End with a short, plain-language summary of what you did or found.

RULES
- Only change what the user asked for. Never rewrite untouched sections.
- Only use sids that currently exist. If a tool returns ok:false, read get_outline and retry.
- For lists/tables, read_block first, then apply_edit "replace" with the full new inner HTML.
- op "replace" sets a block's INNER HTML. Never place block elements (<p>, <h2>, <ul>, <table>…)
  inside a <p> or a heading — to add new blocks use op "append"/"prepend" or insert_section.
- Never invent facts, statistics, sources, or author credentials.
- The "html" you pass to write tools is inner HTML (no <html>/<body> wrappers, no <script>/<iframe>).

${ANTI_HALLUCINATION_RULES}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/ai/systemPrompt.test.ts
npx tsc --noEmit
```
Expected: PASS; `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/systemPrompt.ts __tests__/lib/ai/systemPrompt.test.ts
git commit -m "feat(surfy): agent system prompt builder"
```

---

## Task 6: `lib/ai/deepseek.ts` — provider instance

**Files:**
- Create: `lib/ai/deepseek.ts`

(No unit test — thin config wrapper, exercised by Task 7's manual smoke.)

- [ ] **Step 1: Implement `lib/ai/deepseek.ts`**

```ts
import { createDeepSeek } from '@ai-sdk/deepseek';

/** Shared DeepSeek provider for the Surfy agent. Reads DEEPSEEK_API_KEY. */
export const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/deepseek.ts
git commit -m "feat(surfy): shared DeepSeek provider instance"
```

---

## Task 7: `pages/api/articles/surfy-agent.ts` — the agent route

**Files:**
- Create: `pages/api/articles/surfy-agent.ts`

(No unit test — the route runs a live LLM loop; verified by manual smoke in Step 2.)

- [ ] **Step 1: Implement the route**

```ts
// POST /api/articles/surfy-agent
// Multi-step Surfy agent: read SEO tools + write tools over a server-side cheerio
// working copy of the article, then return the final HTML for the client to apply.
import type { NextApiRequest, NextApiResponse } from 'next';
import { generateText, isStepCount } from 'ai';
import verifyUser from '../../../utils/verifyUser';
import { deepseek } from '../../../lib/ai/deepseek';
import { makeWorkingDoc, stripDataImages, restoreDataImages, stripSids } from '../../../lib/ai/workingDoc';
import { buildTools } from '../../../lib/ai/tools';
import { buildSystemPrompt } from '../../../lib/ai/systemPrompt';
import type { ToolCtx } from '../../../lib/ai/types';

export const config = { maxDuration: 60, api: { responseLimit: '10mb' } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    prompt, content, keyword = '', scoreData = null, internalArticles = [],
    articleTitle = '', articleMetaDescription = '', history = [],
  } = req.body;
  if (!prompt || !content) return res.status(400).json({ error: 'prompt and content are required' });
  if (!process.env.DEEPSEEK_API_KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

  try {
    const { stripped, map } = stripDataImages(content as string);
    const { $, outline } = makeWorkingDoc(stripped);

    const ctx: ToolCtx = {
      $, keyword, scoreData, internalArticles, articleTitle, articleMetaDescription,
      changelog: [], htmlDirty: false, writeCount: 0, meta: null,
    };

    const priorTurns = (Array.isArray(history) ? history : [])
      .filter((h: any) => h && typeof h.message === 'string' && h.message.trim())
      .map((h: any) => ({ role: h.role === 'assistant' ? 'assistant' as const : 'user' as const, content: h.message }));

    const result = await generateText({
      model: deepseek('deepseek-chat'),
      system: buildSystemPrompt(ctx, outline),
      messages: [...priorTurns, { role: 'user' as const, content: prompt }],
      tools: buildTools(ctx),
      stopWhen: isStepCount(8),
    });

    let finalHtml = ctx.htmlDirty ? restoreDataImages(stripSids($.html()), map) : null;

    // Guard: never apply an article the agent accidentally emptied.
    if (finalHtml != null && finalHtml.replace(/<[^>]+>/g, '').trim().length === 0) {
      finalHtml = null;
      ctx.changelog.push({ tool: 'guard', summary: 'discarded empty result' });
    }

    console.log(`[surfy-agent] steps=${result.steps.length} writes=${ctx.writeCount} tokens=${result.usage?.totalTokens ?? '?'}`);

    return res.status(200).json({
      message: result.text,
      finalHtml,
      meta: ctx.meta,
      changed: Boolean(finalHtml) || Boolean(ctx.meta),
      changelog: ctx.changelog,
      steps: result.steps.length,
    });
  } catch (error: any) {
    console.error('[surfy-agent] error:', error);
    return res.status(500).json({ error: error?.message || 'Request failed' });
  }
}
```

- [ ] **Step 2: Manual smoke test (dev server)**

Start the app (`npm run dev`), open an article in the Content Editor, open Surfy (article mode — no text selected), and send:
> *"Sprawdź których terminów NLP brakuje i dodaj krótką sekcję pokrywającą 2 najważniejsze."*

Expected: the network response from `POST /api/articles/surfy-agent` has `changed: true`, a non-empty `finalHtml`, a `changelog` listing `list_missing_terms` then `insert_section`, and `steps >= 2`. (Client wiring lands in Task 8; for this step, inspect the response in the browser Network tab — the existing Surfy still points at `ask-surfy`.)

Also verify a pure-analysis prompt returns `changed: false`, `finalHtml: null`, and a useful `message`:
> *"Jak wygląda mój wynik treści?"*

- [ ] **Step 3: Type-check & commit**

```bash
npx tsc --noEmit
git add pages/api/articles/surfy-agent.ts
git commit -m "feat(surfy): multi-step agent route (generateText + tools over cheerio)"
```

---

## Task 8: Wire the client to the agent (article mode)

This task wires the client AND ships the agent UX in the same pass (per decision: frontend ships
with backend). It covers: routing article-mode to the agent, applying edits + meta, plus six UX
additions — (1) a "what Surfy did" step/changelog list, (2) a **Preview** diff before Apply
(reusing the existing `CompareVersionsModal`), (3) **Stop/Cancel** during a run (AbortController),
(4) a meta-change indicator, (5) **suggested-prompt** chips, (6) a friendly limit/guard line.

**Files:**
- Modify: `components/articles/ArticleEditor.tsx` — imports, Surfy state/refs, `handleSurfySubmit`,
  `handleSurfyApply`, the Surfy bar render (loading, changelog, action buttons, suggestions, modal).
- Reuse: `components/articles/CompareVersionsModal.tsx` (already exists — word-level diff;
  props `{ original, updated, terms?, onClose }`).

Context: `ArticleEditor` already receives props `metaTitle`, `metaDescription`, `onMetaTitleChange`,
`onMetaDescriptionChange`, `scoreData`, `internalArticles`, `keyword`, `articleKeyword`.
`surfySelection` is non-null only in selection mode. The full-article apply path is
`editor.commands.setContent(surfyResponse.content)`. `surfyInputRef` is the textarea ref.

- [ ] **Step 1: Import the diff modal; extend Surfy state and refs**

Add to the imports at the top of `components/articles/ArticleEditor.tsx`:
```ts
import CompareVersionsModal from './CompareVersionsModal';
```

Extend the `surfyResponse` state type to carry the agent's changelog/steps. Find:
```ts
    const [surfyResponse, setSurfyResponse] = useState<{ action?: string; message: string; content: string | null } | null>(null);
```
Replace with:
```ts
    const [surfyResponse, setSurfyResponse] = useState<{ action?: string; message: string; content: string | null; changelog?: Array<{ tool: string; summary: string }>; steps?: number } | null>(null);
```

Near the other Surfy refs (e.g. just below `const surfyOpenRef = useRef(surfyOpen);`), add:
```ts
    const surfyMetaRef = useRef<{ metaTitle?: string; metaDescription?: string } | null>(null);
    const surfyOriginalRef = useRef<string>('');                  // pre-edit HTML, for the diff preview
    const surfyAbortRef = useRef<AbortController | null>(null);   // for Stop/Cancel
    const [surfyCompareOpen, setSurfyCompareOpen] = useState(false);
```

- [ ] **Step 2: Branch `handleSurfySubmit` by mode, with abort + original capture**

Replace the body of the `try {` block in `handleSurfySubmit` (the part that builds the request and sets `surfyResponse`) with:
```ts
        const htmlContent = editor.getHTML();
        const useAgent = !surfySelection; // article mode → multi-step agent
        const endpoint = useAgent ? '/api/articles/surfy-agent' : '/api/articles/ask-surfy';
        if (useAgent) surfyOriginalRef.current = htmlContent; // remember pre-edit HTML for the diff

        const ac = new AbortController();
        surfyAbortRef.current = ac;

        const body = useAgent
          ? {
              prompt,
              content: htmlContent,
              keyword: articleKeyword || keyword || '',
              scoreData: scoreData || null,
              internalArticles: internalArticles || [],
              articleTitle: metaTitle || '',
              articleMetaDescription: metaDescription || '',
              history: surfyHistory,
            }
          : {
              prompt,
              content: htmlContent,
              mode: 'selection',
              selectedText: surfySelection?.text || null,
              selectionRange: surfySelection ? { from: surfySelection.from, to: surfySelection.to } : null,
              scoreData: scoreData || null,
              internalArticles: internalArticles || [],
              keyword: articleKeyword || keyword || '',
              history: surfyHistory,
            };
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ac.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');

        if (useAgent) {
          surfyMetaRef.current = data.meta || null;
          setSurfyResponse({ action: 'replace_article', message: data.message, content: data.finalHtml || null, changelog: data.changelog || [], steps: data.steps });
        } else {
          surfyMetaRef.current = null;
          setSurfyResponse({ action: data.action, message: data.message, content: data.content });
        }
        setSurfyHistory((prev) => {
          const next = [...prev, { role: 'assistant' as const, message: data.message, content: data.finalHtml ?? data.content, action: data.action }];
          return next.length > MAX_SURFY_HISTORY ? next.slice(-MAX_SURFY_HISTORY) : next;
        });
        setSurfyPrompt('');
```

Then update the existing `catch`/`finally` of `handleSurfySubmit`. At the **top** of `catch (err: any)` add an early return so a user-cancel renders nothing instead of an error:
```ts
        if (err?.name === 'AbortError') return; // user pressed Stop
```
In `finally`, after `setSurfyLoading(false);`, add:
```ts
        surfyAbortRef.current = null;
```

> Note: this replaces the previous single `fetch('/api/articles/ask-surfy', …)` block and the two `setSurfyResponse`/`setSurfyHistory` calls that followed it. Keep the surrounding `setSurfyLoading`, `setSurfyResponse(null)`, and the optimistic user-message push exactly as they are.

- [ ] **Step 3: Apply staged meta in `handleSurfyApply`**

In `handleSurfyApply`, in the full-article `else` branch, replace:
```ts
      } else {
        // Full article mode
        if (surfyResponse.content) {
          editor.commands.setContent(surfyResponse.content);
        }
      }
```
with:
```ts
      } else {
        // Full article mode
        if (surfyResponse.content) {
          editor.commands.setContent(surfyResponse.content);
        }
        if (surfyMetaRef.current) {
          if (surfyMetaRef.current.metaTitle != null) onMetaTitleChange?.(surfyMetaRef.current.metaTitle);
          if (surfyMetaRef.current.metaDescription != null) onMetaDescriptionChange?.(surfyMetaRef.current.metaDescription);
          surfyMetaRef.current = null;
        }
      }
```

- [ ] **Step 4: Add Stop/Cancel to the loading state (#3)**

Find the loading block in the Surfy bar JSX:
```tsx
              {/* Loading state */}
              {surfyLoading && (
                <div style={{ padding: '1rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-family-primary)' }}>Thinking…</span>
                </div>
              )}
```
Replace with:
```tsx
              {/* Loading state */}
              {surfyLoading && (
                <div style={{ padding: '0.75rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-family-primary)' }}>Surfy is working…</span>
                  </div>
                  <button type="button" onClick={() => surfyAbortRef.current?.abort()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0.25rem 0.625rem', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>
                    Stop
                  </button>
                </div>
              )}
```

- [ ] **Step 5: Add the "what Surfy did" block — changelog + steps + meta + guard (#1, #4, #6)**

Immediately **above** the `{/* Action buttons for latest response */}` block, add:
```tsx
              {/* What Surfy did — steps / changelog (+ meta + guard) */}
              {surfyResponse && !surfyLoading && ((surfyResponse.changelog?.length ?? 0) > 0 || Boolean(surfyMetaRef.current)) && (
                <div style={{ padding: '0.25rem 0.625rem 0.5rem' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.45)', marginBottom: 4, fontFamily: 'var(--font-family-primary)' }}>
                    WHAT SURFY DID{typeof surfyResponse.steps === 'number' ? ` · ${surfyResponse.steps} steps` : ''}
                  </div>
                  {(surfyResponse.changelog || []).map((c, i) => {
                    const guard = c.tool === 'guard';
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, lineHeight: '18px', color: guard ? '#FFB454' : 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-family-primary)' }}>
                        <span style={{ flexShrink: 0 }}>{guard ? '⚠' : '✓'}</span>
                        <span>{c.summary}</span>
                      </div>
                    );
                  })}
                  {surfyMetaRef.current && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '2px 8px', borderRadius: 9999, background: 'rgba(120,58,251,0.18)', color: '#c4b5fd', fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>
                      ✎ Will update meta {surfyMetaRef.current.metaTitle != null && surfyMetaRef.current.metaDescription != null ? 'title + description' : surfyMetaRef.current.metaTitle != null ? 'title' : 'description'}
                    </div>
                  )}
                </div>
              )}
```

- [ ] **Step 6: Restructure the action buttons — add Preview, keep Apply/Dismiss (#2)**

Replace the entire action-buttons block:
```tsx
              {/* Action buttons for latest response */}
              {surfyResponse && !surfyLoading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem 0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => { setSurfyOpen(false); setSurfyResponse(null); setSurfyPrompt(''); setSurfyHistory([]); }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '0.375rem 0.75rem', borderRadius: 6,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500,
                      fontFamily: 'var(--font-family-primary)',
                    }}
                  >
                    Dismiss
                  </button>
                  {(surfyResponse.content || surfyResponse.action === 'delete_selection') && (
                    <button
                      type="button"
                      onClick={handleSurfyApply}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '0.375rem 0.75rem', borderRadius: 6,
                        background: '#783afb', border: 'none', cursor: 'pointer',
                        color: '#fff', fontSize: 13, fontWeight: 600,
                        fontFamily: 'var(--font-family-primary)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#5a1fd6'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#783afb'; }}
                    >
                      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                      Apply changes
                    </button>
                  )}
                </div>
              )}
```
with:
```tsx
              {/* Action buttons for latest response */}
              {surfyResponse && !surfyLoading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem 0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => { setSurfyOpen(false); setSurfyResponse(null); setSurfyPrompt(''); setSurfyHistory([]); surfyMetaRef.current = null; }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '0.375rem 0.75rem', borderRadius: 6,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500,
                      fontFamily: 'var(--font-family-primary)',
                    }}
                  >
                    Dismiss
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {surfyResponse.content && surfyOriginalRef.current && (
                      <button
                        type="button"
                        onClick={() => setSurfyCompareOpen(true)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '0.375rem 0.75rem', borderRadius: 6,
                          background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
                          color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500,
                          fontFamily: 'var(--font-family-primary)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                      >
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx={12} cy={12} r={3} /></svg>
                        Preview
                      </button>
                    )}
                    {(surfyResponse.content || surfyResponse.action === 'delete_selection' || surfyMetaRef.current) && (
                      <button
                        type="button"
                        onClick={handleSurfyApply}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '0.375rem 0.75rem', borderRadius: 6,
                          background: '#783afb', border: 'none', cursor: 'pointer',
                          color: '#fff', fontSize: 13, fontWeight: 600,
                          fontFamily: 'var(--font-family-primary)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#5a1fd6'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#783afb'; }}
                      >
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                        Apply changes
                      </button>
                    )}
                  </div>
                </div>
              )}
```

- [ ] **Step 7: Add suggested-prompt chips above the input (#5)**

Immediately **above** the `{/* Input row — always visible */}` block, add:
```tsx
              {/* Suggested prompts — only on a fresh, empty input (discovery) */}
              {!surfyPrompt.trim() && !surfyResponse && !surfyLoading && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0.25rem 0.5rem 0' }}>
                  {['Add missing keywords', 'Improve the weakest ranking signal', 'Add an FAQ section', 'Rewrite the intro'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setSurfyPrompt(s); surfyInputRef.current?.focus(); }}
                      style={{ padding: '4px 10px', borderRadius: 9999, background: 'rgba(255,255,255,0.06)', border: '1px solid #221e28', color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-family-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
```

- [ ] **Step 8: Render the diff modal (#2)**

Immediately **after** the early-alpha disclaimer block, add:
```tsx
              {surfyCompareOpen && surfyResponse?.content && (
                <CompareVersionsModal
                  original={surfyOriginalRef.current}
                  updated={surfyResponse.content}
                  terms={(scoreData?.terms || []).map((t) => t.term)}
                  onClose={() => setSurfyCompareOpen(false)}
                />
              )}
```

- [ ] **Step 9: Type-check**

```bash
npx tsc --noEmit
```
Expected: exits 0.

- [ ] **Step 10: Manual end-to-end test**

`npm run dev`, open an article, open Surfy (no selection). Verify:
1. **Suggestions:** with an empty input, the four suggestion chips appear; clicking one fills the input.
2. **Multi-step + changelog:** send *"Sprawdź których terminów NLP brakuje i dodaj sekcję FAQ pokrywającą 2, oraz ustaw meta description."* — during the run a **Stop** button shows; after, a "WHAT SURFY DID · N steps" list shows the *edits* made (✓ Inserted "FAQ", ✓ Updated meta tags) plus a "Will update meta description" chip. (The list reflects write actions from `changelog`; read steps are reflected only in the `· N steps` count — a richer per-read narrative is the deferred streaming UX.)
3. **Preview:** click **Preview** → the Compare-versions diff opens (original vs new). Close it.
4. **Apply / Dismiss:** **Apply changes** inserts the FAQ and updates the meta field; **Dismiss** discards both.
5. **Cancel:** start a request and press **Stop** mid-run → no error is shown, the input returns.
6. **Selection mode** still routes to `ask-surfy` and works as before.

- [ ] **Step 11: Commit**

```bash
git add components/articles/ArticleEditor.tsx
git commit -m "feat(surfy): article-mode agent + UX (changelog, diff preview, cancel, suggestions)"
```

> **Deferred UX (Phase 2–4, intentionally not now):** live-streamed step display (needs `streamText`
> + SSE), per-edit accept/reject (needs granular change tracking), highlighting changed blocks in the
> editor after Apply (ProseMirror decorations), and an "Ask only / Allow edits" scope toggle.

---

## Task 9: Final verification & docs

**Files:**
- Modify: `docs/specs/2026-06-29-surfy-tool-calling-phase1.md` (mark Phase 1 done; note selection mode still on `ask-surfy`)

- [ ] **Step 1: Full type + test sweep**

```bash
cd /c/Users/patry/Desktop/serpbear
npx tsc --noEmit
npx jest __tests__/lib/ai
```
Expected: `tsc` exits 0; all `__tests__/lib/ai/*` suites PASS.

- [ ] **Step 2: Manual regression of both paths**

Confirm in the dev app:
1. Article mode → multi-step agent (edits + meta apply + analysis-only).
2. Selection mode → still uses `ask-surfy` (unchanged behavior).
3. An image-heavy article does not blow the context (base64 stripped) and images survive after Apply.

- [ ] **Step 3: Note the follow-up in the spec**

Append to the spec's "Out of scope" section a line confirming Phase 1 shipped article-mode only and selection mode remains on `pages/api/articles/ask-surfy.ts` (to be migrated in Phase 2). Commit:
```bash
git add docs/specs/2026-06-29-surfy-tool-calling-phase1.md
git commit -m "docs(surfy): mark Phase 1 implemented (article mode); selection mode pending"
```

- [ ] **Step 4: Update the knowledge graph**

```bash
cd /c/Users/patry/Desktop/serpbear
graphify update .
```

---

## Self-Review notes (verify before/while executing)

- **Spec coverage:** Engine A (AI SDK + DeepSeek) → Tasks 0,6,7. Server-authoritative cheerio working copy → Task 1,7. `data-sid` handles → Task 1 (annotate) + Task 4 (target) + Task 7 (strip). 8 Phase-1 tools → Tasks 3–4. Read/write split → Tasks 3/4. System prompt with outline → Task 5. Base64 token safety → Task 1 + Task 7. Bounded loop (`isStepCount(8)`) → Task 7. Apply/Dismiss + meta → Task 8. Selection mode left on old endpoint → Task 8 (branch) + Task 9 (note). Conversation memory → already shipped (history passed through; agent route forwards `priorTurns`).
- **Review-driven additions covered (round 1):** stale-sid/outline fix (`reindexSids` after every write + fresh `outline` in write-tool results) → Task 1 + Task 4 + Task 5 (strategy note); `read_block` + `get_outline` → Task 3; HTML sanitization (`sanitizeFragment`) → Task 1 + Task 4; runaway-edit cap (`MAX_WRITES=12`) → Task 3 (const) + Task 4 (guards); empty-output guard → Task 7; `remove` op + heading `level` → Task 4.
- **Review-driven additions covered (round 2):** read-tool purity — `get_outline` uses pure `buildOutline`, only writes call `reindexSids` → Task 1 + Task 3; `read_block` returns `outerHtml` → Task 3; invalid-nesting guard (`wouldNestBlock`) on `apply_edit replace` into `<p>`/headings → Task 3 (helper) + Task 4 (guard) + Task 5 (rule). Deferred (with rationale): JSON outline — kept compact text form for token cost; `buildOutline` is the single seam to switch later.
- **UX shipped with the backend (Task 8):** (1) "what Surfy did" changelog + step count, (2) **Preview** diff before Apply (reuses `CompareVersionsModal`), (3) **Stop/Cancel** via `AbortController`, (4) meta-change chip, (5) suggested-prompt chips, (6) friendly limit/guard line (renders the `guard` changelog entry in amber). The response shape `{ message, finalHtml, meta, changed, changelog, steps }` (Task 7) feeds all of these. Deferred UX (streaming steps, per-edit accept/reject, changed-block highlight, ask-only toggle) noted at the end of Task 8.
- **No outward/destructive actions** in Phase 1 (no publish/social/delete tools) — matches spec guardrails.
- **API names** (`generateText`, `tool`, `isStepCount`, `createDeepSeek`, `inputSchema`) verified against `ai@7.0.4` docs; Task 0 Step 3 re-confirms against the installed build and is the source of truth if anything drifted.
- **Type consistency:** `ToolCtx` fields (`$, keyword, scoreData, internalArticles, articleTitle, articleMetaDescription, changelog, htmlDirty, meta`) are identical across Tasks 2,3,4,5,7,8. `buildTools(ctx)` returns the 7 tool keys used in tests and the route. Response shape `{ message, finalHtml, meta, changed, changelog, steps }` is produced in Task 7 and consumed in Task 8.
- **Known caveat to watch during execution:** if `scoreContentClient` imports server-only modules that break Jest, the read-tools test (Task 3) mocks it via `jest.mock` — keep that mock.
