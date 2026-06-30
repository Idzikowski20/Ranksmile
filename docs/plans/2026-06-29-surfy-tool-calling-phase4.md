# Surfy Tool-Calling Agent — Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Make the article-mode Surfy agent **stream live** — the user sees each tool step and the
assistant's text as they happen (not a 30–90s black-box spinner) — plus a **token-usage circle**
(Twenty-style ring) in the Surfy bar, and a **meta-tool catalog** tool the model can call to discover
its tools.

**Architecture:** Rewrite `surfy-agent.ts` from non-streaming `generateText` to **`streamText`**, and
stream its `fullStream` parts to the client as **Server-Sent Events** over `res.write` (Next 12 pages
API). Event types: `text` (assistant delta), `step` (tool started/finished), `usage` (running token
total), and a terminal `done` carrying `{ finalHtml, meta, pendingAction, changelog }` (built from the
mutated `ctx` after the stream drains). The client reads `res.body` as a stream, renders a live
activity list + the `TokenCircle`, and applies the existing final logic on `done`. The tools, `ctx`,
working-copy/cheerio model, and the Phase 3 publish card are **unchanged**.

**Tech Stack:** Same (`ai@7.0.4` — `streamText`, `fullStream`, `totalUsage`; cheerio; Jest; TS 5.4.5).

**Verified ground truth (do not re-derive):**
- `ai@7.0.4` exports `streamText`; its result has `fullStream` (async-iterable of typed parts),
  `totalUsage` (Promise of aggregated usage), and accepts `onStepFinish` + `abortSignal`.
- Current route: `generateText({ model, system, messages, tools, stopWhen: isStepCount(8) })`, then
  returns one JSON `{ message, finalHtml, meta, changed, changelog, steps, pendingAction }`.
  `export const config = { maxDuration: 300, api: { responseLimit: '10mb' } }`.
- The tools mutate `ctx` ($, meta, changelog, htmlDirty, writeCount, pendingAction) **during**
  execution; after the stream drains, `ctx` is final. `finalHtml` is built post-loop from `ctx.$`
  (`stripSids` + `restoreDataImages`, empty-guard) exactly as today.
- Client `handleSurfySubmit` (`ArticleEditor.tsx`): `useAgent` branch POSTs to `/api/articles/surfy-agent`
  and does `const data = await res.json()` (line ~1127), then `setSurfyResponse({...})`. There's an
  `AbortController` (`surfyAbortRef`) wired to the Stop button. The Surfy bar is dark-themed.
- `components/ui/Gauge.tsx` is light-themed + 0–100 score-colored (red=low) → NOT reused for tokens;
  a focused dark `TokenCircle` is the right unit.
- `result.usage`/`totalUsage` shape: `{ inputTokens, outputTokens, totalTokens }` (may be partial;
  guard with `?? 0`).

---

## Design decisions (confirm at review)

