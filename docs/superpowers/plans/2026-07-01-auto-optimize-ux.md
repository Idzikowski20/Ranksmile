# Auto-Optimize UX — Less-Mode presentation (Sub-project G) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A presentation-only layer over the Auto-Optimize section stream — one section shimmers at a time with a focus-derived status label, the Content Score ticks up live as the run streams and the gauge odometer rolls to the new score on Save, and (Option A, ratified) changes are proposed as a **tracked-changes review doc** the user reviews per-change (KEEP Accept/Reject ✓/✗) then commits with a global **Save** behind a confirmation modal — post-save undo via Version History. All copy says "small upgrade" not "rewrite". CONSUMES `focus`/`mode`/`reason` from `PlanStep` + the ordered `section` SSE events; changes NO planner/routing/ROI/`expectedLift`/guideline/mode logic (Part 8).

**Architecture:** One pure module (`lib/optimizeMessaging.ts` — focus/mode -> copy + `scoreDeltaGate`), two new presentational components (`AoScoreFloat`, `OptimizeSaveModal`), the EXISTING Accept/Reject NodeView extended with a status label + result chip (NOT rewritten), the EXISTING `OptimizeResultsPanel` upgraded to the Surfer summary header + Adjustments cards and wired into the reviewing state, one CSS keyframe, and rewired client orchestration in `pages/articles/[id]/index.tsx` that tracks `activeSectionId`, re-scores live, and routes Save through the confirm modal. The `SectionEvent` type already carries optional `focus`/`mode`/`reason` (endpoint wiring is Sub-project F/D territory).

**Tech Stack:** TypeScript, Next.js (pages), React, TipTap/ProseMirror, GSAP (`lib/motion/*`) + `motion/react` (existing odometer), the `diff` package (existing word diff), Jest. Reuses `lib/contentScore.ts` (`computeContentScore`), `components/articles/ScoreTrio.tsx`/`ScoreGauge`, `components/articles/OptimizeResultsPanel.tsx`, `lib/optimizeStats.ts`, `lib/optimizeWordDiff.ts`, `lib/optimizeReviewDoc.ts` (`buildReviewDoc` — KEPT), `components/articles/optimizeStore.ts`, `lib/optimizeSectionEvents.ts`, `styles/globals.css` keyframes.

**Spec:** `docs/superpowers/specs/2026-07-01-auto-optimize-ux-design.md`
**Depends on:** the existing D Auto-Optimize section stream (merged) + companion F (`PlanStep.mode`, `docs/superpowers/specs/2026-07-01-auto-optimize-less-mode-design.md`). G reads defensively so it can merge even if F lands the endpoint SSE wiring later.

## Global Constraints

- **Part 8 — presentation only.** Do NOT touch `lib/optimizationPlanner.ts`, `lib/optimizeGuidelineRouting.ts`, `lib/recommendationEngine.ts`, `lib/contentScore.ts`, `lib/aiSearchScore.ts`, `buildArticleContext`, or the endpoint planner/ROI/credit/abort/retry logic. The `SectionEvent` type + `buildSectionEvent` already carry the three consumed fields (optional); endpoint forwarding at the two call sites is F/D territory.
- **[RATIFIED] Option A — review then Save. KEEP Accept/Reject.** Do NOT replace the review-doc mechanism with a Revert-only / auto-apply flow. Changes are proposed as a review doc (`buildReviewDoc` + `contentOptimizer` atoms + ✓/✗ NodeView), reviewed per-change, then committed on Save. There is no per-section Revert button and no "Revert all". Post-save undo = Version History (the existing `auto_optimize` version snapshot).
- **No new LLM call.** The live score delta is the LOCAL pure `computeContentScore`, client-side.
- **AI Search numeric float deferred (Part-8 tension resolution A).** MVP ships live `+N SEO` only; `focus === ai-coverage` gets the qualitative "Improved AI Search coverage" LABEL, no number. Do NOT invent an AI proxy score without product sign-off.
- **New UI = inline styles** per CLAUDE.md; design tokens only (brand `#783AFB`, success `#1AB25E`, error `#FF6F77`, muted `#52525C`, input-focus `#AA93FD`, dark CTA `#2F2F34`); `var(--font-family-primary)`; inline SVG icons only.
- **Reduced motion:** every shimmer/float/pulse/odometer gated by `prefersReducedMotion()` (`lib/motion/gsap.ts:32`).
- **Undo preserved:** Accept/Reject go through `editor.chain().insertContentAt(...)` (real PM txns). The review-entry `setContent(reviewHtml, {emitUpdate:false})` and Cancel/Save restore stay as-is.
- No new TypeScript `any` (`[[avoid-any-type]]`). Commit each task immediately (`[[concurrent-claude-sessions-hazard]]`).
- **Test isolation:** the pure `lib/optimizeMessaging.ts` imports only types — no jest mock needed; NEVER touch `jest.config.js`/`jest.setup.js`/`__mocks__/`. Use LOCAL `jest.mock(...)` only if a component test needs it.
- **Verify gates:** each code task ends `npx tsc --noEmit` clean + (for logic tasks) its jest suite. **Implementers must NOT run `npm run build`** (it hangs subagents — verified during A/B/C/D); the controller runs the full build once at the end. Execution uses `/frontend-design` + `design.md` for any UI task.

