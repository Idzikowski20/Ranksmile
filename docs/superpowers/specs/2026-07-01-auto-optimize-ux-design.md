# Auto-Optimize UX — Less-Mode presentation (Sub-project G) — Design

**Date:** 2026-07-01
**Branch:** `feature/less-mode`
**Status:** Draft v2 — awaiting decision to execute. Direction: the 8-part brief (approved) + tech-lead Part 8 + **[RATIFIED] Option A** review flow (see "Ratified decisions" below).
**Depends on:** the existing Auto-Optimize section-streaming flow (D, `pages/api/articles/optimize-sections.ts`) and the companion **Less Mode (decision logic, Sub-project F)** `docs/superpowers/specs/2026-07-01-auto-optimize-less-mode-design.md`, which adds `PlanStep.mode: EditMode` and owns ALL planner changes.

## Goal

A **presentation-only** layer over the Auto-Optimize section stream: one section animates at a time (shimmer + status label), the Content Score ticks up live as the run streams AND on Save, changes are proposed as a **tracked-changes review doc** the user reviews per-change (Accept/Reject ✓/✗) and then commits with a global **Save** (behind a confirmation modal), and every message says "small upgrade", never "rewrite". This sub-project **CONSUMES** the `focus`/`mode`/`reason` the planner already produces (`PlanStep`) plus the ordered `section` SSE events — it **never alters a planner decision** (routing, ROI, `expectedLift`, guideline assignment, mode selection).

`Planner (D+F) "where + whether + how much" -> section SSE stream -> UX (G) "how it looks + how it is reviewed".`

## The "Not a rewrite. An upgrade." philosophy

Every visible cue reinforces one message: the model made a **small, precise, reviewable** edit — not a rewrite. Four rules follow from that:

1. **One section at a time.** Exactly one section is `active` (shimmer + glow + status) while the run streams. The whole document is never animated. Shimmer clears the instant that section's `section` event arrives.
2. **Immediate, honest impact.** As sections resolve, re-score the document; animate `+N SEO` / `+N AI Search` ONLY when the delta is real and positive. `delta <= 0` -> no animation, no fake number.
3. **Review, then Save (Option A).** Changes are proposed as a **tracked-changes review doc**, NOT auto-applied. The user keeps or discards each change with the existing per-change Accept/Reject (✓/✗), then commits the whole run with a global **Save** (confirmation modal). Post-save undo is via **Version History**, not an inline revert.
4. **Minimal-upgrade language.** Copy is derived from `focus`/`mode`/`reason`: "Improved AI Search coverage", "Added one missing entity", "Strengthened authority". Never "Rewrote / Expanded / Generated" — UNLESS `mode === 'expand'` (F deliberate EXPAND).

## Non-goals (explicitly OUT)

- **No planner/routing/ROI/`expectedLift`/guideline-assignment/mode-selection change.** All of that is D + F. G reads their output.
- **No new LLM call.** Re-scoring for the live delta is the LOCAL pure `computeContentScore` (Part 3), client-side.
- **No new DB column, no persistence-shape change.** The `auto_optimize` version snapshot on Save (`handleSaveOptimizeRun`, `[id]/index.tsx:1355`) is unchanged — it already creates the Version-History entry Option A relies on.
- **No change to the credit/abort/retry machinery** in the endpoint loop.

## What already exists in code (build on it, do NOT reinvent)

The current branch already implements most of the Option-A flow. G **extends** it; it does not replace it.

