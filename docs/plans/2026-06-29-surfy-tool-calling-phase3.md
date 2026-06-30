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
   **Consciously accepted (review):** this REPLACES the whole working doc → all `data-sid`s and the
   outline are regenerated. So the tool **returns the refreshed outline** (like `apply_edit`/
   `insert_section`); combined with the existing prompt rule ("sids may shift after a write; use the
   refreshed outline"), a later `apply_edit` in the same turn targets the new doc, not a stale one.
   **Body-only (review pt 5):** `/apply-ai-readability` rewrites the article **content** only — it
   never touches meta title / description / slug. The tool description + system prompt state this so
   the model doesn't claim it "fixed the title".
4. **Timeout/latency (reconciled per review — no self-contradiction):** the per-call sidecar budget
   and the route's function timeout must be coherent. The existing dedicated endpoints spend one LLM
   call under the `callSidecar` 60s default + `maxDuration:60`. So: `ACTION_TIMEOUT = 60_000` (one LLM
   call — same budget as those endpoints, NOT 90s), and raise the agent route to
   `export const config = { maxDuration: 300 }` so it covers the DeepSeek steps **plus** up to two
   sequential sidecar LLM calls (`apply_readability`). `maxDuration` (route, 300) ≥ Σ tool calls
   (≤ 2×60s) + model thinking — the route no longer dies before a tool finishes. **Plan dependency:**
   300s needs a Vercel plan that allows it (Pro = 300s; Hobby caps at 60s — there `apply_readability`'s
   two-call worst case may exceed it and fail gracefully via the tool's `catch` → `ok:false`). **Risk
   fallback** (a later 3b): if too slow in production, make `apply_readability` propose-only like
   publish (client runs the existing `/api/articles/apply-readability` + accept bar).
5. **No new endpoints, no new sidecar routes, no DB schema changes.** Publish reuses `/api/articles/publish`;
   social/readability reuse the existing sidecar routes via `callSidecar` directly (the agent route
   already did `verifyUser`, so the tools call the sidecar, not the cookie-authed Next endpoints).

---

## Review responses (external review, 9.9/10)

**Accepted & folded in:**
1. **Timeout coherence** — `ACTION_TIMEOUT` dropped 90s → **60s** (one LLM-call budget, same as the
   dedicated endpoints) and the route `maxDuration` raised to **300s** so it's ≥ Σ tool budgets; no
   more "tool 90s vs route 60s" contradiction (Design #4, P3-T1, P3-T2).
2. **`apply_readability` returns the refreshed outline** (whole doc replaced → sids renumbered), like
   `apply_edit`; the description tells the model sids shift (Design #3, P3-T3).
3. **`normalizeSocialPosts()` adapter** → tool always returns `{ posts: string[] }`; keyed on the real
   `variants` shape (`SocialMediaModal` reads `data.variants`) (P3-T2).
4. **Publish warns on unsaved edits** — if `ctx.htmlDirty`, `pendingAction.warning` is set and the
   card shows a caution row, since `/publish` publishes the SAVED article (P3-T4, P3-T6).
5. **Readability is body-only** — `/apply-ai-readability` rewrites content, never title/meta/slug;
   stated in the tool description + system prompt so the model doesn't over-claim (Design #3, P3-T5).

**Partial / optional:**
6. **"Podgląd zmian" on the publish card** — optional secondary action opening the existing
   `CompareVersionsModal`; included only if it wires in cleanly. The `warning` row (pt 4) already
   covers the core "did I publish the right version" risk (P3-T6).

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
    /** Non-blocking caution shown on the confirm card (e.g. unsaved edits). */
    warning?: string;
  }
  ```
  and inside `ToolCtx` (after `meta`):
  ```ts
    /** Set by a propose-only action tool; surfaced to the client to confirm + run. null otherwise. */
    pendingAction: PendingAction | null;
  ```

- [ ] **Step 2:** In `surfy-agent.ts`: add `pendingAction: null,` to the `ctx` literal; add
  `pendingAction: ctx.pendingAction,` to the JSON response object; add
  `export const config = { maxDuration: 300 };` near the top — the route must cover the DeepSeek
  steps PLUS up to two sequential sidecar LLM calls (`apply_readability`), so its function timeout
  must be ≥ the sum of the tool budgets (`ACTION_TIMEOUT` 60s each). (See Design decision #4.)

- [ ] **Step 3:** `npx tsc --noEmit` → it flags the 3 ctx factories missing `pendingAction`. Add
  `pendingAction: null,` to `tools.read.test.ts`, `tools.write.test.ts`, `systemPrompt.test.ts`
  (next to their existing `articleId: null, cache: {},`).

- [ ] **Step 4:** `npx tsc --noEmit` (0) and `npx jest __tests__/lib/ai` (all green).

- [ ] **Step 5:** Commit `lib/ai/types.ts pages/api/articles/surfy-agent.ts __tests__/lib/ai/tools.read.test.ts __tests__/lib/ai/tools.write.test.ts __tests__/lib/ai/systemPrompt.test.ts`
  → `feat(surfy): pendingAction channel on ToolCtx + agent route`.

---

## P3-T2: `generate_social_posts` (in-loop, output-only)

**Files:** `lib/ai/tools.ts`; Test `__tests__/lib/ai/tools.phase3.test.ts`.

Add a module-level constant near `SIDECAR_TIMEOUT`, and a small normalizer (above `buildTools`):
```ts
const ACTION_TIMEOUT = 60_000; // ms — one LLM call (same budget as the dedicated endpoints)

// The /social-posts sidecar returns { variants: string[] } (SocialMediaModal reads data.variants).
// Normalize to a stable shape so the tool result is always { posts: string[] } regardless of sidecar.
function normalizeSocialPosts(d: any): string[] {
  if (Array.isArray(d?.variants)) return d.variants.filter((v: unknown) => typeof v === 'string');
  if (Array.isArray(d?.posts)) return d.posts.filter((v: unknown) => typeof v === 'string');
  return [];
}
```

- [ ] **Step 1: Write the failing test** `tools.phase3.test.ts`. Mirror the `tools.phase2.test.ts`
  setup: factory-mock `../../../lib/ai/articleMeta` (so the DB isn't loaded), `jest.mock` for
  `../../../lib/sidecar` whose `callSidecar` switches on path:
  `/social-posts` → `{ variants: ['post A', 'post B'] }` (the real sidecar shape);
  `/ai-readability` → `{ score: 70, criteria: [{ key: 'k1', met: false, suggestions: ['split long sentence'] }, { key: 'k2', met: true }] }`;
  `/apply-ai-readability` → `{ content: '<h1>R</h1><p>improved</p>' }`.
  `ctxFor(html)` includes the full ToolCtx (`articleId:1, cache:{}, pendingAction:null, …`).
  Assert: `generate_social_posts` returns `{ posts: ['post A','post B'] }` (length 2) and calls
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
          const posts = normalizeSocialPosts(d);
          if (posts.length === 0) return { ok: false, summary: 'no social posts generated' };
          return { posts };
        } catch (e: any) {
          return { ok: false, error: `social posts unavailable: ${e?.message || 'error'}` };
        }
      },
    }),
  ```

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
      description: 'Rewrite the article BODY to improve AI-readability (structure/clarity only — no new facts, and it does NOT change the title, meta description, or slug). The change is staged for the user to review and accept in the editor, exactly like your other edits. Because it rewrites the whole body, block sids change — use the refreshed outline it returns for any follow-up edit.',
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
          const wd = makeWorkingDoc(newHtml);    // re-annotates sids; flows into finalHtml diff
          ctx.$ = wd.$;
          ctx.htmlDirty = true;
          ctx.writeCount += 1;
          ctx.changelog.push({ tool: 'apply_readability', summary: `applied ${suggestions.length} readability fix(es)` });
          // Return the refreshed outline (whole doc replaced → sids renumbered), like apply_edit/insert_section.
          return { ok: true, summary: `rewrote the BODY for readability (${suggestions.length} fix(es)); staged for your review. Title/meta unchanged.`, applied: suggestions.length, outline: wd.outline };
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
  `articleId:null` → returns `{ ok:false }` and leaves `pendingAction` null. Also: when the ctx has
  `htmlDirty:true`, `ctx.pendingAction.warning` is set (unsaved-edits caution) and the result `summary`
  mentions saving first.

- [ ] **Step 2:** run → FAIL.

- [ ] **Step 3: Implement** (after `apply_readability`):
  ```ts
    publish_to_wordpress: tool({
      description: 'Propose publishing the article to the connected WordPress site. This does NOT publish — it asks the user to confirm; on confirm the app publishes the SAVED article. Use only when the user explicitly asks to publish.',
      inputSchema: z.object({}),
      execute: async () => {
        if (ctx.articleId == null) return { ok: false, summary: 'article id unavailable — cannot publish' };
        // The publish endpoint publishes the SAVED DB article. If the agent staged edits this turn
        // (htmlDirty), warn — otherwise the user would publish the previous saved version.
        const warning = ctx.htmlDirty
          ? 'You have unsaved edits — publishing uses the last SAVED version. Accept & save your changes first.'
          : undefined;
        ctx.pendingAction = { type: 'publish_to_wordpress', target: 'wordpress', articleId: ctx.articleId, title: ctx.articleTitle || '', warning };
        ctx.changelog.push({ tool: 'publish_to_wordpress', summary: 'proposed publishing to WordPress (awaiting confirmation)' });
        return {
          proposed: true,
          summary: warning
            ? 'Proposed publishing to WordPress, but there are unsaved edits — tell the user to accept & save first, then confirm with the Publish button. Do not assume it is published.'
            : 'Proposed publishing to WordPress. Ask the user to confirm with the Publish button; do not assume it is published.',
        };
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
  - apply_readability — rewrite the article BODY for readability (NOT title/meta); staged for the user to accept (like your edits)
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
  - **If `pendingAction.warning` is set** (unsaved edits, review pt 4): show it above the buttons in a
    caution row (amber text `#B45309`, no new dependency) so the user can't miss that publish uses the
    last SAVED version.
  - **Optional secondary action (review pt 6 — include if cheap):** when there are staged Surfy edits
    (`surfyResponse?.content` / `surfyCompareOpen` machinery already exists from Phase 1), add a
    tertiary **„Podgląd zmian"** text button that opens the existing `CompareVersionsModal`, so the
    user can review what's staged before deciding. If wiring it cleanly into this card is non-trivial,
    skip it — the `warning` row already covers the core "did I publish the right thing" risk.

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