## Assumptions (from the spec ratified decisions)

1. Client-side re-score for the SEO/content delta (OD-1). 2. **Option A: review-doc + per-change Accept/Reject + global Save (confirm modal); no Revert (supersedes OD-2/OD-3).** 3. Buffered review doc via `buildReviewDoc` (KEPT), NOT auto-apply. 4. CSS keyframe shimmer + GSAP one-shots + existing `motion/react` odometer (OD-4). 5. Client messaging helper (OD-5). 6. AI numeric float deferred (Part-8 resolution A). 7. `SectionEvent` already carries `focus`/`mode`/`reason`; endpoint forwarding is F/D. 8. Skip sections (`changed:false`) get no atom/animation.

---

## What already exists (do NOT reinvent)

- `lib/optimizeReviewDoc.ts` `buildReviewDoc` — buffered stream -> review doc (first changed = active). **KEEP.**
- `components/articles/ContentOptimizerNodeView.tsx` — Accept/Reject ✓/✗ toolbar + **word-level inline diff** (green added / gray strikethrough) via `lib/optimizeWordDiff.ts`, with a block-complex two-block fallback. **KEEP + extend** (add status label + result chip + Improved pill).
- `components/articles/optimizeStore.ts` — `SectionResult` already has `scores?` + `adjustments?`. **KEEP + add** optional `focus`/`mode`/`reason`.
- `components/articles/OptimizeReviewBar.tsx` — status bar + prev/next + Cancel + Save. **KEEP + extend** (subtitle + Save -> confirm modal).
- `components/articles/OptimizeCancelModal.tsx` — design-system confirm modal. **KEEP; mirror for Save.**
- `components/articles/OptimizeResultsPanel.tsx` — gauge + "Auto-Optimize completed" + 3 stat cards + adjustments list. **EXISTS but NOT wired** into `[id]/index.tsx`. **Wire in + upgrade** to Surfer copy (E1/E2).
- `components/articles/ScoreGauge.tsx` / `ScoreTrio.tsx` — dual-arc gauge + **odometer** (`motion/react`) + `↑N` delta badge; `ScoreTrio` `deltas` prop already wired via `scoreDeltas`. **REUSE.**
- `lib/optimizeStats.ts` `computeOptimizeStats` — per-section word deltas. **REUSE.**
- `pages/articles/[id]/index.tsx` — `handleAutoOptimizeSections` (`~:1150`), `buildReviewDoc` at `done` (`:1235`), review-completion effect (`:1266`), `resolveAllOptimizerNodes` (`:1302`), `handleConfirmCancel` (`:1336`), `handleSaveOptimizeRun` (`:1355` — creates `auto_optimize` version), `OptimizeReviewBar`/`OptimizeCancelModal` render (`:2035`/`:2052`), Version History panel (`showHistory`, `:404`/`:1864`).

---

## File Structure