- **Review-doc mechanism (KEEP):** `buildReviewDoc` (`lib/optimizeReviewDoc.ts`) turns the ordered `section` events into a doc where each changed section is a `contentOptimizer` atom (`data-section-id`/`data-index`/`data-status`); the FIRST changed section is `active`, the rest `pending`. The endpoint stream is buffered to `orderedEvents`, then on `done` with `changedCount > 0` the review doc is set into the editor with `emitUpdate:false` (`[id]/index.tsx:1235-1239`).
- **Per-change Accept/Reject NodeView (KEEP):** `ContentOptimizerNodeView.tsx` already renders a bordered box with a floating ✓/✗ toolbar. `handleAccept` splices `newHtml`; `handleReject` splices `oldHtml` (both real PM transactions). It ALREADY renders a **word-level inline diff** (green added / gray strikethrough) via `lib/optimizeWordDiff.ts` (`wordDiffSegments` + `renderDiffHtml`, backed by the `diff` package) for simple sections, and falls back to a two-block removed/added render for block-complex markup (tables/lists/images/multi-heading, `BLOCK_COMPLEX_RE`).
- **Store (KEEP + extend):** `optimizeStore` (`optimizeStore.ts`) is a `Map<sectionId, SectionResult>` where `SectionResult` ALREADY carries optional `scores?: {seo,overall,ai}` and `adjustments?: Array<{type,snippet,sourceDomains[]}>`. G adds optional `focus`/`mode`/`reason`.
- **Review bar (KEEP + extend):** `OptimizeReviewBar.tsx` is the fixed bottom bar: spinner + "Processing section X of Y" while optimizing, "All sections processed" + Save when reviewing, plus prev/next section nav and a `Cancel`. It reserves the right panel width so it centres on the editor column.
- **Cancel-confirm modal (KEEP, mirror for Save):** `OptimizeCancelModal.tsx` is the design-system confirm modal ("Cancel Auto-Optimize? … discarded … can't be undone", Go back / Confirm cancel). G adds a **Save**-confirmation twin in the same style.
- **Score gauges + odometer (REUSE):** `ScoreGauge.tsx` is the dual-arc gauge with an **odometer** number animation (`motion/react` `AnimatePresence`, spring) + a green `↑N` `DeltaBadge`. `ScoreTrio.tsx` composes SEO | overall | AI Search and accepts a `deltas` prop already wired to `ContentScorePanel` via `scoreDeltas` (`[id]/index.tsx:1959`). `OptimizeResultsPanel.tsx` ALREADY exists (gauge + "Auto-Optimize completed" + 3 stat cards "Sections optimized / Words added / Score" + a per-section adjustments list) but is **not yet imported/rendered** in `[id]/index.tsx`; `computeOptimizeStats` (`lib/optimizeStats.ts`) computes its word-delta stats. G wires this panel in as the **summary header** (Enhancement 1) and upgrades its stat labels/adjustments to the Surfer target.
- **Save + Version History (REUSE):** `handleSaveOptimizeRun` resolves all optimizer atoms to plain content, then `doSave('auto_optimize', …)` persists an `auto_optimize` **version snapshot** (Version History entry) and toasts "Auto-Optimize changes saved". A `Version History` panel already exists (`showHistory`, `[id]/index.tsx:404,1864-1866`) with per-version restore ("Version restored"). Option-A post-save revert = this existing versioning.

## Ratified decisions (recommendation + rationale)

### [RATIFIED] Review flow = **Option A** (tracked-changes review-then-Save)

The tech lead ratified a Surfer-style **review-then-Save** flow and **rejected** the earlier "Revert-only + auto-apply" direction. Concretely:

- **KEEP the per-change Accept/Reject (✓/✗)** review-doc mechanism (`contentOptimizer` atom + NodeView + `buildReviewDoc` + `optimizeStore`). Changes are proposed as a review doc, **not auto-applied live per section**.
- **Global `Cancel` / `Save` bar** (already exists) + a **"Save changes" confirmation modal** — "Are you sure you want to save? Changes will be applied to your article." with `Continue editing` / `Save`. Modelled 1:1 on the existing `OptimizeCancelModal`.
- **After Save:** a **success toast** — "✓ Your changes have been saved / You can see your changes in the Version History" — with a `Version History` button that opens the existing history panel. **Post-save revert is via Version History**, not an inline revert button.
- **This SUPERSEDES OD-2 (Revert scope) and OD-3 (auto-apply) below** — both are reframed as Option A. There is no per-section Revert button and no global "Revert all"; the review gestures are Accept/Reject per change + Cancel (discard the whole run, restore pre-optimize) + Save (commit).

### OD-1 — Per-section / live score delta: client-side re-score vs endpoint-emitted
**Recommendation: client-side re-score (SEO/content only), via the existing `computeContentScore`.** As the run streams and as sections are accepted, recompute the whole-document content score client-side (the page already holds `scoreData`, `wordCount`, `headingCount`, `coverageItems`, `article.target_keyword` — used at `[id]/index.tsx:1159-1161`) and diff against `preScoreRef`. Rationale: keeps Part 8 clean — the endpoint needs **no scoring change**, only the additive `section`-event fields (`focus`, `mode`, `reason`) that F already threads onto `PlanStep`. `computeContentScore` is pure and synchronous, so re-scoring is cheap.
**Caveat (Part-8 tension, MUST be resolved by the human):** the **AI Search** score is NOT client-re-scorable. `computeAiSearchScore(summary)` (`lib/aiSearchScore.ts:19`) is a function of an `AiVisibilitySummary` (prompts cited, competitor citations, extractability_score) measured at the DOMAIN level — independent of the edited section HTML text. Re-running it on new HTML yields the identical number. Therefore a live "`+2 AI Search`" per section (Parts 2/7) has **no honest client-side source today**. See "Part-8 tension" below; the recommended MVP shows the live delta for **content/SEO only** and derives the AI label from `focus === 'ai-coverage'` without a numeric AI delta.

