# Auto-Optimize UX — Less-Mode presentation (Sub-project G) — Design

**Date:** 2026-07-01
**Branch:** `feature/less-mode`
**Status:** Draft v1 — awaiting decision to execute. Direction: the 8-part brief (approved) + tech-lead Part 8.
**Depends on:** the existing Auto-Optimize section-streaming flow (D, `pages/api/articles/optimize-sections.ts`) and the companion **Less Mode (decision logic, Sub-project F)** `docs/superpowers/specs/2026-07-01-auto-optimize-less-mode-design.md`, which adds `PlanStep.mode: EditMode` and owns ALL planner changes.

## Goal

A **presentation-only** layer over the Auto-Optimize section stream: one section animates at a time (shimmer + status label), the Content Score ticks up live after each section IF it truly improved, review collapses to a single **"Revert changes"** action (applying is the default), and every message says "small upgrade", never "rewrite". This sub-project **CONSUMES** the `focus`/`mode`/`reason` the planner already produces (`PlanStep`) plus the ordered `section` SSE events — it **never alters a planner decision** (routing, ROI, `expectedLift`, guideline assignment, mode selection).

`Planner (D+F) "where + whether + how much" -> section SSE stream -> UX (G) "how it looks + how it is reviewed".`

## The "Not a rewrite. An upgrade." philosophy

Every visible cue reinforces one message: the model made a **small, precise, revertible** edit — not a rewrite. Four rules follow from that:

1. **One section at a time.** Exactly one section is `active` (shimmer + glow + status). The whole document is never animated. Shimmer clears the instant that section's `section` event arrives.
2. **Immediate, honest impact.** After a section resolves, re-score it; animate `+N SEO` / `+N AI Search` ONLY when the delta is real and positive. `delta <= 0` -> no animation, no fake number.
3. **Applying is the default.** The new HTML is spliced in live as each event streams (auto-accepted). The only button is **Revert changes**, which restores `oldHtml`. Undo/history is preserved.
4. **Minimal-upgrade language.** Copy is derived from `focus`/`mode`/`reason`: "Improved AI Search coverage", "Added one missing entity", "Strengthened authority". Never "Rewrote / Expanded / Generated" — UNLESS `mode === 'expand'` (F deliberate EXPAND).

## Non-goals (explicitly OUT)

- **No planner/routing/ROI/`expectedLift`/guideline-assignment/mode-selection change.** All of that is D + F. G reads their output.
- **No new LLM call.** Re-scoring for the live delta is the LOCAL pure `computeContentScore` (Part 3), client-side.
- **No new DB column, no persistence-shape change.** The `auto_optimize` version snapshot on Save (`handleSaveOptimizeRun`) is unchanged.
- **No change to the credit/abort/retry machinery** in the endpoint loop.

## Open decisions (recommendation + rationale)

### OD-1 — Per-section score delta: client-side re-score vs endpoint-emitted
**Recommendation: client-side re-score (SEO/content only), via the existing `computeContentScore`.** After a section `newHtml` is applied, recompute the whole-document content score client-side (the page already holds `scoreData`, `wordCount`, `headingCount`, `coverageItems`, `article.target_keyword` — used at `pages/articles/[id]/index.tsx:1159-1161`) and diff against the score captured just before that section applied. Rationale: keeps Part 8 clean — the endpoint needs **no scoring change**, only the additive `section`-event fields (`focus`, `mode`, `reason`) that F already threads onto `PlanStep`. `computeContentScore` is pure and synchronous, so a per-section re-score is cheap.
**Caveat (Part-8 tension, MUST be resolved by the human):** the **AI Search** score is NOT client-re-scorable. `computeAiSearchScore(summary)` (`lib/aiSearchScore.ts:19`) is a function of an `AiVisibilitySummary` (prompts cited, competitor citations, extractability_score) measured at the DOMAIN level — independent of the edited section HTML text. Re-running it on new HTML yields the identical number. Therefore a live "`+2 AI Search`" per section (Parts 2/7) has **no honest client-side source today**. See "Part-8 tension" below; the recommended MVP shows the live delta for **content/SEO only** and derives the AI label from `focus === 'ai-coverage'` without a numeric AI delta.

### OD-2 — Revert scope: per-section, global, or both
**Recommendation: both — per-section Revert (primary) + a global "Revert all" in the bar.** Per-section is the atomic Less-mode gesture ("undo just this upgrade"); global covers "undo the whole run". Both are cheap on the existing store (each `contentOptimizer` position still carries `oldHtml` in `optimizeStore`). Rationale: Part 4 centres on a single "Revert changes" button per applied section; a global escape hatch (replacing today Cancel) costs one bar button and reuses `preReviewHtmlRef`.