**Create:** `lib/optimizeMessaging.ts`; `components/articles/AoScoreFloat.tsx`; `components/articles/OptimizeSaveModal.tsx`; `__tests__/lib/optimizeMessaging.test.ts`.
**Modify:** `components/articles/contentOptimizerNode.ts` (status enum +`improved`); `components/articles/optimizeStore.ts` (optional `focus`/`mode`/`reason`); `components/articles/ContentOptimizerNodeView.tsx` (status label + result chip + Improved pill; KEEP ✓/✗ + diff); `components/articles/OptimizeResultsPanel.tsx` (Surfer summary header + Adjustments cards); `components/articles/OptimizeReviewBar.tsx` (status-by-focus subtitle + Save -> confirm modal); `pages/articles/[id]/index.tsx` (activeSectionId + live re-score + Save-modal wiring + render OptimizeResultsPanel + saved toast); `styles/globals.css` (`aoShimmer`).
**Untouched:** all planner/coverage/score-compute libs; the endpoint loop/ROI/credit/abort/retry; `lib/optimizeReviewDoc.ts` `buildReviewDoc` is **KEPT** (it is the Option-A review mechanism — do NOT remove); `lib/optimizeWordDiff.ts` (word diff already done); `lib/optimizeSectionEvents.ts` (fields already present; touch only if F/D need it for endpoint wiring).

---

## Task 1 — `lib/optimizeMessaging.ts` (pure) + tests

- [ ] Create `lib/optimizeMessaging.ts` with three pure functions and NO imports beyond the `StepFocus`/`EditMode` types.

```ts
import type { StepFocus, EditMode } from './optimizationPlanner';
// EditMode is added by F but the type is exported from optimizationPlanner; import as a type.

export interface SectionMsgInput { focus?: StepFocus; mode?: EditMode; reason?: string; }

/** Live label shown while a section is `active` (Part 6). Falls back to a generic line. */
export function sectionStatusLabel({ focus, mode, reason }: SectionMsgInput): string {
  if (mode === 'expand' || focus === 'expand') return 'Expanding thin content…';
  if (focus === 'ai-coverage') {
    if (reason && /authorit|fact|citation|source/i.test(reason)) return 'Strengthening factual authority…';
    return 'Improving AI answer readiness…';
  }
  if (focus === 'seo-terms') return 'Improving SEO coverage…';
  if (focus === 'readability') return 'Improving readability…';
  if (focus === 'skip') return 'Already optimized.';
  return 'Optimizing section…';
}

/** Result chip copy after a section resolves (Part 5) — never "rewrote/generated" unless EXPAND. */
export function sectionResultLabel({ focus, mode, reason }: SectionMsgInput): string {
  if (mode === 'expand' || focus === 'expand') return 'Expanded thin content';
  if (focus === 'ai-coverage') {
    if (reason && /authorit|fact/i.test(reason)) return 'Strengthened authority';
    if (reason && /citation|source|readiness/i.test(reason)) return 'Improved citation readiness';
    if (reason && /intent|answer/i.test(reason)) return 'Clarified answer intent';
    return 'Improved AI Search coverage';
  }
  if (focus === 'seo-terms') return 'Added missing coverage';
  if (focus === 'readability') return 'Improved readability';
  return 'Improved section';
}

/** Real-evaluation gate (Part 3): only a positive whole-doc delta animates. */
export function scoreDeltaGate(oldScore: number, newScore: number): { animate: boolean; delta: number } {
  const delta = Math.round(newScore) - Math.round(oldScore);
  return { animate: delta > 0, delta };
}
```

- [ ] Create `__tests__/lib/optimizeMessaging.test.ts` covering:
  - every `focus` value -> expected `sectionStatusLabel` string;
  - `mode === 'expand'` overrides any focus -> "Expanding thin content…";
  - `focus === 'ai-coverage'` + `reason` matching /authority/ -> "Strengthening factual authority…";
  - missing `focus`/`mode` -> generic fallbacks;
  - `sectionResultLabel` never returns "Rewrote"/"Generated" for any non-expand input (assert against a forbidden-substring list);
  - `scoreDeltaGate`: `(70,70)->{animate:false,delta:0}`, `(70,68)->{animate:false,delta:-2}`, `(70,73)->{animate:true,delta:3}`, rounding `(70.4,71.6)->delta:2`.
- **Verify:** `npx tsc --noEmit` clean; `npx jest __tests__/lib/optimizeMessaging.test.ts` green.

## Task 2 — Confirm `SectionEvent` fields (coordinate with F)