### OD-2 — Review scope (SUPERSEDED by [RATIFIED] Option A)
**Was:** per-section Revert + global "Revert all". **Now:** per-change Accept/Reject (✓/✗) is the atomic review gesture; **Cancel** discards the whole run and restores `preReviewHtmlRef`; **Save** commits. There is no Revert button. Post-save undo is Version History. This is the ratified Option-A behavior.

### OD-3 — Apply flow (SUPERSEDED by [RATIFIED] Option A)
**Was:** auto-apply live per section as each event streams (no review step). **Now:** the flow **buffers** all `section` events then builds the review doc at `done` (as the code already does, `[id]/index.tsx:1231-1239`). Review IS a distinct step: the `contentOptimizer` atoms hold proposed changes; the user Accepts/Rejects each; Save resolves and persists. The live score still ticks as the stream progresses (Part 2) and the gauge **odometer animates to the new score on Save** — but the HTML is committed only on Save, not spliced live. This is the ratified Option-A behavior and matches Part 8's "small, precise, reviewable" intent.

### OD-4 — Animation tech: GSAP vs CSS keyframe
**Recommendation: CSS keyframe for the looping shimmer/glow; GSAP (and the existing `motion/react` odometer) for one-shot transitions.** The shimmer is an infinite loop while a section is `active` — a CSS `@keyframes` (new `aoShimmer` in `styles/globals.css`, using design tokens) is the right tool and matches existing `surferLoaderSweep`/`spin`/`barPulse` patterns. The "Improved" flash, the fade-out, and the floating "+N" pop are one-shot entrances — use the project GSAP layer (`lib/motion/gsap.ts` + reuse `useEntrance`). The gauge number roll on Save reuses the existing `ScoreGauge` odometer (`motion/react`). Rationale: CSS loops are cheaper and need no JS ticker; GSAP owns discrete entrances per project standard. All honor `prefersReducedMotion()` (`gsap.ts:32`).

### OD-5 — Messaging source: client helper vs server strings
**Recommendation: a small PURE client helper `lib/optimizeMessaging.ts` mapping `{focus, mode, reason}` -> human copy.** Rationale: keeps copy iterable without an endpoint deploy, keeps the endpoint free of presentation strings (Part 8: endpoint only adds the three raw fields), and makes the mapping unit-testable in isolation. Server sends DATA (`focus`/`mode`/`reason`), client owns WORDS. This helper also feeds the **Adjustments list** labels (Enhancement 2).

---

## The SSE contract G REQUIRES from the endpoint

G needs three additive fields on the existing `section` event. These are the **only** endpoint changes G depends on, provided by companion F + D endpoint work — G does not write the endpoint. All three already exist on `PlanStep` after F (`focus` since D at `lib/optimizationPlanner.ts:17`; `reason` since D at `:23`; `mode` added by F). The `SectionEvent` type in `lib/optimizeSectionEvents.ts` **already declares** `focus?`/`mode?`/`reason?` as optional and `buildSectionEvent(section, result?, step?)` **already forwards them** when a `step` is passed — so this contract is largely in place; the remaining work is endpoint wiring (F/D) + defensive client reads (G).

```ts
// lib/optimizeSectionEvents.ts — the additive fields (ALREADY present as optional)
export type SectionEvent = {
   sectionId: string;
   index: number;
   headingText: string;
   oldHtml: string;
   newHtml: string;
   changed: boolean;
   // -- consumed by G (sourced verbatim from PlanStep; never re-derived) --
   focus?: StepFocus;        // seo-terms | ai-coverage | readability | expand | skip
   mode?: EditMode;          // less | normal | expand   (F)
   reason?: string;          // planner human reason, e.g. "Intent bucket weak"
};
```

**Endpoint wiring G requires (F/D provide it):** `buildSectionEvent(section, result, step)` must be CALLED with the `step` for BOTH the skip branch (`optimize-sections.ts:148`) and the changed branch (`:188`) so `focus`/`mode`/`reason` land on the payload. The builder already copies them (`optimizeSectionEvents.ts:28`). No score is emitted from the server (OD-1). If the human chooses the endpoint-emitted AI delta (Part-8 resolution C), the contract additionally gains an optional `scores?: { seo: number; ai: number }` — but the **recommended** contract is the three string/enum fields only.