1. **Full `streamText` (CONFIRMED with user).** Stream both tool steps and the assistant text.
2. **Transport = SSE over `res.write`** (not the SDK's `toUIMessageStreamResponse`, which targets the
   app-router/`useChat`). We hand-roll a tiny SSE writer so the pages-API route + our bespoke client
   reader stay in full control of the event shape (and the terminal `done` payload carries the
   cheerio `finalHtml` that the SDK stream doesn't know about). **Vercel note:** Node serverless
   functions support streaming; we set `Content-Type: text/event-stream`, `Cache-Control:
   no-cache, no-transform`, `X-Accel-Buffering: no`, and never gzip the stream.
3. **Token circle = this-turn usage toward a soft budget.** `TokenCircle` shows the running
   `totalTokens` of the CURRENT turn, ring filling toward `TOKEN_BUDGET = 60_000` (a "this is a big
   turn" reference; DeepSeek's context is larger but a turn rarely exceeds it), centre label
   formatted `12.3k`. **Flag for review:** per-turn (default) vs cumulative-session, and the 60k
   value — both easy to change (one constant + whether we reset on new turn).
4. **Meta-tool catalog is ADDITIVE.** `get_tool_catalog` returns the categorized tool list
   (name + one-liner). We do NOT trim the system-prompt tool list (11 tools fit fine) — the catalog
   is forward-looking discovery, so there's zero risk of the model failing to find a tool. (If the
   count later explodes, a follow-up can slim the prompt and lean on the catalog.)
5. **Abort:** `req.on('close')` → `AbortController.abort()` passed to `streamText({ abortSignal })`,
   so the existing Stop button (client `fetch` abort closes the socket) actually halts the model.
6. **Selection mode unchanged** — `ask-surfy` stays a single JSON response; only the agent branch streams.

---

## File Structure

| File | Change | Task |
|---|---|---|
| `lib/ai/sse.ts` | NEW — tiny SSE event writer + `formatTokens` | P4-T1 |
| `pages/api/articles/surfy-agent.ts` | rewrite to `streamText` + SSE `fullStream` → events + `done` | P4-T1 |
| `lib/ai/tools.ts` | add `get_tool_catalog` | P4-T2 |
| `lib/ai/systemPrompt.ts` | advertise `get_tool_catalog` | P4-T2 |
| `__tests__/lib/ai/tools.phase4.test.ts` | NEW — `get_tool_catalog` test | P4-T2 |
| `components/articles/TokenCircle.tsx` | NEW — dark ring, `12.3k` centre, budget fill | P4-T3 |
| `__tests__/.../sse.test.ts` | NEW — `formatTokens` + `sseEvent` formatting | P4-T1/T3 |
| `components/articles/ArticleEditor.tsx` | consume the SSE stream; live activity list + TokenCircle | P4-T4 |

---

## P4-T1: streaming route (`streamText` + SSE)

**Files:** Create `lib/ai/sse.ts`; rewrite `pages/api/articles/surfy-agent.ts`; test `__tests__/lib/ai/sse.test.ts`.

- [ ] **Step 1: `lib/ai/sse.ts`** — pure helpers (unit-testable, no I/O):
  ```ts
  // One SSE frame. data is JSON-encoded; event names group client handling.
  export function sseEvent(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }
  // Compact token label: 980 → "980", 12345 → "12.3k".
  export function formatTokens(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return '0';
    return n < 1000 ? String(Math.round(n)) : `${(n / 1000).toFixed(1)}k`;
  }
  ```

- [ ] **Step 2: Failing test** `__tests__/lib/ai/sse.test.ts`: `sseEvent('step', {a:1})` ===
  `'event: step\ndata: {"a":1}\n\n'`; `formatTokens(980)==='980'`, `formatTokens(12345)==='12.3k'`,
  `formatTokens(0)==='0'`.

- [ ] **Step 3: Rewrite the route.** Read the CURRENT route first (keep the body parse, `stripDataImages`,
  `makeWorkingDoc`, ctx build, history mapping, and the post-loop `finalHtml` build verbatim — only the
  model call + response transport change). New shape:
  ```ts
  import { streamText, isStepCount } from 'ai';
  import { sseEvent } from '../../../lib/ai/sse';
  // ... existing imports + ctx setup unchanged ...

  // SSE headers (Vercel Node streaming).
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (event: string, data: unknown) => { res.write(sseEvent(event, data)); (res as any).flush?.(); };

  // Abort when the client disconnects (Stop button closes the socket).
  const ac = new AbortController();
  req.on('close', () => ac.abort());

  let runningTokens = 0;
  try {
    const result = streamText({
      model: deepseek('deepseek-chat'),
      system: buildSystemPrompt(ctx, outline),
      messages: [...priorTurns, { role: 'user', content: prompt }],
      tools: buildTools(ctx),
      stopWhen: isStepCount(8),
      abortSignal: ac.signal,
      onStepFinish: ({ usage }) => {
        runningTokens = usage?.totalTokens ?? runningTokens;
        send('usage', { totalTokens: runningTokens });
      },
    });

    // Drain fullStream → SSE. Part shapes per ai@7 (VERIFY in node_modules/ai/dist/index.d.ts
    // during impl): 'text-delta' (text), 'tool-call' (toolName), 'tool-result' (toolName), 'error'.
    for await (const part of result.fullStream) {
      if (ac.signal.aborted) break;
      switch (part.type) {
        case 'text-delta':
          send('text', { delta: (part as any).text ?? (part as any).textDelta ?? '' });
          break;
        case 'tool-call':
          send('step', { phase: 'start', tool: (part as any).toolName });
          break;
        case 'tool-result':
          send('step', { phase: 'end', tool: (part as any).toolName });
          break;
        case 'error':
          send('error', { error: String((part as any).error?.message || (part as any).error || 'stream error') });
          break;
        default:
          break; // step-start/step-finish/finish handled via onStepFinish + totalUsage
      }
    }

    const finalUsage = await result.totalUsage.catch(() => undefined);
    const message = await result.text.catch(() => '');

    // Build finalHtml from the mutated ctx — SAME logic as the old route.
    const finalHtml = /* stripSids + restoreDataImages + empty-guard, copied from current route */;

    send('done', {
      message,
      finalHtml,
      meta: ctx.meta,
      changed: Boolean(finalHtml) || Boolean(ctx.meta),
      changelog: ctx.changelog,
      pendingAction: ctx.pendingAction,
      usage: { totalTokens: finalUsage?.totalTokens ?? runningTokens },
    });
    res.end();
  } catch (e: any) {
    send('error', { error: e?.message || 'agent failed' });
    res.end();
  }
  ```
  Keep `export const config = { maxDuration: 300, api: { responseLimit: '10mb' } }`. Remove the old
  `res.status(200).json(...)`. Note: error cases that previously `return res.status(4xx).json()` BEFORE
  streaming starts (auth, missing prompt, no API key) must still send JSON + status (don't switch those
  to SSE) — only switch to SSE AFTER the validations pass and `ctx` is built.

- [ ] **Step 4:** `npx jest __tests__/lib/ai/sse.test.ts` (green); `npx jest __tests__/lib/ai` (all
  green); `npx tsc --noEmit` (0). (The route itself is integration-tested manually in P4-T5; the
  `fullStream` part union is verified against the SDK d.ts during this step.)

- [ ] **Step 5:** Commit `lib/ai/sse.ts pages/api/articles/surfy-agent.ts __tests__/lib/ai/sse.test.ts`
  → `feat(surfy): stream the agent via streamText + SSE`.

---

## P4-T2: `get_tool_catalog` meta-tool

**Files:** `lib/ai/tools.ts`, `lib/ai/systemPrompt.ts`; test `__tests__/lib/ai/tools.phase4.test.ts`.

- [ ] **Step 1: Failing test** — `get_tool_catalog.execute({})` returns `{ tools: [...] }` whose entries
  have `name` + `category` + `description`, and includes known names (`get_content_score`, `apply_edit`,
  `publish_to_wordpress`). Factory-mock `./articleMeta` (DB) as in phase2/3.

- [ ] **Step 2:** run → FAIL.

- [ ] **Step 3: Implement** (add near the top of `buildTools`'s `return {}`, after `read_block`). A static
  catalog (categorized) so the model can discover tools without bloating the prompt:
  ```ts
    get_tool_catalog: tool({
      description: 'List every tool you can call, with its category and a one-line purpose. Call this if you are unsure what is available.',
      inputSchema: z.object({}),
      execute: async () => ({
        tools: [
          { category: 'read', name: 'get_content_score', description: 'word/heading counts vs targets + term coverage' },
          { category: 'read', name: 'list_missing_terms', description: 'NLP terms the article under-uses' },
          { category: 'read', name: 'get_ranking_signals', description: 'ranking score + weakest signals' },
          { category: 'read', name: 'list_internal_link_targets', description: 'internal articles to link to' },
          { category: 'read', name: 'get_ai_search_score', description: 'AI-search visibility + citation/extractability' },
          { category: 'read', name: 'check_plagiarism', description: 'uniqueness % + flagged passages' },
          { category: 'read', name: 'fetch_competitor_outline', description: 'PAA + competitor heading outlines' },
          { category: 'read', name: 'get_headings_outline', description: "the article's own heading hierarchy" },
          { category: 'navigate', name: 'get_outline', description: 'current outline (sid + tag + preview)' },
          { category: 'navigate', name: 'read_block', description: 'exact tag/text/HTML of one sid' },
          { category: 'write', name: 'apply_edit', description: 'edit/remove a block by sid' },
          { category: 'write', name: 'insert_section', description: 'add a heading + body section' },
          { category: 'write', name: 'set_meta', description: 'stage SEO meta changes' },
          { category: 'act', name: 'generate_social_posts', description: 'draft social promo posts (posts nothing)' },
          { category: 'act', name: 'apply_readability', description: 'rewrite body for readability (staged)' },
          { category: 'act', name: 'publish_to_wordpress', description: 'PROPOSE publishing (user confirms)' },
        ],
      }),
    }),
  ```
  (Static is intentional — it documents intent in one place; a later refactor can derive it from a
  shared registry if the tool set churns.)

- [ ] **Step 4:** In `systemPrompt.ts`, add to the `Read` block:
  `- get_tool_catalog — list every tool you can call (use if unsure what's available)`.

- [ ] **Step 5:** `npx jest __tests__/lib/ai` (green); `npx tsc --noEmit` (0).

- [ ] **Step 6:** Commit `lib/ai/tools.ts lib/ai/systemPrompt.ts __tests__/lib/ai/tools.phase4.test.ts`
  → `feat(surfy): get_tool_catalog meta-tool`.

---

## P4-T3: `TokenCircle` component

**Files:** Create `components/articles/TokenCircle.tsx`; extend `sse.test.ts` already covers `formatTokens`.

- [ ] **Step 1: Implement** a small dark-theme ring (no deps; inline SVG; uses `formatTokens`):
  ```tsx
  import React from 'react';
  import { formatTokens } from '../../lib/ai/sse';

  const TOKEN_BUDGET = 60_000; // this-turn soft reference for the ring fill

  const TokenCircle = ({ tokens }: { tokens: number }) => {
    const pct = Math.max(0, Math.min(tokens / TOKEN_BUDGET, 1));
    const r = 13; const c = 2 * Math.PI * r; const off = c * (1 - pct);
    return (
      <span title={`${tokens.toLocaleString()} tokens used this turn`} style={{ display: 'inline-flex', alignItems: 'center' }}>
        <svg width={32} height={32} viewBox="0 0 32 32">
          <circle cx={16} cy={16} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={3} />
          <circle cx={16} cy={16} r={r} fill="none" stroke="#AA93FD" strokeWidth={3} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 16 16)"
            style={{ transition: 'stroke-dashoffset 300ms ease' }} />
          <text x={16} y={16} textAnchor="middle" dominantBaseline="central"
            fontFamily="var(--font-family-primary)" fontSize={8.5} fontWeight={600} fill="rgba(255,255,255,0.9)">
            {formatTokens(tokens)}
          </text>
        </svg>
      </span>
    );
  };
  export default TokenCircle;
  ```

- [ ] **Step 2:** `npx tsc --noEmit` (0). (Visual unit; `formatTokens` is already unit-tested in P4-T1.)

- [ ] **Step 3:** Commit `components/articles/TokenCircle.tsx` → `feat(surfy): TokenCircle usage ring`.

---

## P4-T4: client — consume the SSE stream

**Files:** `components/articles/ArticleEditor.tsx`.

Replace the agent branch's `await res.json()` with a streaming reader; keep the `ask-surfy` branch JSON.

- [ ] **Step 1:** Add state: `surfyActivity` (`Array<{ tool: string; done: boolean }>`),
  `surfyStreamText` (string, the live assistant text), `surfyTokens` (number). Reset all three at the
  start of each agent submit.

- [ ] **Step 2:** For the `useAgent` branch, after `fetch(...)` (keep method/headers/body + the
  `surfyAbortRef` signal), parse SSE from `res.body`:
  ```ts
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let done: any = null;
  for (;;) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buf += dec.decode(value, { stream: true });
    const frames = buf.split('\n\n'); buf = frames.pop() || '';
    for (const f of frames) {
      const ev = /event: (.*)/.exec(f)?.[1]; const dataLine = /data: (.*)/.exec(f)?.[1];
      if (!ev || !dataLine) continue;
      const data = JSON.parse(dataLine);
      if (ev === 'text') setSurfyStreamText((t) => t + (data.delta || ''));
      else if (ev === 'step') setSurfyActivity((a) => updateActivity(a, data));   // start→push, end→mark done
      else if (ev === 'usage') setSurfyTokens(data.totalTokens || 0);
      else if (ev === 'done') done = data;
      else if (ev === 'error') throw new Error(data.error || 'stream error');
    }
  }
  if (!done) throw new Error('stream ended without result');
  // From here, `done` plays the role the old `data` did:
  surfyMetaRef.current = done.meta || null;
  setSurfyResponse({ action: 'replace_article', message: done.message, content: done.finalHtml || null, changelog: done.changelog || [], steps: undefined, pendingAction: done.pendingAction || null });
  setSurfyTokens(done.usage?.totalTokens ?? 0);
  // history push uses done.message / done.finalHtml (as before)
  ```
  (Handle abort: if `surfyAbortRef` aborts, `reader.read()` throws `AbortError` → treat as cancel, not
  error, mirroring the current Stop behavior.)

- [ ] **Step 3:** Render, in the Surfy bar while `surfyLoading`/streaming: the **live activity list**
  (each `surfyActivity` item: spinner while `!done`, ✓ when done, tool name → friendly label) and the
  **TokenCircle** (`<TokenCircle tokens={surfyTokens} />`) in the bar header/footer. While streaming,
  show `surfyStreamText` as the in-progress message. On `done`, the existing changelog/Preview/publish
  card render unchanged (driven by `surfyResponse`).

- [ ] **Step 4:** `npx tsc --noEmit` (0).

- [ ] **Step 5:** Commit `components/articles/ArticleEditor.tsx`
  → `feat(surfy): consume the agent SSE stream — live steps + TokenCircle`.

---

## P4-T5: verification & docs

- [ ] **Step 1:** `npx tsc --noEmit` (0); `npx jest __tests__/lib/ai` (all green).
- [ ] **Step 2:** `npm run build` — ONLY if the dev server is stopped (concurrent `next build` clobbers
  the dev `.next`). Else skip + note.
- [ ] **Step 3 (manual smoke — needs the app + sidecar + DeepSeek):** open an article, ask Surfy to do
  something multi-step; confirm steps appear live, the TokenCircle fills, the final message + diff
  Preview/publish card still work, and Stop actually halts the run. Not committed.
- [ ] **Step 4:** Update `docs/specs/2026-06-29-surfy-tool-calling-phase1.md`: Phase 4 shipped
  (streaming + tool catalog + token circle). Commit.
- [ ] **Step 5:** `graphify update .`

---

## Notes / deferred
- **Vercel streaming:** Node serverless functions stream fine; if a proxy buffers, the `X-Accel-Buffering:no`
  + `no-transform` headers cover it. Edge runtime is NOT used (we need Node + cheerio).
- **`fullStream` part shapes** can differ slightly across `ai` minors — the route reads fields
  defensively (`part.text ?? part.textDelta`) and the impl step verifies against the installed d.ts.
- **Token circle scope:** per-turn by default. Cumulative-session is a one-line change (don't reset
  `surfyTokens` between turns) if preferred later.
- **Meta-catalog is static** — if the tool set starts churning, derive it from a shared registry so it
  can't drift from `buildTools`.