- [ ] Confirm `lib/optimizeSectionEvents.ts` `SectionEvent` already declares `focus?: StepFocus`, `mode?: EditMode`, `reason?: string` and `buildSectionEvent(section, result?, step?)` forwards them (it does, `:20-30`). No type change needed unless F asks for it.
- [ ] Coordinate with F: the ENDPOINT must CALL `buildSectionEvent(section, result, step)` WITH the `step` at both call sites (`optimize-sections.ts:148` skip branch and `:188` changed branch) so the fields reach the client. This is F/D territory. If F has not landed, the client reads defensively (Tasks 4/9) and falls back to generic copy.
- **Verify:** `npx tsc --noEmit` clean across the repo.
- **Guard rail:** do NOT change any planner logic to produce these — they already exist on `PlanStep` (`focus` `:17`, `reason` `:23`, `mode` via F).

## Task 3 — Node status enum + store fields

- [ ] In `components/articles/contentOptimizerNode.ts` extend the `status` attr comment + accepted values to `pending | active | accepted | rejected | improved` (no behavioural code change — it is a string attr; default `'pending'` stays).
- [ ] In `components/articles/optimizeStore.ts` add optional `focus?: StepFocus; mode?: EditMode; reason?: string` to `SectionResult` (it already carries optional `scores`/`adjustments`). Import the types from `lib/optimizationPlanner`.
- **Verify:** `npx tsc --noEmit` clean.

## Task 4 — NodeView status label + result chip (KEEP ✓/✗ + word diff)

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] Extend `components/articles/ContentOptimizerNodeView.tsx` (do NOT rewrite; KEEP the Accept/Reject toolbar and the `wordDiffSegments`/`renderDiffHtml` diff body + block-complex fallback):
  - Read `{ focus, mode, reason }` from `optimizeStore.get(sectionId)` (now available after Task 3).
  - **`status === 'active'`:** overlay the `aoShimmer` gradient (Task 5) + render `sectionStatusLabel({focus,mode,reason})` (muted, top-left) + a small pulsing loading dot. Keep the active glow border already present (`--purple-40` / `boxShadow: 0 0 0 3px rgba(120,58,251,0.12)`).
  - **`status === 'accepted' | 'rejected' | 'improved'`:** on `improved`, show a small "Improved" success pill (`#1AB25E`) + the `sectionResultLabel(...)` chip near the box. Reject/accept splice logic is UNCHANGED (`handleAccept`/`handleReject`, `:54-55`).
  - Keep `useEntrance`, `sanitizeArticleHtml`, and the ✓/✗ buttons exactly as-is.
- **Verify:** `npx tsc --noEmit` clean. Structure-described: (a) ✓/✗ toolbar still present; (b) word-level diff still rendered (green add / strikethrough delete); (c) shimmer + status label only when `status === 'active'`; (d) result chip only on resolved states.

## Task 5 — `AoScoreFloat` + `aoShimmer` keyframe

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] Add the `aoShimmer` keyframe to `styles/globals.css` (next to `surferLoaderSweep`):
```css
@keyframes aoShimmer { 0% { background-position: -150% 0; } 100% { background-position: 250% 0; } }
```
- [ ] Create `components/articles/AoScoreFloat.tsx` — a self-removing floating chip. Props `{ label: string; onDone: () => void }`. GSAP entrance (rise + fade in ~0.2s, hold, fade out at ~2.5s) via `lib/motion/gsap`; on complete call `onDone`. Reduced motion -> show static then `setTimeout(onDone, 2500)`. Style: `color: #1AB25E`, `fontWeight: 600`, `fontFamily: var(--font-family-primary)`, `fontVariantNumeric: tabular-nums`, absolute position (caller positions it near the active section).
- **Verify:** `npx tsc --noEmit` clean. Structure: renders the `label`, calls `onDone` after the animation/timeout.

## Task 6 — Summary header: wire + upgrade `OptimizeResultsPanel` (E1)

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] In `components/articles/OptimizeResultsPanel.tsx` upgrade the three stat tiles to the Surfer copy (keep the gauge + "Auto-Optimize completed" headline + odometer):
  - **"Boosted content score {old} → {new}"** — from `preScore`/`postScore` props (already passed).
  - **"Optimized Sections {N}"** — from `changedCount` prop.
  - **"Added SEO Entities {N}"** — new prop `entityCount: number`. Derive in the caller (Task 9) from accepted `ai-coverage`/entity `adjustments`; if not derivable honestly, pass the accepted-`ai-coverage`-section count and leave a `TODO(human)` referencing "Screenshot vs code #2".