**Boundary contract (who owns what):**
- **F/D own:** setting `focus`/`mode`/`reason` on `PlanStep`; passing `step` into `buildSectionEvent` at the two endpoint call sites. (The `SectionEvent` type + builder already carry the optional fields.)
- **G owns:** consuming them client-side; all UI/animation/review-flow; `lib/optimizeMessaging.ts`; the live-score diff; the summary header + Adjustments panel; the Save-confirm modal + saved toast; the word-diff enhancement.
- **Shared, coordinate:** the `SectionEvent` type (already widened). G client code reads defensively (missing `focus`/`mode` -> generic copy) so G can merge even if F lands the endpoint wiring later.

---

## The 8 parts as concrete component/state/flow specs

### Part 1 — Active-section animation (exactly one active)
- **State:** the run is sequential (endpoint streams `section` events in `plan.steps` order). Client keeps `activeSectionId: string | null`. On `meta`, set it to the FIRST section id; as each `section` event arrives, advance to the next. When the review doc is built (`done`), `buildReviewDoc` already marks the first changed section `active` and the rest `pending`.
- **Node attr:** the `contentOptimizer` node already has a `status` attr (`pending | active | accepted | rejected`, `contentOptimizerNode.ts:24-27`). G extends the accepted values to `pending | active | accepted | rejected | improved` (`improved` = accepted with a positive delta -> check + float). No behavioural code change — it is a string attr.
- **Visual:** active = shimmer overlay + light glow border + status label. Shimmer via new CSS keyframe `aoShimmer`. Glow = `boxShadow: 0 0 0 3px rgba(120,58,251,0.12)` (brand `#783AFB` at 12%), `border: 1px solid var(--purple-40)` (the NodeView already uses `--purple-40` for the active border). Status label pinned top-left of the box, from `sectionStatusLabel(...)`.
- **Never whole-doc:** only the single active node renders the shimmer; every other node is static.

### Part 2 — Live Content Score as the run streams (+ odometer on Save)
- **When:** the whole-document content score updates as sections stream in and as the user Accepts changes; the gauge **odometer animates to the new score on Save**.
- **How:** re-run `computeContentScore(...)` (OD-1) on the current doc HTML -> `newScore`. Compare to `preScoreRef`. If `newScore - preScoreRef > 0`, drive the `ScoreTrio`/`ScoreGauge` SEO/overall gauges up by the real delta (reuse the existing `deltas` prop on `ScoreTrio`, `ScoreTrio.tsx:47,64-66`, and the odometer motion in `ScoreGauge`, `:82-94`), AND pop a floating "+N SEO" near the section (Part 7). The summary-header gauge (Enhancement 1) shows the same delta as an `old -> new` roll.
- **AI Search:** the label "Improving AI Search…" is shown for `focus === ai-coverage` sections (Part 6), but the numeric `+N AI Search` float is gated by the Part-8 resolution (OD-1 caveat). MVP: no numeric AI float; content/SEO float only.

### Part 3 — Real evaluation (no fake improvement)
- **Single source of truth:** the delta gate is `newScore > oldScore`, computed by the SAME pure `computeContentScore` the editor uses (`lib/contentScore.ts:386`). No heuristic, no "words added" proxy for the score animation. (The word-delta stats in `OptimizeResultsPanel` are shown separately as "Words added", NOT as the score.)
- **Gate:** `delta = round(newScore) - round(oldScore)`. `delta <= 0` -> no ScoreTrio bump, no float; node stays `accepted`. `delta > 0` -> node status `improved`, ScoreTrio bumps by `delta`, float shows `+delta SEO`. This gating is a pure helper `scoreDeltaGate(oldScore, newScore)` -> `{ animate, delta }` (unit-tested).
- **Note:** because the score is whole-document, a section that improves its own text but does not move any document-level slot yields `delta === 0` -> correctly no animation (honest).

### Part 4 — Tracked-changes review UX ([RATIFIED] Option A — KEEP Accept/Reject)
- **Review doc, not auto-apply:** on `done` with `changedCount > 0`, `buildReviewDoc(orderedEvents)` builds the review doc (as today, `[id]/index.tsx:1235`); `setContent(reviewHtml, {emitUpdate:false})` enters review WITHOUT triggering autosave. Changed sections are `contentOptimizer` atoms; unchanged sections pass through verbatim.
- **Per-change ✓/✗ (KEEP):** `ContentOptimizerNodeView.tsx` keeps its floating Accept/Reject toolbar. `handleAccept` splices `newHtml`; `handleReject` splices `oldHtml` (both real PM transactions, `:44-55`). The word-level diff body (Enhancement 3) sits between the ✓/✗ controls.
- **Completion:** the existing review-completion effect (`[id]/index.tsx:1266-1279`) counts remaining `contentOptimizer` nodes; when the user has resolved every one, it syncs the resolved HTML and returns to idle. G keeps this.
- **Bar (KEEP + extend):** `OptimizeReviewBar.tsx` stays a status bar with prev/next nav, `Cancel`, and `Save`. Its subtitle updates to the Less-mode line (Part 6). `Cancel` opens the existing cancel-confirm modal; `Save` opens the NEW **Save-confirm modal** (Enhancement 5).
- **Save:** `handleSaveOptimizeRun` resolves all atoms (`resolveAllOptimizerNodes`, `:1302`) then `doSave('auto_optimize', …)` persists the version snapshot. On success, show the Option-A saved toast + Version History button (Enhancement 5).
- **Undo/history preserved:** Accept/Reject go through `editor.chain().insertContentAt(...)` — normal PM transactions -> native undo stack intact. Post-save revert is Version History (each Save is an `auto_optimize` version).