### OD-3 — Auto-apply live per section vs after the run
**Recommendation: auto-apply LIVE, per section, as each `section` event streams.** This is the only flow that satisfies "one section at a time + live score + applying is the default". Today the flow buffers all events then builds a review doc at `done` (`[id]/index.tsx:1231-1239` calls `buildReviewDoc`). G changes the client orchestration so each `changed` event immediately splices `newHtml` into the live doc, marks the NEXT changed section `active`, re-scores, and animates the delta. There is no separate "review step"; review == the applied doc with per-section Revert affordances. Rationale: matches Part 8 exactly and removes buffered-review latency.

### OD-4 — Animation tech: GSAP vs CSS keyframe
**Recommendation: CSS keyframe for the looping shimmer/glow; GSAP for one-shot transitions.** The shimmer is an infinite loop while a section is `active` — a CSS `@keyframes` (new `aoShimmer` in `styles/globals.css`, using design tokens) is the right tool and matches existing `surferLoaderSweep`/`spin` patterns. The "Improved" flash, the fade-out, and the floating "+N" pop are one-shot entrances — use the project GSAP layer (`lib/motion/gsap.ts` + reuse `useEntrance`). Rationale: CSS loops are cheaper and need no JS ticker; GSAP owns discrete entrances per project standard (`lib/motion/useEntrance.ts`). Both honor `prefersReducedMotion()` (`gsap.ts:32`).

### OD-5 — Messaging source: client helper vs server strings
**Recommendation: a small PURE client helper `lib/optimizeMessaging.ts` mapping `{focus, mode, reason}` -> human copy.** Rationale: keeps copy iterable without an endpoint deploy, keeps the endpoint free of presentation strings (Part 8: endpoint only adds the three raw fields), and makes the mapping unit-testable in isolation. Server sends DATA (`focus`/`mode`/`reason`), client owns WORDS.

---

## The SSE contract G REQUIRES from the endpoint

G needs three additive fields on the existing `section` event. These are the **only** endpoint changes G depends on, provided by companion F + D endpoint work — G does not write the endpoint. All three already exist on `PlanStep` after F (`focus` since D at `lib/optimizationPlanner.ts:17`; `reason` since D at `:23`; `mode` added by F). The endpoint `buildSectionEvent` call must forward them.

```ts
// lib/optimizeSectionEvents.ts — REQUIRED additive fields on SectionEvent
export type SectionEvent = {
   sectionId: string;
   index: number;
   headingText: string;
   oldHtml: string;
   newHtml: string;
   changed: boolean;
   // -- ADDED for G (sourced verbatim from PlanStep; never re-derived) --
   focus: StepFocus;        // seo-terms | ai-coverage | readability | expand | skip
   mode: EditMode;          // less | normal | expand   (F)
   reason: string;          // planner human reason, e.g. "Intent bucket weak"
};
```

**Endpoint wiring G requires (F/D provide it):** `buildSectionEvent(section, result, step)` must copy `step.focus`, `step.mode`, `step.reason` onto the payload for BOTH the skip branch (`optimize-sections.ts:148`) and the changed branch (`:188`). No score is emitted from the server (OD-1). If the human chooses the endpoint-emitted AI delta (Part-8 resolution C), the contract additionally gains an optional `scores?: { seo: number; ai: number }` — but the **recommended** contract is the three string/enum fields only.

**Boundary contract (who owns what):**
- **F/D own:** setting `focus`/`mode`/`reason` on `PlanStep`; forwarding them through `buildSectionEvent`; the `SectionEvent` type edit in `lib/optimizeSectionEvents.ts` (imported by the endpoint, D/F territory).
- **G owns:** consuming them client-side; all UI/animation/review-flow; `lib/optimizeMessaging.ts`; the live-score diff; the Revert-only NodeView + bar.
- **Shared, coordinate:** the `SectionEvent` type. G plan lists the exact field additions so F can land them; G client code reads them defensively (missing `focus`/`mode` -> generic copy) so G can merge even if F lands the fields slightly later.

---

## The 8 parts as concrete component/state/flow specs