- [ ] Wire the panel into `pages/articles/[id]/index.tsx` in the `reviewing` state (it is currently unimported): render it in the right panel / above the editor summary area, fed by `preScoreRef.current`, the live `postScore`, `optimizeMetaRef.current.changedCount`, `computeOptimizeStats(changedSectionsRef.current)`, and the entity count.
- **Verify:** `npx tsc --noEmit` clean. Structure: gauge + 3 tiles with the Surfer labels + "✓ Auto-Optimize completed".

## Task 7 — Adjustments list cards + source favicons (E2)

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] In `components/articles/OptimizeResultsPanel.tsx` grow each adjustments row into a card:
  - **label** from `sectionResultLabel({focus,mode,reason})` (pass per-section `focus`/`mode`/`reason` into the adjustments prop, sourced from `optimizeStore`);
  - **added text snippet** from `optimizeStore` `adjustments[].snippet` (fall back to the added segments of `wordDiffSegments` if no snippet — see "Screenshot vs code #3");
  - **source favicons** (where present): a row of `https://www.google.com/s2/favicons?domain=${d}&sz=16` over `adjustments[].sourceDomains`, reusing the favicon + `onError` hide pattern from `ContentScorePanel.tsx:183-187`.
  - Keep the existing `+N words` chip; keep the "+N more" overflow.
- **Verify:** `npx tsc --noEmit` clean. Structure: each card shows a label + (snippet) + (favicon row); labels never say "rewrote/generated" for non-expand.

## Task 8 — Save-confirm modal + saved toast + Version History (E5)

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] Create `components/articles/OptimizeSaveModal.tsx` mirroring `OptimizeCancelModal.tsx` (same 420px card, `growOut`, design-system shadow). Props `{ open: boolean; onContinueEditing: () => void; onSave: () => void; saving?: boolean }`. Title "Save changes?"; body "Are you sure you want to save? Changes will be applied to your article."; buttons `Continue editing` (secondary `#F4F4F5`) / `Save` (primary brand `#783AFB` or dark `#2F2F34`, disabled while `saving`).
- [ ] In `pages/articles/[id]/index.tsx`: add `saveModalOpen` state; the bar's `onSave` opens the modal; the modal's `onSave` calls `handleSaveOptimizeRun` then closes.
- [ ] Replace the plain success toast in `handleSaveOptimizeRun` (`:1394`) with a `toast.custom(...)`: "✓ Your changes have been saved" + "You can see your changes in the Version History" + a **Version History** button that runs `setShowHistory(true)` (and closes any conflicting panels, mirroring `:1866`).
- **Verify:** `npx tsc --noEmit` clean. Structure: Save opens the modal; confirming saves + shows the toast with a working Version History button.

## Task 9 — Orchestration in `pages/articles/[id]/index.tsx` (activeSectionId + live re-score)

- [ ] In `handleAutoOptimizeSections` (`~:1150-1259`) add `activeSectionId` state + advance it: on `meta` set it to the first section id (`payload.sections` if present, else the first `section` event); on each `section` event advance to the next. `buildReviewDoc` already marks the first changed section `active` — keep that; `activeSectionId` primarily drives the bar subtitle + which node shimmers during the stream. Do NOT change the `buildReviewDoc` / `setContent(emitUpdate:false)` review-entry (`:1235-1239`).
- [ ] Persist per-section `focus`/`mode`/`reason` into `optimizeStore.set(...)` alongside `oldHtml/newHtml/changed` (`:1225`).
- [ ] Live re-score: maintain `postScore` state initialised from `preScoreRef.current`; on each Accept (and as sections stream) recompute `computeContentScore(...)` with the SAME arg list as `:1159-1160`, run `scoreDeltaGate(preScoreRef.current, newScore)`; on `animate` bump `scoreDeltas` (feeds `ScoreTrio`, already wired at `:1959`) and mount an `AoScoreFloat("+"+delta+" SEO")` near the accepted node. Feed `postScore` to the summary header (Task 6).
- [ ] Derive `entityCount` for the header (Task 6) from accepted `ai-coverage`/entity `adjustments`; `TODO(human)` per "Screenshot vs code #2" if not honestly derivable.
- [ ] KEEP `handleConfirmCancel` (restore `preReviewHtmlRef`) and `handleSaveOptimizeRun` (resolve + `doSave('auto_optimize')`) — Option A relies on them. Do NOT add a Revert handler.
- **Verify:** `npx tsc --noEmit` clean. Structure-described: (a) `buildReviewDoc` still called at `done`; (b) one `activeSectionId` at a time; (c) each Accept re-scores once with an honest gate; (d) no Revert path added.