### Part 5 — Less-Mode messaging (minimal upgrades, never rewrites)
- Copy derived by `lib/optimizeMessaging.ts`. Allowed: "Improved AI Search coverage", "Added one missing entity", "Clarified answer intent", "Strengthened authority", "Improved citation readiness", "Improved readability". Forbidden: "Rewrote section", "Expanded section", "Generated content" — UNLESS `mode === expand`, which unlocks "Expanded thin content".
- The per-section RESULT chip (in the NodeView `improved` state AND in the Adjustments list) uses `sectionResultLabel({focus, mode, reason})`.

### Part 6 — Status messaging by focus (active-section label)
- `sectionStatusLabel({focus, mode, reason})` -> the live label while a section is active AND the bar subtitle:
  - `focus === seo-terms` -> "Improving SEO coverage…"
  - `focus === ai-coverage` -> "Improving AI answer readiness…" (and if `reason` signals authority, "Strengthening factual authority…")
  - `focus === readability` -> "Improving readability…"
  - `focus === expand` OR `mode === expand` -> "Expanding thin content…"
  - `focus === skip` -> "Already optimized." (skip sections are not shown as atoms; used only if a skip chip is shown)
  - fallback (missing focus) -> "Optimizing section…"
- **Note:** there is NO `authority` value in `StepFocus` (`optimizationPlanner.ts:10`) — authority/knowledge guidelines map to `focus: ai-coverage` (F design; `focusFor` at `optimizationPlanner.ts:75-77`). So "Strengthening factual authority…" must be derived from `reason`/guideline group, NOT from a nonexistent `focus === authority`. The helper takes `reason` for this refinement.

### Part 7 — Visual polish
- **Active:** shimmer (`aoShimmer`) + glow (brand 12%) + status label + subtle pulsing loading dot.
- **On accept (delta>0):** brief "Improved" pill (success `#1AB25E`) fades in then out (~1.2s) via GSAP; floating "+N SEO" chip appears near the section top-right and fades after ~2.5s.
- **On accept (delta<=0):** node settles to accepted state with no float, optionally a muted "Applied".
- **Float chip:** `AoScoreFloat` component — absolutely positioned, `color: #1AB25E`, `var(--font-family-primary)`, GSAP entrance (rise + fade) then auto-remove.
- **On Save:** the gauge odometer (`ScoreGauge`) rolls from old to new score; the summary-header tiles reflect the committed run.

### Part 8 — Overall feel
"Not a rewrite. An upgrade." One section at a time; user sees exactly what the model works on; immediate (honest) SEO impact per change; small, precise, reviewable edits committed on Save. Enforced by: single `activeSectionId`; buffered review doc + per-change Accept/Reject; `scoreDeltaGate`; Save-confirm modal; Less-mode copy.

---

## Enhancements (from the Surfer reference screenshots)

### E1 — Summary header in the Auto-Optimize panel
Reuse the dual-arc gauge trio (`ScoreTrio` / `ScoreGauge`) as the header, plus **three stat tiles** and a **"✓ Auto-Optimize completed"** state. This upgrades the existing (unwired) `OptimizeResultsPanel.tsx` and wires it into the reviewing state.
- **Gauge:** the SEO | overall | AI Search trio, showing `preScore -> postScore` via the odometer + green `↑N` delta badge (already supported by `ScoreGauge`/`ScoreTrio`).
- **Three tiles** (replacing/relabelling the current "Sections optimized / Words added / Score" tiles to the Surfer copy):
  - **"Boosted content score {old} → {new}"** — `old = round(preScoreRef)`, `new = round(postScore)` (client-side `computeContentScore`, OD-1).
  - **"Optimized Sections {N}"** — `N = changedCount` = count of non-skip / `changed:true` section events (already `optimizeMetaRef.current.changedCount`).
  - **"Added SEO Entities {N}"** — count derived from the applied guideline/entity changes: the number of `adjustments` whose `type`/label denotes an added entity/fact (from `optimizeStore` `adjustments[]` / the SSE `focus`/`reason`), summed across accepted sections. If the entity count is not derivable from the SSE payload today, fall back to the count of `ai-coverage`/entity-focused accepted sections and flag the exact source for the human (see "Screenshot vs code" below).