### Part 1 — Active-section animation (exactly one active)
- **State:** the run is sequential (endpoint streams `section` events in `plan.steps` order). Client keeps `activeSectionId: string | null`. On `meta`, set it to the FIRST section id. On each `section` event for section X: clear X active state, then set `activeSectionId` to the next not-yet-arrived section id.
- **Node attr:** the `contentOptimizer` node already has a `status` attr (`pending|active|...`, `contentOptimizerNode.ts:24-27`). G reuses `status: active` for the shimmer, and adds terminal statuses `improved` (delta>0 -> check + float) and `applied` (delta<=0 -> applied, no float).
- **Visual:** active = shimmer overlay + light glow border + status label. Shimmer via new CSS keyframe `aoShimmer`. Glow = `boxShadow: 0 0 0 3px rgba(120,58,251,0.12)` (brand `#783AFB` at 12%). Status label pinned top-left of the box.
- **Never whole-doc:** only the single active node renders the shimmer; every other node is static.

### Part 2 — Live Content Score after EACH section
- **When:** immediately on each `changed` section event, after `newHtml` is applied.
- **How:** re-run `computeContentScore(...)` (OD-1) on the current full doc HTML -> `newScore`. Compare to the score captured just before this section applied (`prevScoreRef`). If `newScore - prevScoreRef > 0`, animate the ScoreTrio SEO/overall gauges up by the real delta (reuse the existing `deltas` prop on `ScoreTrio`, `ScoreTrio.tsx:47,64-66`, and the odometer motion wired to `ScoreGauge`), AND pop a floating "+N SEO" near the section (Part 7). Update `prevScoreRef = newScore`.
- **AI Search:** the label "Improving AI Search…" is shown for `focus === ai-coverage` sections (Part 6), but the numeric `+N AI Search` float is gated by the Part-8 resolution (OD-1 caveat). MVP: no numeric AI float; content/SEO float only.

### Part 3 — Real evaluation (no fake improvement)
- **Single source of truth:** the delta gate is `newScore > oldScore`, computed by the SAME pure `computeContentScore` the editor uses (`lib/contentScore.ts:386`). No heuristic, no "words added" proxy for the score animation.
- **Gate:** `delta = round(newScore) - round(oldScore)`. `delta <= 0` -> node status `applied`, no ScoreTrio bump, no float. `delta > 0` -> node status `improved`, ScoreTrio bumps by `delta`, float shows `+delta SEO`. This gating is a pure helper `scoreDeltaGate(oldScore, newScore)` -> `{ animate, delta }` (unit-tested).
- **Note:** because the score is whole-document, a section that improves its own text but does not move any document-level slot yields `delta === 0` -> correctly no animation (honest).

### Part 4 — Revert-only review UX (replaces Accept/Reject)
- **Auto-apply:** on each `changed` event, splice `newHtml` into the doc at the section position immediately (OD-3). No pending "review doc" build; `buildReviewDoc` "atom per changed section" is replaced by "apply then keep a revert handle".
- **Revert handle:** the applied section is wrapped in a lightweight `contentOptimizer` atom whose `status` is terminal (`applied`/`improved`) and whose NodeView shows the applied content + a single **Revert changes** control. `optimizeStore` still holds `{oldHtml, newHtml}` for that `sectionId`, so Revert = `splice(oldHtml)` (mirrors today `handleReject`, `ContentOptimizerNodeView.tsx:55`, minus the Accept path).
- **NodeView change:** `ContentOptimizerNodeView.tsx` loses the two-button Accept/Reject toolbar (`:137-166`) and the removed/added diff blocks; instead it renders the APPLIED `newHtml` (or a shimmer while active) + a single Revert button. `handleAccept` deleted; `handleReject` becomes `handleRevert`.
- **Bar change:** `OptimizeReviewBar.tsx` drops "Accept or reject changes" copy and the Save-only-in-review model; it becomes a status bar (Part 6) + a global **Revert all** (OD-2) + Save. Save persists the applied doc as today (`handleSaveOptimizeRun`); "Revert all" restores `preReviewHtmlRef`.
- **Undo/history preserved:** applying and reverting both go through `editor.chain().insertContentAt(...)` — normal PM transactions -> native undo stack intact. G must NOT use `emitUpdate:false` for the live applies the user should be able to undo (contrast the review-entry `setContent(..., {emitUpdate:false})` at `:1237`, which G removes).