## Task 10 — Status bar subtitle + Save-modal wiring

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] Update `components/articles/OptimizeReviewBar.tsx`:
  - While `optimizing`: keep the spinner + "Processing section X of Y" and add the active `sectionStatusLabel(...)` (new optional prop `activeStatusLabel?: string`) as the subtitle.
  - Replace the static subtitle "Accept or reject changes, edit afterwards" (`:87`) with the Less-mode line, e.g. "Review each upgrade, then Save to apply" (accept/reject stays the gesture).
  - Route `Save` through the confirm modal (Task 8): the bar keeps calling `onSave`, and the CALLER (`[id]/index.tsx`) makes `onSave` open the Save modal. Keep `Cancel` -> cancel-confirm modal. Keep prev/next nav.
- **Verify:** `npx tsc --noEmit` clean. Structure: bar shows the focus-derived status while optimizing; Save opens the confirm modal; Accept/Reject unchanged.

## Task 11 — Wire-up, reduced motion, defensive fields

- [ ] Ensure `ScoreTrio` receives the accumulated `scoreDeltas` during review (already wired at `[id]/index.tsx:1959`); confirm the summary-header gauge and the ScoreTrio show the SAME `preScore`/`postScore`.
- [ ] Defensive: if `ev.focus`/`ev.mode` are `undefined` (F endpoint wiring not yet merged), the helpers fall back to generic copy (Task 1 handles this) — verify the run still reviews + saves end-to-end with missing fields.
- [ ] Confirm `prefersReducedMotion()` short-circuits the shimmer (swap the animated background for a static one), the floats, and the odometer roll.
- **Verify:** `npx tsc --noEmit` clean across the repo. Manual structure walkthrough of the data-flow in the design doc.

---

## Verification Summary

- **Pure logic (Task 1):** jest — focus/mode -> copy mapping, forbidden-word guard, `scoreDeltaGate` rounding/gating.
- **Types (Tasks 2,3):** `npx tsc --noEmit`.
- **UI (Tasks 4,5,6,7,8,10):** `/frontend-design` + `design.md`; `npx tsc --noEmit`; structure-described checks (✓/✗ + word diff kept; shimmer only when active; summary header 3 tiles; adjustments cards; Save-confirm modal; saved toast + Version History; float self-removes).
- **Orchestration (Tasks 9,11):** `npx tsc --noEmit`; structure walkthrough (`buildReviewDoc` kept; one active section; honest live re-score on Accept; no Revert path; entity count sourced or TODO-flagged).
- **Controller only:** full `npm run build` once at the end. Implementers MUST NOT run it.

## Task count

**11 tasks** (was 8). Delta from the previous plan: reversed to Option A (KEEP Accept/Reject; dropped the Revert-only NodeView rewrite, the Revert/Revert-all handlers, and the `buildReviewDoc` removal); split the summary work into E1 header wiring (Task 6), E2 Adjustments cards (Task 7), and E5 Save-modal + toast (Task 8); the NodeView task is now an EXTENSION (Task 4) not a rewrite; orchestration (Task 9) keeps the buffered review doc.

## Open items for the human

1. **Part-8 resolution A (blocks Task 9 AI-float scope).** Confirm SEO/content live float only; AI label without a number. A real numeric `+N AI Search` per section needs F/D to emit a per-section AI-readiness `scores` field (planner/endpoint scoring change, out of G scope, contradicts Part 8).
2. **"Added SEO Entities {N}" source (Task 6, "Screenshot vs code #2").** Confirm whether `adjustments[].type === 'entity'` is populated by the endpoint today, or G approximates N from accepted `ai-coverage` sections, or the tile is dropped/relabelled. Do NOT fabricate the number.
3. **Adjustments snippet + source favicons (Task 7, "Screenshot vs code #3").** `adjustments[].snippet`/`sourceDomains` are optional `SectionResult` fields nothing writes yet — confirm the endpoint/section-edit path emits them, or E2 degrades to label + word-delta.
4. **Diff deletion color (Task 4, "Screenshot vs code #4").** Keep muted gray `#9f9fa9` strikethrough (matches "muted") or switch to error `#FF6F77` per the screenshots — a one-line design choice.