- **"✓ Auto-Optimize completed"** headline (success check) with the Option-A subtitle "Review the changes below, then Save to keep them."

### E2 — "Adjustments" list panel (the "upgrade, not rewrite" summary)
Below the header, a **scrollable list of per-change cards** — the existing adjustments list in `OptimizeResultsPanel` grows from `{heading, wordDelta}` rows into richer cards. Each card shows:
- a short **human label** derived from `focus`/`mode`/`reason` via `lib/optimizeMessaging.ts` `sectionResultLabel(...)` — e.g. "Added entities and facts", "Added one missing entity", "Clarified answer intent", "Strengthened authority";
- the actual **added text snippet** (from `optimizeStore` `adjustments[].snippet`, or the added segments of the word diff);
- (where relevant) a **row of source favicons** — reuse the favicon pattern already in `ContentScorePanel` (`https://www.google.com/s2/favicons?domain=…&sz=16`, `ContentScorePanel.tsx:183`) over `adjustments[].sourceDomains`.
- Labels come EXCLUSIVELY from `focus`/`mode`/`reason` (never "rewrote/generated" unless `mode==='expand'`).

### E3 — Word-level tracked-changes diff in the editor (enhance what exists)
`ContentOptimizerNodeView.tsx` **already** renders a real word-level inline diff (green added / gray strikethrough) via `lib/optimizeWordDiff.ts` for simple sections. The enhancement:
- **Keep** the word-level diff as the primary render (it already satisfies "additions green, deletions strikethrough — a real inline diff, not a block replace"). It uses the existing `diff` package (`diffWordsWithSpace` + a char sub-diff for near-identical inflections) — a small, already-present dependency, **no new heavy diff lib needed**.
- **Deletion color:** today deletions are muted gray (`#9f9fa9` strikethrough). The screenshots use a red/muted strikethrough; keep muted gray as the default and note red (`#FF6F77`) as an option for the human (see "Screenshot vs code").
- **Block-complex fallback:** the two-block removed/added render (tables/lists/images/multi-heading) stays — a true word diff of table markup would be unsafe. This is a deliberate, documented limitation.
- The per-change ✓/✗ controls stay beside the diff (KEEP, Part 4).

### E4 — Odometer score animation on Save + floating "+N SEO"
On Save, the header gauge + `ScoreTrio` odometer (`ScoreGauge` `motion/react` roll) animates from old to new score; the per-section floating "+N SEO" (Part 7, `AoScoreFloat`) fires as each positive-delta section is accepted. Both stay aligned with the E1 header tiles (same `preScore`/`postScore` numbers).

### E5 — Save-confirmation modal + saved toast + Version History
- **Save-confirm modal** (`OptimizeSaveModal.tsx`, new — mirror `OptimizeCancelModal`): title "Save changes?", body "Are you sure you want to save? Changes will be applied to your article.", buttons `Continue editing` (secondary, closes) / `Save` (primary brand). The bar's `Save` opens this instead of saving directly.
- **Saved toast:** on `handleSaveOptimizeRun` success, replace the plain "Auto-Optimize changes saved" toast with a richer one — "✓ Your changes have been saved / You can see your changes in the Version History" + a **Version History** button (opens the existing `showHistory` panel, `[id]/index.tsx:404`). Implement as a custom `toast.custom(...)` (react-hot-toast is already imported) or a small inline toast body.
- **Post-save revert = Version History** — no inline revert; the `auto_optimize` version snapshot created by `doSave` is the undo path (per-version "Restore" already exists, `:767`).

---

## Visual specs (design tokens only)

**New CSS keyframe (`styles/globals.css`, next to `surferLoaderSweep`/`skeletonPulse`):**
```css
/* Auto-Optimize active-section shimmer — brand-tinted sweep, honors reduced motion. */
@keyframes aoShimmer {
  0%   { background-position: -150% 0; }
  100% { background-position: 250% 0; }
}
```
- **Shimmer fill:** a semi-transparent moving gradient using brand purple:
  `background: linear-gradient(100deg, transparent 40%, rgba(120,58,251,0.10) 50%, transparent 60%); background-size: 200% 100%; animation: aoShimmer 1.4s linear infinite;` (brand `#783AFB` at 10%).