### Part 5 — Less-Mode messaging (minimal upgrades, never rewrites)
- Copy derived by `lib/optimizeMessaging.ts`. Allowed: "Improved AI Search coverage", "Added one missing entity", "Clarified answer intent", "Strengthened authority", "Improved citation readiness", "Improved readability". Forbidden: "Rewrote section", "Expanded section", "Generated content" — UNLESS `mode === expand`, which unlocks "Expanded thin content".
- The per-section RESULT chip (after resolve) uses `sectionResultLabel({focus, mode, reason})`.

### Part 6 — Status messaging by focus (active-section label)
- `sectionStatusLabel({focus, mode, reason})` -> the live label while a section is active:
  - `focus === seo-terms` -> "Improving SEO coverage…"
  - `focus === ai-coverage` -> "Improving AI answer readiness…" (and if `reason` signals authority, "Strengthening factual authority…")
  - `focus === readability` -> "Improving readability…"
  - `focus === expand` OR `mode === expand` -> "Expanding thin content…"
  - `focus === skip` -> "Already optimized." (skip sections are not animated; used only if a skip chip is shown)
  - fallback (missing focus) -> "Optimizing section…"
- **Note:** there is NO `authority` value in `StepFocus` (`optimizationPlanner.ts:10`) — authority/knowledge guidelines map to `focus: ai-coverage` (F design; `focusFor` at `optimizationPlanner.ts:75-77`). So "Strengthening factual authority…" must be derived from `reason`/guideline group, NOT from a nonexistent `focus === authority`. The helper takes `reason` for this refinement.

### Part 7 — Visual polish
- **Active:** shimmer (`aoShimmer`) + glow (brand 12%) + status label + subtle pulsing loading dot.
- **On finish (delta>0):** brief "Improved" pill (success `#1AB25E`) fades in then out (~1.2s) via GSAP; floating "+N SEO" chip appears near the section top-right and fades after ~2.5s.
- **On finish (delta<=0):** node settles to applied state with no float, optionally a muted "Applied".
- **Float chip:** `AoScoreFloat` component — absolutely positioned, `color: #1AB25E`, `var(--font-family-primary)`, GSAP entrance (rise + fade) then auto-remove.

### Part 8 — Overall feel
"Not a rewrite. An upgrade." One section at a time; user sees exactly what the model works on; immediate (honest) SEO impact per change; small, precise, easily-revertible edits. Enforced by: single `activeSectionId`; per-section auto-apply; `scoreDeltaGate`; per-section Revert; Less-mode copy.

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
- **Active glow border:** `boxShadow: 0 0 0 3px rgba(120,58,251,0.12)`, `border: 1px solid #AA93FD` (input-focus token from CLAUDE.md).
- **Status label:** `color: #52525C` (muted), `fontSize: 12`, `fontWeight: 500`, `var(--font-family-primary)`.
- **Improved pill:** `background: rgba(26,178,94,0.10)`, `color: #1AB25E` (success), `borderRadius: 9999`.
- **+N SEO float:** `color: #1AB25E`, `fontWeight: 600`, `fontVariantNumeric: tabular-nums` (matches `OptimizeResultsPanel.tsx:49`).
- **Reduced motion:** all shimmer/float/pulse gated by `prefersReducedMotion()` (`gsap.ts:32`); reduced -> static applied state, no shimmer, instant score update.

---

## Revert-only atom/store design

- **`optimizeStore` (`optimizeStore.ts`):** unchanged shape — still `Map<sectionId, {oldHtml, newHtml, changed, scores?}>`. G optionally stores per-section `focus`/`mode`/`reason` here too (for the NodeView result label) rather than on node attrs, keeping the PM doc light (same rationale as `ContentOptimizerNodeView.tsx:9-13`).
- **`contentOptimizerNode.ts`:** `status` attr extended: `pending | active | applied | improved | reverted`. Still `atom: true`, still never persisted (the orchestrator resolves atoms to plain content before Save — reuse `resolveAllOptimizerNodes`, `[id]/index.tsx:1302`).
- **`ContentOptimizerNodeView.tsx`:** rewritten to: (a) active -> shimmer box + status label + loading dot; (b) applied/improved -> applied `newHtml` + a single **Revert changes** button (+ check pill on improved); (c) Revert splices `oldHtml` and flips status to reverted (or removes the atom, keeping plain `oldHtml`). Undo works because these are real transactions.
- **Save:** `resolveAllOptimizerNodes` already resolves each atom to `newHtml || oldHtml` (`:1312`) — G keeps this; a reverted section store entry should resolve to `oldHtml`.

---

## Live-score + real-evaluation flow (data flow)

