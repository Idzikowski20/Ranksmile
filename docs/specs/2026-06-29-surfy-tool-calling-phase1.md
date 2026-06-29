# Spec — Surfy Tool-Calling Agent (Phase 1)

> **Update (v2):** External review accepted. The implementation plan
> (`docs/plans/2026-06-29-surfy-tool-calling-phase1.md`, "Review responses" section) folds in the
> review's critical points: sids are **re-indexed after every write** and the **fresh outline is
> returned in each write-tool result**; new **`read_block`** / **`get_outline`** navigation tools;
> **HTML sanitization** of model output; a **per-turn write cap**; an **empty-output guard**; plus a
> `remove` op and heading `level`. The deferred items (op zoo, granular change-tracking, full
> rollback, ctx-splitting, full telemetry) are documented there with rationale.

> **For the reviewer (e.g. ChatGPT):** You have no prior knowledge of this codebase.
> This document is written to give you all the context you need to review the plan.
> Read the "Short note" and "Background" first, then the design. At the end there is a
> list of explicit review questions. Please be critical: flag risks, simpler approaches,
> wrong assumptions, and anything under-specified.

---

## Short note — what this is, in one paragraph

We have an SEO writing app with an in-editor AI assistant called **"Surfy"**. Today Surfy
is **single-shot**: the user types a prompt, the server sends the whole article + some
context to an LLM in **one** request, and gets back one block of text/HTML to apply. It
**cannot** do multi-step work, it **cannot** fetch data on demand (e.g. "what keywords am I
missing?"), and it has **no real tools**. We want to turn Surfy into a proper **tool-calling
agent** (like the AI in Twenty CRM): the model can call named tools, read results, and loop —
analyze the article, compute its SEO score, find missing terms, then edit the HTML — across
multiple steps, in one user turn. **Phase 1** (this spec) builds the foundation: the agent
loop on top of the Vercel AI SDK + DeepSeek, a small tool registry, 4 read tools and 2 write
tools, and wires the result into the editor's existing "Apply / Dismiss" UI. Later phases add
more tools (plagiarism, AI-search score, competitor outlines, WordPress publishing, etc.).

**What changes in code:** one new API route (the agent loop), a new `lib/ai/` folder (tool
registry + tool definitions + system prompt), and a small change to the client to call the new
route and render multi-step results. The old single-shot endpoint stays until Phase 1 is
validated, then is removed.

---

## Background (so the reviewer understands the system)

- **App:** a "SerpBear + SurferSEO" clone. SEO rank tracking + an AI **Content Editor** where
  users write articles and optimize them for a target keyword.
- **Stack:**
  - Frontend + API: **Next.js 12, pages-router**, React 18, TypeScript. API routes live in
    `pages/api/**`. (Pages-router API routes use `(req, res)` handlers, **not** the App-router
    `Request`/`Response` style.)
  - Editor: **Tiptap v3** (ProseMirror). The article body is HTML. The editor exposes
    `editor.getHTML()` and `editor.commands.setContent(html)`.
  - **Python sidecar** (FastAPI, deployed separately on Render): does heavy SEO scoring,
    AI-readability, plagiarism, etc. Called from Next API routes via `callSidecar('/route', body)`.
  - **LLM:** **DeepSeek** (`deepseek-chat`), OpenAI-compatible Chat Completions API. Today the
    app calls it with a raw `fetch` to `https://api.deepseek.com/v1/chat/completions`. DeepSeek
    supports OpenAI-style **function/tool calling** (`tools`, `tool_choice`).
- **Current Surfy implementation:** `pages/api/articles/ask-surfy.ts`. It builds a big system
  prompt (article HTML + SEO score breakdown + internal-link targets) and does ONE DeepSeek
  call. It returns `{ action, message, content }` where `content` is HTML to apply. The client
  shows "Apply changes / Dismiss" buttons.
- **Important existing helpers we will reuse as tools:**
  - `lib/contentScore.ts` — `ScoreData` type (NLP `terms[]` with `target_count`, plus
    word/heading/paragraph targets, `paa_questions`, `competitor_count`) and
    `countOccurrences(text, term)`.
  - `lib/seo/scoreContentClient.ts` — `scoreContent(html, keyword, scoreData, title, meta)` →
    returns `ranking_signals` (X-Algorithm-style signal scores + recommendations).
  - The client already passes `scoreData` and `internalArticles` (`[{id,title,url}]`) into Surfy.
- **A token-safety detail already in place:** articles can contain **base64 data-URL images**
  (`<img src="data:...">`) which are megabytes. The current endpoint strips them to placeholders
  before sending to the LLM and restores them on the response. The new agent must do the same.

---

## Goal of Phase 1

Replace Surfy's single-shot call with a **multi-step tool-calling agent** that can, in one user
turn: (a) **read** the article's score / missing terms / ranking signals / internal-link
targets via tools, and (b) **write** targeted edits to the article HTML via tools — looping
until done — then return the final HTML for the user to Apply/Dismiss.

**Success criteria (Phase 1):**
1. A prompt like *"Find which NLP terms I'm missing and add a short paragraph covering the top 3"*
   results in the model calling `list_missing_terms`, then `apply_edit`/`insert_section`, and
   returning edited HTML + a human summary.
2. The loop is bounded (`maxSteps`), validated (Zod), and never sends megabyte base64 to the LLM.
3. The existing "Apply / Dismiss" UX still works; applying sets the new HTML in the editor.
4. Conversation memory works (already fixed separately — the agent receives prior turns).
5. No outward/destructive actions in Phase 1 (no publishing, no deletes that can't be undone).

---

## Architecture

### Engine: Vercel AI SDK + DeepSeek ("Engine A")

We use the **Vercel AI SDK** (`ai` package) with the **`@ai-sdk/deepseek`** provider
(fallback: `@ai-sdk/openai-compatible` pointed at `https://api.deepseek.com`). The AI SDK gives
us the **automatic multi-step tool loop** for free via `generateText({ tools, stopWhen })`:

- We pass the model `tools` (each a Zod-schema'd object with an `execute` function).
- `generateText` calls the model; if the model emits tool calls, the SDK **executes** them,
  appends results to the message list, and **calls the model again** — repeating until the model
  stops calling tools or `stopWhen` (a step cap) triggers.
- This is exactly Twenty CRM's pattern (Twenty uses `streamText`); we use the **non-streaming**
  `generateText` in Phase 1 (streaming the steps to the UI is Phase 4).

> Why the SDK instead of hand-rolling the loop on our existing `fetch`? The SDK handles
> tool-call parsing, result injection, the re-call loop, and malformed-tool-call repair. It is
> less glue and closer to a known-good reference (Twenty). The trade-off is +1 dependency.

### Server-authoritative HTML working copy

The Tiptap editor is **client-side**, but the agent loop runs **server-side**. So write tools
do **not** touch the editor directly. Instead:

1. Client sends the current article HTML to the agent route.
2. Server keeps an in-memory **working copy** of the HTML using **`cheerio`** (already a
   dependency — server-side jQuery-like DOM).
3. **Write tools mutate the cheerio working copy.** They return only a short success message to
   the model (NOT the whole HTML — keeps tokens low).
4. **Read tools** call our real scoring helpers/sidecar using the **current** working HTML.
5. When the loop ends, if any write tool ran, the server returns the **final HTML**
   (`$.html()`), a `changelog`, and the assistant's text message.
6. Client shows the message + changelog in the chat and, if HTML changed, the existing
   **Apply** button runs `editor.commands.setContent(finalHtml)`; **Dismiss** discards.

This keeps the current Apply/Dismiss UX and undo semantics (one atomic content swap), while
enabling true multi-step server-side reasoning.

### Giving the model stable edit handles (`data-sid`)

Tiptap HTML has no element IDs, so the model can't reliably target "the 3rd paragraph" with a
CSS selector. Before sending the article to the model, the server **annotates each top-level
block** (`h1..h4, p, ul, ol, blockquote, table, ...`) with a stable attribute
`data-sid="N"` (sequential). Write tools target elements by `sid`. After the loop, the server
**strips all `data-sid` attributes** from the final HTML so they never reach the saved article.

- The system prompt includes an **outline** of the article: each block's `sid`, tag, and a short
  text preview, so the model knows what it can target without us sending huge HTML twice.

### Scope of edits in Phase 1

- **Article mode** (no text selected): fully supported. The agent reasons over the whole
  article and edits via `sid`-targeted tools.
- **Selection mode** (user selected text): **out of scope for Phase 1.** When a selection is
  present we keep the existing single-shot endpoint for now (precise selection→cheerio mapping is
  Phase 2). *(Reviewer: please sanity-check this scoping.)*

---

## The agent loop (pseudocode)

```ts
// pages/api/articles/surfy-agent.ts  (new)
import { generateText, stepCountIs } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });

export default async function handler(req, res) {
  // auth (verifyUser), method check, parse body
  const { prompt, content, keyword, scoreData, internalArticles, history } = req.body;

  // 1. strip base64 images -> placeholders (reuse existing helper), keep restore map
  const { stripped, imageMap } = stripDataImages(content);

  // 2. annotate blocks with data-sid via cheerio, build an outline string
  const ctx = makeWorkingDoc(stripped); // { $, outline, articleId, keyword, scoreData, ... }

  // 3. build the tool set (registry), bound to this request's ctx
  const tools = buildTools(ctx);

  // 4. run the bounded multi-step loop
  const result = await generateText({
    model: deepseek('deepseek-chat'),
    system: buildSystemPrompt(ctx),        // role + outline + score summary + tool guidance
    messages: [...priorTurns(history), { role: 'user', content: prompt }],
    tools,
    stopWhen: stepCountIs(8),              // hard cap on steps
  });

  // 5. finalize: if any write tool ran, emit final HTML (strip data-sid, restore images)
  const changed = ctx.dirty;
  const finalHtml = changed ? restoreDataImages(stripSids(ctx.$.html()), imageMap) : null;

  return res.status(200).json({
    message: result.text,
    finalHtml,
    changed,
    changelog: ctx.changelog,              // [{ tool, summary }]
    steps: result.steps.length,
  });
}
```

---

## Tool registry & tool definitions (Phase 1)

All tools live in `lib/ai/tools.ts`. A tool is:

```ts
interface SurfyTool {
  description: string;
  inputSchema: z.ZodType;                  // Zod -> validated by the AI SDK
  execute: (input, ctx: ToolCtx) => Promise<ToolResult>;
}
type ToolResult = { ok: boolean; summary: string; data?: unknown };
```

`ctx` (per-request) carries: `$` (cheerio root), `outline`, `keyword`, `scoreData`,
`internalArticles`, `articleTitle`, `articleMetaDescription`, a `changelog[]`, and a `dirty`
flag set by write tools.

### Read tools (no mutation — they only inform the model)

| Tool | Input | Returns | Backed by |
|---|---|---|---|
| `get_content_score` | — | words/headings/paragraphs vs targets + per-term coverage | `buildScoreContext`-style logic over `scoreData` + current working text |
| `list_missing_terms` | `{ limit?: number }` | NLP terms with `current < min` (the gaps) | `scoreData.terms` + `countOccurrences` on working text |
| `get_ranking_signals` | — | X-Algorithm ranking score + weakest signals + fix tactics | `scoreContent(html, keyword, scoreData, title, meta)` |
| `list_internal_link_targets` | `{ query?: string }` | candidate internal articles `{title, url}` | `internalArticles` (already passed from client) |

### Write tools (mutate the cheerio working copy; set `dirty`, push to `changelog`)

| Tool | Input | Effect |
|---|---|---|
| `apply_edit` | `{ sid: number, op: 'replace'|'append'|'prepend', html: string }` | edit the block with that `data-sid` |
| `insert_section` | `{ heading: string, html: string, position: 'start'|'end'|'after_sid'|'before_sid', sid?: number }` | insert a new `<h2>heading</h2>` + body at a position |
| `set_meta` | `{ metaTitle?: string, metaDescription?: string }` | not an HTML edit — recorded and returned to the client to apply to meta fields |

> Phase-1 deliberately keeps write tools small and **non-destructive** (no delete tool, no
> outward actions). `set_meta` returns its values in the response for the client to apply via
> the existing `onMetaTitleChange/onMetaDescriptionChange` callbacks (it does not change the
> article HTML).

---

## Data contracts

### Request (client → `POST /api/articles/surfy-agent`)
```jsonc
{
  "prompt": "string",
  "content": "string (full article HTML)",
  "keyword": "string",
  "scoreData": { /* ScoreData | null */ },
  "internalArticles": [{ "id": 1, "title": "...", "url": "..." }],
  "history": [{ "role": "user"|"assistant", "message": "string" }]  // prior turns, excl. current
}
```

### Response (server → client)
```jsonc
{
  "message": "string (assistant's human-facing summary)",
  "finalHtml": "string | null",     // present iff an edit was made
  "changed": true,
  "changelog": [{ "tool": "apply_edit", "summary": "Rewrote intro to add 'X'" }],
  "meta": { "metaTitle": "?", "metaDescription": "?" },  // present iff set_meta ran
  "steps": 4
}
```

### Client behavior
- Render `message` (and optionally `changelog`) in the Surfy chat history.
- If `changed && finalHtml`: show **Apply** (→ `editor.commands.setContent(finalHtml)`) and
  **Dismiss**, exactly like today.
- If `meta` present: on Apply, also call the existing meta-change callbacks.

---

## Files to create / modify

**Create**
- `lib/ai/deepseek.ts` — configured `@ai-sdk/deepseek` provider instance.
- `lib/ai/workingDoc.ts` — `stripDataImages` (moved/shared), `makeWorkingDoc` (cheerio + `data-sid`
  annotation + outline), `stripSids`, `restoreDataImages`.
- `lib/ai/tools.ts` — `ToolCtx`, `SurfyTool`, the 6 Phase-1 tools, `buildTools(ctx)`.
- `lib/ai/systemPrompt.ts` — `buildSystemPrompt(ctx)`.
- `pages/api/articles/surfy-agent.ts` — the agent route (loop above).

**Modify**
- `components/articles/ArticleEditor.tsx` — `handleSurfySubmit` calls the new route (in article
  mode) and renders `changelog`; Apply applies `finalHtml` (+ `meta`).
- `package.json` — add `ai`, `@ai-sdk/deepseek`, `zod` (pinned, versions verified at install).

**Leave intact (Phase 1)**
- `pages/api/articles/ask-surfy.ts` — still used for **selection mode** until Phase 2; removed
  once the agent path is validated.

---

## Guardrails & safety

- **Bounded loop:** `stopWhen: stepCountIs(8)` (tunable). Prevents runaway tool loops.
- **Input validation:** every tool input is a Zod schema; the SDK rejects/repairs bad calls.
- **Token safety:** base64 images stripped before the model sees anything; the full HTML is sent
  **once** (in the outline/system prompt), not per step. Working HTML is mutated server-side, not
  re-sent each turn.
- **No outward/destructive actions in Phase 1.** No WordPress publish, no social posting, no
  deletes. Those are Phase 3 and will require explicit user confirmation.
- **Auth & tenancy:** the route runs `verifyUser` like every other route. (Phase 1 tools operate
  only on the article HTML the client already has open + data already passed in; they do not read
  other users' data. When Phase 2 adds DB-backed tools, they must scope by the caller's workspace.)
- **Determinism of edits:** `data-sid` handles make edits target real blocks; if a `sid` doesn't
  exist, the write tool returns `{ ok:false, summary:"sid N not found" }` so the model can recover.

---

## Risks & open questions

1. **DeepSeek tool-calling reliability.** `deepseek-chat` supports tools but is less battle-tested
   than GPT-4 for long tool chains. Mitigation: small tool set, low step cap, clear schemas.
   *Open: do we need a fallback/repair path if DeepSeek emits malformed tool calls?*
2. **AI SDK ↔ DeepSeek provider compatibility / versions.** We must pin `ai` and `@ai-sdk/deepseek`
   to compatible versions and verify tool-calling actually works end-to-end before building on it.
3. **Full-content replacement vs. granular edits.** Applying `finalHtml` via `setContent` replaces
   the whole document (one undo step). Acceptable for Phase 1; a diff/patch apply is a later polish.
4. **Selection mode left on the old path.** Is splitting article-mode (new) vs selection-mode (old)
   acceptable for one release, or should Phase 1 cover both?
5. **`data-sid` correctness** across nested structures (lists, tables). Phase 1 annotates only
   **top-level** blocks; edits inside nested nodes are coarse (whole-block replace). OK?
6. **Cost/latency.** Multi-step = multiple LLM calls per turn. Step cap + concise tool outputs keep
   it bounded, but a heavy turn could be ~3–6 calls. Acceptable?

---

## Status

**Phase 1 implemented** (commits `14cfb58`…`f4ece09` on `main`). Article-mode chat now runs the
multi-step agent (`pages/api/articles/surfy-agent.ts`, engine = AI SDK `generateText` + tools over
a cheerio working copy); the client (`ArticleEditor.tsx`) ships the UX (changelog, diff Preview,
Stop/Cancel, meta chip, suggestions, guard). **Selection mode** still uses the single-shot
`pages/api/articles/ask-surfy.ts` (to be migrated in Phase 2). Verified: 21/21 unit tests, full
`tsc --noEmit` clean, real-DeepSeek agent-loop smoke (5 steps, edited the article), and a full
`next build` (Next 12 + TypeScript 5.4.5 — TS bumped because the AI SDK ships TS5 `.d.cts` types).

**Phase 2 implemented** (commits `e80cdd7`…`b819162` on `main`, plan
`docs/plans/2026-06-29-surfy-tool-calling-phase2.md`). Four DB+sidecar-backed READ tools added —
`get_ai_search_score`, `check_plagiarism`, `fetch_competitor_outline`, `get_headings_outline` — with
`resolveArticleSeoMeta` (DB) + a per-run `ToolCache` (memoizes seoMeta and each sidecar result),
`articleId` threaded client→route→`ToolCtx`, and the tools advertised in the system prompt. Verified:
31/31 unit tests, `tsc --noEmit` clean. (`next build` deferred locally to avoid clobbering the running
dev `.next`; Phase 1 already proved the toolchain builds and the Phase 2 changes are additive TS.)
**Selection-mode precise edits remain deferred** (ProseMirror↔cheerio position mapping is fragile;
selection mode keeps using the single-shot `ask-surfy` route).

## Out of scope (future phases)

- **Phase 2 (advanced read):** ✅ shipped — `get_ai_search_score`, `check_plagiarism`,
  `fetch_competitor_outline`, `get_headings_outline`. Precise **selection-mode** edits still deferred.
- **Phase 3 (actions, with confirmation):** `publish_to_wordpress`, `generate_social_posts`,
  `apply_readability`.
- **Phase 4 (polish):** stream tool steps to the UI in real time; a meta-tool catalog
  (`get_tool_catalog`/`learn_tools`) if the tool count grows large; per-action confirmation gates.

---

## Review questions for ChatGPT

Please answer these explicitly:

1. Is the **server-authoritative cheerio working copy** the right model for editing a *client-side*
   Tiptap document, or is there a cleaner approach (e.g. returning a list of operations the client
   applies)?
2. Is the **`data-sid` handle** approach sound for letting the model target blocks reliably? Any
   failure modes (collisions, nested blocks, model inventing sids)?
3. Is **`generateText` + `stopWhen: stepCountIs(8)`** the correct AI-SDK primitive for a bounded
   multi-step tool loop, and are the **tool-definition shapes** (Zod `inputSchema` + `execute`)
   correct for the current AI SDK?
4. Is the **read/write tool split** and the **Phase-1 tool set** reasonable, or is something missing
   that would make the very first version meaningfully more useful?
5. Are there **safety gaps** (token blowups, runaway loops, tenancy, accidental destructive edits)
   not covered by the guardrails section?
6. Is **leaving selection-mode on the old single-shot endpoint** acceptable for Phase 1, or does the
   split create UX/maintenance problems we should avoid?
7. Anything **over-engineered** for a Phase-1 MVP that we should cut?