- **Active glow border:** `boxShadow: 0 0 0 3px rgba(120,58,251,0.12)`, `border: 1px solid #AA93FD` (input-focus token; the NodeView currently uses `--purple-40` — keep whichever the design system resolves to).
- **Status label:** `color: #52525C` (muted), `fontSize: 12`, `fontWeight: 500`, `var(--font-family-primary)`.
- **Improved pill:** `background: rgba(26,178,94,0.10)`, `color: #1AB25E` (success), `borderRadius: 9999`.
- **+N SEO float:** `color: #1AB25E`, `fontWeight: 600`, `fontVariantNumeric: tabular-nums` (matches `OptimizeResultsPanel.tsx`).
- **Diff added:** `background: rgba(26,178,94,0.18); border-radius: 2px` (already in `renderDiffHtml`). **Diff removed:** `color: #9f9fa9; text-decoration: line-through` (already in `renderDiffHtml`).
- **Summary tiles / Adjustments cards:** card `background: #f8f9ff, border: 1px solid #E4E4E7, borderRadius: 12`; tile value `fontSize: 20, fontWeight: 600, tabular-nums`; favicons 14–16px, `borderRadius: 2`.
- **Save-confirm modal:** identical shell to `OptimizeCancelModal` (420px card, `growOut` animation, design-system shadow); primary `Save` = brand `#783AFB` (or dark `#2F2F34`), secondary `Continue editing` = `#F4F4F5`.
- **Reduced motion:** all shimmer/float/pulse/odometer gated by `prefersReducedMotion()` (`gsap.ts:32`); reduced -> static state, no shimmer, instant score update.

---

## Review-doc atom/store design ([RATIFIED] Option A)

- **`optimizeStore` (`optimizeStore.ts`):** shape KEPT — `Map<sectionId, SectionResult>` where `SectionResult` already has `{oldHtml, newHtml, changed, scores?, adjustments?}`. G ADDS optional `focus?: StepFocus; mode?: EditMode; reason?: string` (for the NodeView result label + Adjustments list + status label), keeping the PM doc light.
- **`contentOptimizerNode.ts`:** `status` attr accepted values extended: `pending | active | accepted | rejected | improved`. Still `atom: true`, still never persisted (the orchestrator resolves atoms to plain content before Save — `resolveAllOptimizerNodes`, `[id]/index.tsx:1302`).
- **`ContentOptimizerNodeView.tsx`:** KEEP the ✓/✗ toolbar + word-level diff. Extend: read `{focus, mode, reason}` from the store for the status label (active) and the `sectionResultLabel` chip; on Accept with a positive delta, show the "Improved" pill.
- **Save:** `resolveAllOptimizerNodes` resolves each atom to `newHtml || oldHtml` (`:1312`) — KEEP. `handleSaveOptimizeRun` already creates the `auto_optimize` version snapshot; only its toast is upgraded (E5).

---

## Live-score + real-evaluation flow (data flow)

```
meta            -> set total; activeSectionId = first section
section (X, changed=false, focus=skip)
                -> advance active; (no atom emitted for skip)
section (X, changed=true)
                -> push to orderedEvents; store.set(X, {old,new,changed,focus,mode,reason})
                -> advance activeSectionId (shimmer moves)
done (changedCount>0)
                -> reviewHtml = buildReviewDoc(orderedEvents)   [first changed = active, rest pending]
                -> setContent(reviewHtml, {emitUpdate:false})    [enter review; no autosave]
                -> render summary header (E1) + Adjustments (E2); bar = "All sections processed" + Save
done (changedCount==0)
                -> "well-optimized, no changes" toast; back to idle (KEEP)
[user reviews]  per change ✓ -> splice newHtml (real txn); re-score; scoreDeltaGate -> if animate: ScoreTrio +=delta + AoScoreFloat; node=improved
                per change ✗ -> splice oldHtml (real txn)
[user Save]     -> Save-confirm modal (E5) -> resolveAllOptimizerNodes -> doSave('auto_optimize') -> odometer rolls to postScore
                -> saved toast + Version History button (E5)
[user Cancel]   -> cancel-confirm modal -> restore preReviewHtmlRef (KEEP)
error           -> toast; restore preReviewHtmlRef (KEEP)
```

`preScore` = `preScoreRef` (computed at `[id]/index.tsx:1159-1161`). The `ScoreTrio` cumulative `deltas` are the sum of positive per-section deltas — the odometer animates from the `deltas`/`postScore`.

---

## Task breakdown (summary; see the plan doc for bite-sized tasks)

