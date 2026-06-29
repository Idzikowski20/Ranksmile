# Surfy Tool-Calling Agent — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Give the article-mode Surfy agent three **action** tools — `generate_social_posts`,
`apply_readability`, and `publish_to_wordpress` — wrapping the app's existing endpoints/sidecar
routes, with the only irreversible action (WordPress publish) gated behind an explicit user
confirmation card instead of running autonomously in the loop.

**Architecture:** Two tools run **in the agent loop** (they wrap a sidecar call and either return
text or mutate the cheerio working copy, which flows through Phase 1's existing diff-Preview gate).
The third, `publish_to_wordpress`, is **propose-only**: the tool never publishes — it sets
`ctx.pendingAction`; the route returns `pendingAction`; the client shows a confirm card; on
**Publish** the client calls the EXISTING `POST /api/articles/publish` (which already does auth +
tenancy + the WP REST publish). So the agent proposes, the user confirms, the existing endpoint acts.

**Tech Stack:** Same as Phase 1/2 (`ai@7.0.4`, `@ai-sdk/deepseek`, `zod`, `cheerio`, Jest, TS 5.4.5).

**Verified ground truth (do not re-derive):**
- `callSidecar<T>(path, body, timeoutMs=60000)` from `lib/sidecar.ts`.
- Sidecar routes exist: `/social-posts`, `/ai-readability`, `/apply-ai-readability` (`python-sidecar/main.py`).
- `pages/api/articles/social-posts.ts` → sidecar `/social-posts` body `{ article_content, keyword }`;
  returns the 3 promo variants. `maxDuration: 60` (LLM is slow).
- `pages/api/articles/ai-readability.ts` → sidecar `/ai-readability` body `{ article_content, keyword }`;
  returns `{ score, criteria }`, criterion = `{ key: string; met: boolean; note?: string; suggestions?: string[] }`.
- `pages/api/articles/apply-readability.ts` → sidecar `/apply-ai-readability` body
  `{ content, suggestions, keyword }`; returns `{ content }` (rewritten HTML; **no DB write** — the UI
  diff/accepts and saves separately). The `AiReadabilityCriterion`/`AiReadabilityResult` types live in
  `components/articles/PrePublishPanel.tsx`.
- `pages/api/articles/publish.ts` → `POST` body `{ articleId, target: 'wordpress' | 'nextjs' }`; does
  `verifyUser` + `assertArticleAccess`, reads the article + `publish_targets` row, calls
  `publishToWordPress`/`publishToNextJs` (`lib/wordpressPublish.ts`), sets `status='published'`,
  auto-adds the keyword to the tracker; returns `{ url, published: true }`. **It publishes the SAVED
  DB article**, not the agent working copy.
- `ToolCtx` already has `articleId: number | null`, `cache: ToolCache`, `meta`, `changelog`,
  `htmlDirty`, `writeCount`, `$`, `keyword`, `articleTitle`, `articleMetaDescription`, `scoreData`.
- The agent route `pages/api/articles/surfy-agent.ts` builds `ctx`, runs `generateText(..., { tools, stopWhen })`,
  then returns `{ message, finalHtml, meta, changed, changelog, steps }`. The client (`ArticleEditor.tsx`,
  `handleSurfySubmit`) sets `surfyResponse` from the response and renders the changelog / diff Preview.

---

## Design decisions (please confirm at review)

1. **Publish = propose-only (CONFIRMED with user).** The tool returns a proposal + sets
   `ctx.pendingAction`; the client shows a card and calls the existing `/api/articles/publish` on
   confirm. The agent never publishes autonomously. The card copy notes it publishes the **saved**
   article (so the user should Apply+Save any Surfy edits first).
2. **`generate_social_posts` = in-loop, output-only.** One sidecar call; returns variants in the
   tool result → Surfy presents them in its message. No confirmation (nothing is mutated/published).
3. **`apply_readability` = in-loop, gated by the EXISTING diff Preview.** Chains
   `/ai-readability` (get suggestions on the current working copy) → `/apply-ai-readability` (rewrite)
   → replaces `ctx.$` with the rewritten HTML (`makeWorkingDoc`) and marks `htmlDirty`. The rewrite
   therefore appears in `finalHtml` and the user accepts it via the same diff Preview as any Surfy edit.
4. **Timeout/latency:** readability + social are LLM rewrites (the endpoints use `maxDuration:60`).
   New module constant `ACTION_TIMEOUT = 90_000` for these tool sidecar calls (vs. Phase 2's 30s read
   timeout), and add `export const config = { maxDuration: 60 }` to `surfy-agent.ts`. **Risk:**
   `apply_readability` is two sequential LLM calls; if it proves too slow under the route's
   `maxDuration` in production, the fallback (a later 3b) is to make it propose-only like publish.
   Flagging for review; default plan keeps it in-loop.
5. **No new endpoints, no new sidecar routes, no DB schema changes.** Publish reuses `/api/articles/publish`;
   social/readability reuse the existing sidecar routes via `callSidecar` directly (the agent route
   already did `verifyUser`, so the tools call the sidecar, not the cookie-authed Next endpoints).

---

## File Structure

| File | Change | Task |
|---|---|---|
| `lib/ai/types.ts` | add `pendingAction` to `ToolCtx` + a `PendingAction` type | P3-T1 |
| `pages/api/articles/surfy-agent.ts` | seed `pendingAction:null`; return `pendingAction`; `maxDuration` | P3-T1 |
| `__tests__/lib/ai/{tools.read,tools.write,systemPrompt}.test.ts` | add `pendingAction:null` to ctx factories | P3-T1 |
| `lib/ai/tools.ts` | add `generate_social_posts` | P3-T2 |
| `lib/ai/tools.ts` | add `apply_readability` | P3-T3 |
| `lib/ai/tools.ts` | add `publish_to_wordpress` (propose-only) | P3-T4 |
| `__tests__/lib/ai/tools.phase3.test.ts` | NEW — tests for all 3 | P3-T2/3/4 |
| `lib/ai/systemPrompt.ts` | advertise the 3 action tools (+ the publish "you propose, user confirms" rule) | P3-T5 |
| `components/articles/ArticleEditor.tsx` | publish confirm card for `pendingAction` → `/api/articles/publish` | P3-T6 |

---

## P3-T1: `pendingAction` on `ToolCtx` + the route channel

**Files:** `lib/ai/types.ts`, `pages/api/articles/surfy-agent.ts`, the 3 ctx test factories.

- [ ] **Step 1:** In `lib/ai/types.ts`, add above `ToolCtx`:
  ```ts
  /** A side-effecting action the agent PROPOSES; the client confirms + executes it.
   *  The agent never performs it autonomously. */
  export interface PendingAction {
    type: 'publish_to_wordpress';
    target: 'wordpress';
    articleId: number;
    title: string;
  }
  ```
  and inside `ToolCtx` (after `meta`):
  ```ts
    /** Set by a propose-only action tool; surfaced to the client to confirm + run. null otherwise. */
    pendingAction: PendingAction | null;
  ```

- [ ] **Step 2:** In `surfy-agent.ts`: add `pendingAction: null,` to the `ctx` literal; add
  `pendingAction: ctx.pendingAction,` to the JSON response object; add
  `export const config = { maxDuration: 60 };` near the top (action tools are slow LLM calls).

- [ ] **Step 3:** `npx tsc --noEmit` → it flags the 3 ctx factories missing `pendingAction`. Add
  `pendingAction: null,` to `tools.read.test.ts`, `tools.write.test.ts`, `systemPrompt.test.ts`
  (next to their existing `articleId: null, cache: {},`).

- [ ] **Step 4:** `npx tsc --noEmit` (0) and `npx jest __tests__/lib/ai` (all green).

- [ ] **Step 5:** Commit `lib/ai/types.ts pages/api/articles/surfy-agent.ts __tests__/lib/ai/tools.read.test.ts __tests__/lib/ai/tools.write.test.ts __tests__/lib/ai/systemPrompt.test.ts`
  → `feat(surfy): pendingAction channel on ToolCtx + agent route`.

---

## P3-T2: `generate_social_posts` (in-loop, output-only)

**Files:** `lib/ai/tools.ts`; Test `__tests__/lib/ai/tools.phase3.test.ts`.

Add a module-level constant near `SIDECAR_TIMEOUT`:
```ts
const ACTION_TIMEOUT = 90_000; // ms — social/readability are slow LLM rewrites
```

- [ ] **Step 1: Write the failing test** `tools.phase3.test.ts`. Mirror the `tools.phase2.test.ts`
  setup: factory-mock `../../../lib/ai/articleMeta` (so the DB isn't loaded), `jest.mock` for
  `../../../lib/sidecar` whose `callSidecar` switches on path:
  `/social-posts` → `{ posts: [{ network: 'x', text: 'a' }, { network: 'li', text: 'b' }] }`;
  `/ai-readability` → `{ score: 70, criteria: [{ key: 'k1', met: false, suggestions: ['split long sentence'] }, { key: 'k2', met: true }] }`;
  `/apply-ai-readability` → `{ content: '<h1>R</h1><p>improved</p>' }`.
  `ctxFor(html)` includes the full ToolCtx (`articleId:1, cache:{}, pendingAction:null, …`).
  Assert: `generate_social_posts` returns `posts` (length 2) and calls
  `callSidecar('/social-posts', expect.objectContaining({ keyword: 'seo' }), expect.any(Number))`.

- [ ] **Step 2:** run → FAIL (tool undefined).

- [ ] **Step 3: Implement** (add to `buildTools`'s `return {}` after `fetch_competitor_outline`):
  ```ts
    generate_social_posts: tool({
      description: 'Generate short social-media promo posts (X/LinkedIn/etc.) for this article. Returns the variants as text for the user to copy; does not post anywhere.',
      inputSchema: z.object({}),
      execute: async () => {
        if (ctx.articleId == null) return { ok: false, summary: 'article id unavailable' };
        try {
          const d: any = await callSidecar('/social-posts', {
            article_content: stripSids(ctx.$.html()),
            keyword: ctx.keyword || '',
          }, ACTION_TIMEOUT);
          return { posts: d.posts || d.variants || d };
        } catch (e: any) {
          return { ok: false, error: `social posts unavailable: ${e?.message || 'error'}` };
        }
      },
    }),
  ```
  (Return whatever the sidecar shapes — `posts`/`variants`; the agent reads it as text.)

- [ ] **Step 4:** `npx jest __tests__/lib/ai/tools.phase3.test.ts` (green); `npx tsc --noEmit` (0).

- [ ] **Step 5:** Commit `lib/ai/tools.ts __tests__/lib/ai/tools.phase3.test.ts`
  → `feat(surfy): generate_social_posts tool`.

---

## P3-T3: `apply_readability` (in-loop; gated by existing diff Preview)

**Files:** `lib/ai/tools.ts`; extend `tools.phase3.test.ts`.

Add `makeWorkingDoc` to the `./workingDoc` import in `tools.ts`.

- [ ] **Step 1: Add the failing test** to `tools.phase3.test.ts`: `apply_readability` on
  `'<h1>R</h1><p>long</p>'` → calls `/ai-readability` then `/apply-ai-readability`, returns
  `{ ok: true, … }`, and the ctx working copy now serialises to contain `'improved'`
  (`ctx.$.html()` includes the rewritten content). Also assert `ctx.htmlDirty === true`.

- [ ] **Step 2:** run → FAIL.

- [ ] **Step 3: Implement** (after `generate_social_posts`):
  ```ts
    apply_readability: tool({
      description: 'Rewrite the article to improve AI-readability (structure/clarity only — no new facts). The change is staged for the user to review and accept in the editor, exactly like your other edits.',
      inputSchema: z.object({}),
      execute: async () => {
        if (ctx.writeCount >= MAX_WRITES) return { ok: false, summary: 'edit limit reached for this turn' };
        if (ctx.articleId == null) return { ok: false, summary: 'article id unavailable' };
        try {
          const current = stripSids(ctx.$.html());
          const kw = ctx.keyword || '';
          const rub: any = await callSidecar('/ai-readability', {
            article_content: `${ctx.articleTitle}\n${ctx.articleMetaDescription}\n${current}`,
            keyword: kw,
          }, ACTION_TIMEOUT);
          const suggestions: string[] = (rub.criteria || [])
            .filter((c: any) => !c.met)
            .flatMap((c: any) => c.suggestions || []);
          if (suggestions.length === 0) return { ok: true, summary: 'readability already strong; no changes', score: rub.score };
          const applied: any = await callSidecar('/apply-ai-readability', { content: current, suggestions, keyword: kw }, ACTION_TIMEOUT);
          const newHtml = (applied.content || '').trim();
          if (!newHtml) return { ok: false, summary: 'readability rewrite returned empty' };
          ctx.$ = makeWorkingDoc(newHtml).$;     // re-annotate sids; flows into finalHtml diff
          ctx.htmlDirty = true;
          ctx.writeCount += 1;
          ctx.changelog.push({ tool: 'apply_readability', summary: `applied ${suggestions.length} readability fix(es)` });
          return { ok: true, summary: `rewrote the article for readability (${suggestions.length} fix(es)); staged for your review`, applied: suggestions.length };
        } catch (e: any) {
          return { ok: false, error: `readability rewrite unavailable: ${e?.message || 'error'}` };
        }
      },
    }),
  ```
  Note: `ctx.$` is reassigned — confirm `ToolCtx.$` is not `readonly` (it isn't). The route reads
  `ctx.$` AFTER `generateText` resolves to build `finalHtml`, so the reassignment is picked up.

- [ ] **Step 4:** `npx jest __tests__/lib/ai/tools.phase3.test.ts` (green); `npx tsc --noEmit` (0).

- [ ] **Step 5:** Commit `lib/ai/tools.ts __tests__/lib/ai/tools.phase3.test.ts`
  → `feat(surfy): apply_readability tool (staged via diff Preview)`.

---

## P3-T4: `publish_to_wordpress` (propose-only)

**Files:** `lib/ai/tools.ts`; extend `tools.phase3.test.ts`.

- [ ] **Step 1: Add the failing test:** `publish_to_wordpress` → returns `{ proposed: true }`,
  sets `ctx.pendingAction` to `{ type:'publish_to_wordpress', target:'wordpress', articleId:1, title:'Title' }`,
  and **does NOT call `callSidecar`** (assert `callSidecar` not called for this tool). Also: with
  `articleId:null` → returns `{ ok:false }` and leaves `pendingAction` null.

- [ ] **Step 2:** run → FAIL.

- [ ] **Step 3: Implement** (after `apply_readability`):
  ```ts
    publish_to_wordpress: tool({
      description: 'Propose publishing the article to the connected WordPress site. This does NOT publish — it asks the user to confirm; on confirm the app publishes the SAVED article. Use only when the user explicitly asks to publish.',
      inputSchema: z.object({}),
      execute: async () => {
        if (ctx.articleId == null) return { ok: false, summary: 'article id unavailable — cannot publish' };
        ctx.pendingAction = { type: 'publish_to_wordpress', target: 'wordpress', articleId: ctx.articleId, title: ctx.articleTitle || '' };
        ctx.changelog.push({ tool: 'publish_to_wordpress', summary: 'proposed publishing to WordPress (awaiting confirmation)' });
        return { proposed: true, summary: 'Proposed publishing to WordPress. Ask the user to confirm with the Publish button; do not assume it is published.' };
      },
    }),
  ```

- [ ] **Step 4:** `npx jest __tests__/lib/ai/tools.phase3.test.ts` (green); `npx jest __tests__/lib/ai` (all green); `npx tsc --noEmit` (0).

- [ ] **Step 5:** Commit `lib/ai/tools.ts __tests__/lib/ai/tools.phase3.test.ts`
  → `feat(surfy): publish_to_wordpress propose-only tool`.

---

## P3-T5: advertise the action tools in the system prompt

**Files:** `lib/ai/systemPrompt.ts`.

- [ ] **Step 1:** Add an `Act (side effects — see rules)` block after the Navigate block:
  ```
  Act (side effects — only when the user clearly asks):
  - generate_social_posts — draft social promo posts from the article (returns text; posts nothing)
  - apply_readability — rewrite the article for readability; staged for the user to accept (like your edits)
  - publish_to_wordpress — PROPOSE publishing; you do NOT publish — the user confirms with a button
  ```
  and add to the RULES list:
  ```
  - publish_to_wordpress only PROPOSES a publish. Never claim the article is published; tell the user to confirm with the Publish button. It publishes the SAVED article, so tell them to accept+save your edits first.
  ```

- [ ] **Step 2:** `npx jest __tests__/lib/ai/systemPrompt.test.ts` (green); `npx tsc --noEmit` (0).

- [ ] **Step 3:** Commit `lib/ai/systemPrompt.ts` → `feat(surfy): advertise phase-3 action tools`.

---

## P3-T6: client — publish confirm card

**Files:** `components/articles/ArticleEditor.tsx`.

The agent response now may include `pendingAction`. When present (publish), render a confirm card in
the Surfy response area with **Publish to WordPress** + **Cancel**. On Publish, POST
`/api/articles/publish` with `{ articleId, target: 'wordpress' }`, show a toast with the returned
url (or the error), and clear the pending state. Social posts + readability need no new UI (social
posts arrive in `data.message`; readability arrives in `data.finalHtml` → existing diff Preview).

- [ ] **Step 1:** Read `handleSurfySubmit` + the `surfyResponse` render block. Capture
  `data.pendingAction` into state (e.g. extend the existing `surfyResponse` setState with
  `pendingAction: data.pendingAction || null`, or a sibling `surfyPendingRef`/state).

- [ ] **Step 2:** Add a `publishing` state + an async `confirmPublish(pa)` that:
  ```ts
  const res = await fetch('/api/articles/publish', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleId: pa.articleId, target: pa.target }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || 'Publish failed');
  toast.success(`Published: ${d.url}`);
  ```
  with `try/catch` → `toast.error`, and clear the pending state in `finally`.

- [ ] **Step 3:** In the Surfy response render, when `pendingAction?.type === 'publish_to_wordpress'`,
  show a card (inline styles per `design.md`: card border `#F4F4F5`, dark CTA `#2F2F34`, hover
  `#783AFB`, `var(--font-family-primary)`): a one-line "Surfy chce opublikować „{title}" do
  WordPressa. Publikowany jest zapisany artykuł." + **Publikuj** (calls `confirmPublish`, disabled
  while `publishing`) + **Anuluj** (clears pending). Inline SVG only; no icon lib.

- [ ] **Step 4:** `npx tsc --noEmit` (0).

- [ ] **Step 5:** Commit `components/articles/ArticleEditor.tsx`
  → `feat(surfy): publish confirmation card for the agent's publish proposal`.

---

## P3-T7: verification & docs

- [ ] **Step 1:** `npx tsc --noEmit` (0); `npx jest __tests__/lib/ai` (all green).
- [ ] **Step 2:** `npm run build` — **ONLY if the dev server is stopped** (a concurrent `next build`
  clobbers the dev `.next` → white screen). If dev is running, skip and note it; tsc+jest already
  gate compilation.
- [ ] **Step 3 (optional live smoke — sidecar on :8001 + a WP publish target configured):** scratch
  script: agent prompt "napisz posty na social i popraw czytelność", confirm tools return data and
  `apply_readability` stages a rewrite; a separate prompt "opublikuj" returns a `pendingAction`
  (NOT a publish). Delete the scratch; do not commit.
- [ ] **Step 4:** Update `docs/specs/2026-06-29-surfy-tool-calling-phase1.md` Status/Out-of-scope:
  Phase 3 actions shipped (social/readability in-loop, publish propose-only). Commit the doc.
- [ ] **Step 5:** `graphify update .`

---

## Notes / deferred
- **`apply_readability` latency:** two sequential LLM sidecar calls inside the agent route. If the
  route's `maxDuration` is exceeded in production, fall back to propose-only (a 3b), surfacing it via
  `pendingAction` and running the existing `/api/articles/apply-readability` + accept bar client-side.
- **Publish publishes the SAVED article**, not unsaved Surfy edits — the prompt + card both say so.
- **No nextjs publish tool this phase** — `publish_to_wordpress` targets `'wordpress'` only; nextjs
  target stays a manual Pre-Publish action.