```
meta            -> set total; activeSectionId = first section
section (X, changed=false, focus=skip)
                -> (no apply, no animation) optionally a muted "Already optimized" chip; advance active
section (X, changed=true)
                -> store.set(X, {old,new,focus,mode,reason})
                -> splice newHtml at X position (real PM txn; undoable)
                -> newScore = computeContentScore(fullDocText, …)     [OD-1, pure]
                -> { animate, delta } = scoreDeltaGate(prevScore, newScore)
                -> if animate: ScoreTrio deltas += delta; AoScoreFloat("+delta SEO"); node status=improved
                   else:       node status=applied
                -> prevScore = newScore
                -> activeSectionId = next section id (shimmer moves)
done            -> clear activeSectionId; bar shows summary + Revert all + Save
error           -> toast; restore preReviewHtmlRef (as today)
```

`prevScore` starts at `preScoreRef` (already computed at `[id]/index.tsx:1159-1161`). The ScoreTrio cumulative `deltas` are the sum of positive per-section deltas — the odometer already animates from the `deltas` prop.

---

## Task breakdown (summary; see the plan doc for bite-sized tasks)

1. `lib/optimizeMessaging.ts` (pure helpers + `scoreDeltaGate`) + tests.
2. `SectionEvent` field additions (coordinate with F/D).
3. `contentOptimizerNode.ts` status enum + `optimizeStore` optional fields.
4. `ContentOptimizerNodeView.tsx` Revert-only + active shimmer.
5. `AoScoreFloat.tsx` + `aoShimmer` keyframe.
6. `handleAutoOptimizeSections` live-apply orchestration + `activeSectionId` + per-section re-score.
7. `OptimizeReviewBar.tsx` status-by-focus + Revert-all; `handleRevert`/`handleRevertAll`.
8. Wire-up + reduced-motion + defensive missing-field handling.

---

## Files

**Create:** `lib/optimizeMessaging.ts`; `components/articles/AoScoreFloat.tsx`; `__tests__/lib/optimizeMessaging.test.ts`.
**Modify:** `lib/optimizeSectionEvents.ts` (with F); `components/articles/contentOptimizerNode.ts`; `components/articles/ContentOptimizerNodeView.tsx`; `components/articles/optimizeStore.ts`; `components/articles/OptimizeReviewBar.tsx`; `pages/articles/[id]/index.tsx`; `styles/globals.css`.
**Untouched (Part 8 guarantee):** `lib/optimizationPlanner.ts`, `lib/optimizeGuidelineRouting.ts`, `lib/recommendationEngine.ts`, `lib/contentScore.ts`, `lib/aiSearchScore.ts`, `buildArticleContext`, the endpoint planner/ROI/credit/abort/retry logic.

---

## Part-8 tension the human MUST resolve

**The AI Search live delta (Parts 2/7) has no honest client-side source.** `computeAiSearchScore` (`lib/aiSearchScore.ts:19-31`) is a pure function of a domain-level `AiVisibilitySummary` (prompt citation rate, competitor pressure, extractability) — NOT of the edited section HTML. Editing a section and re-running it yields the identical number, so a live "+2 AI Search per section" cannot be produced client-side without either (A) a heuristic AI proxy over the section text, (B) forcing a per-section AI re-evaluation LLM/judge call, or (C) an endpoint-emitted score. Options and recommendation:

- **(A) Recommended for MVP — SEO/content float only.** Show live `+N SEO` (honest, `computeContentScore`) and, for `focus === ai-coverage` sections, the qualitative label "Improved AI Search coverage" with NO number. Zero planner/endpoint scoring change. Ships the whole feel of Parts 1/4/5/6/7; only the numeric AI float is deferred.
- **(B) AI proxy delta.** Add a client `computeAiReadinessProxy(html)` heuristic (entities/answer-lead/citations present). Honest-ish but a NEW scoring surface G would own — risks scope creep and disagreeing with the real AI score. Not recommended without product sign-off.
- **(C) Endpoint-emitted AI delta.** Endpoint computes an AI-readiness delta per section and emits `scores` on the `section` event. This is a scoring change and lands in F/D territory — **would force planner/endpoint work**, contradicting the "no endpoint scoring change" Part-8-clean goal. Only if product insists on a real numeric AI float per section.

**Ask the human:** confirm (A) for MVP (recommended). If (C), F/D must add the `scores` emission to the SSE contract and own the per-section AI-readiness calc — that is the one thing in this brief that, taken literally (Part 2 "AI Search +2"), can force a planner/endpoint change.