1. `lib/optimizeMessaging.ts` (pure `sectionStatusLabel`/`sectionResultLabel`/`scoreDeltaGate`) + tests.
2. `SectionEvent` fields (already optional) — confirm + coordinate endpoint wiring with F/D.
3. `contentOptimizerNode.ts` status enum (+`improved`) + `optimizeStore` optional `focus`/`mode`/`reason`.
4. `ContentOptimizerNodeView.tsx` — KEEP ✓/✗ + word diff; add status label + result chip + "Improved" pill.
5. `AoScoreFloat.tsx` + `aoShimmer` keyframe.
6. Summary header wiring — render `OptimizeResultsPanel` (upgraded, E1) in the reviewing state; relabel tiles to Surfer copy.
7. Adjustments list (E2) — richer cards + source favicons.
8. `OptimizeSaveModal.tsx` (E5) + saved toast + Version History button.
9. Orchestration in `[id]/index.tsx` — `activeSectionId` + live re-score + `scoreDeltaGate` + wire Save-modal; KEEP `buildReviewDoc`.
10. `OptimizeReviewBar.tsx` status-by-focus subtitle; Save opens the confirm modal.
11. Wire-up + reduced-motion + defensive missing-field handling.

---

## Files

**Create:** `lib/optimizeMessaging.ts`; `components/articles/AoScoreFloat.tsx`; `components/articles/OptimizeSaveModal.tsx`; `__tests__/lib/optimizeMessaging.test.ts`.
**Modify:** `components/articles/contentOptimizerNode.ts`; `components/articles/ContentOptimizerNodeView.tsx`; `components/articles/optimizeStore.ts`; `components/articles/OptimizeReviewBar.tsx`; `components/articles/OptimizeResultsPanel.tsx`; `pages/articles/[id]/index.tsx`; `styles/globals.css`. Possibly `lib/optimizeSectionEvents.ts` only if endpoint wiring needs it (fields already present; F/D territory).
**Reuse (no change needed):** `lib/optimizeWordDiff.ts` (word diff already done), `lib/optimizeStats.ts` (`computeOptimizeStats`), `components/articles/ScoreTrio.tsx` / `ScoreGauge.tsx` (gauge + odometer), `lib/optimizeReviewDoc.ts` (`buildReviewDoc` — KEPT, NOT removed).
**Untouched (Part 8 guarantee):** `lib/optimizationPlanner.ts`, `lib/optimizeGuidelineRouting.ts`, `lib/recommendationEngine.ts`, `lib/contentScore.ts`, `lib/aiSearchScore.ts`, `buildArticleContext`, the endpoint planner/ROI/credit/abort/retry logic.

---

## Screenshot vs code — items the human MUST resolve

1. **AI Search live delta (Parts 2/7) has no honest client-side source.** `computeAiSearchScore` (`lib/aiSearchScore.ts:19-31`) is a pure function of a domain-level `AiVisibilitySummary` (prompt citation rate, competitor pressure, extractability) — NOT of the edited section HTML. Editing a section and re-running it yields the identical number, so a live "+2 AI Search per section" cannot be produced client-side without either (A) a heuristic AI proxy over the section text, (B) a per-section AI re-evaluation LLM/judge call, or (C) an endpoint-emitted score. **Recommended MVP: (A-as-label) — SEO/content float only**, with a qualitative "Improved AI Search coverage" label (no number) for `focus === ai-coverage`. Option C forces planner/endpoint work (Part-8 violation) and is only for a real numeric AI float.
2. **"Added SEO Entities {N}" source (E1).** The screenshots show an entity count, but the current SSE `section` payload carries no explicit entity count — only `focus`/`mode`/`reason` and `adjustments[]` (`type`/`snippet`/`sourceDomains`). The human must confirm whether: (a) `adjustments[].type === 'entity'` (or similar) is populated by the endpoint/section-edit today, or (b) G approximates N as the count of accepted `ai-coverage`/entity-focused sections. If neither is honest, this tile should show sections-optimized or be dropped rather than fabricate a number.
3. **Adjustments snippets + source favicons (E2).** `OptimizeResultsPanel` currently shows `{heading, wordDelta}` only; the richer cards need `adjustments[].snippet` and `adjustments[].sourceDomains` to actually be populated (they are optional fields on `SectionResult` but nothing writes them yet). The human must confirm the endpoint/section-edit path emits them, or E2 degrades to label + word-delta without snippet/favicons.
4. **Deletion color in the diff (E3).** Code uses muted gray strikethrough (`#9f9fa9`); the screenshots suggest red. Keep gray (matches "muted") or switch to error `#FF6F77` — a one-line design choice for the human.
5. **`buildReviewDoc` retained.** The prior doc marked `buildReviewDoc` for removal (auto-apply plan). Option A **KEEPS it** — it is the mechanism that turns the buffered stream into the review doc. Do NOT remove it.
