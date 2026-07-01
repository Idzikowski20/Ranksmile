# Auto-Optimize UX — Less-Mode presentation (Sub-project G) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A presentation-only layer over the Auto-Optimize section stream — one section shimmers at a time with a focus-derived status label, the Content Score ticks up live after each section IF `computeContentScore` says it truly rose, Accept/Reject collapses to a single **Revert changes** (applying is the default), and all copy says "small upgrade" not "rewrite". CONSUMES `focus`/`mode`/`reason` from `PlanStep` + the ordered `section` SSE events; changes NO planner/routing/ROI/`expectedLift`/guideline/mode logic (Part 8).

**Architecture:** One pure module (`lib/optimizeMessaging.ts` — focus/mode -> copy + `scoreDeltaGate`), one new presentational component (`AoScoreFloat`), a rewritten Revert-only NodeView, a status/Revert-all review bar, one CSS keyframe, and rewired client orchestration in `pages/articles/[id]/index.tsx` that auto-applies each section live and re-scores it. The `SectionEvent` type gains `focus`/`mode`/`reason` (coordinated with Sub-project F, which owns the endpoint wiring).

**Tech Stack:** TypeScript, Next.js (pages), React, TipTap/ProseMirror, GSAP (`lib/motion/*`), Jest. Reuses `lib/contentScore.ts` (`computeContentScore`), `components/articles/ScoreTrio.tsx`/`ScoreGauge`, `components/articles/optimizeStore.ts`, `lib/optimizeSectionEvents.ts`, `styles/globals.css` keyframes.

**Spec:** `docs/superpowers/specs/2026-07-01-auto-optimize-ux-design.md`
**Depends on:** the existing D Auto-Optimize section stream (merged) + companion F (`PlanStep.mode`, `docs/superpowers/specs/2026-07-01-auto-optimize-less-mode-design.md`). G reads defensively so it can merge even if F lands the SSE fields slightly later.

## Global Constraints

- **Part 8 — presentation only.** Do NOT touch `lib/optimizationPlanner.ts`, `lib/optimizeGuidelineRouting.ts`, `lib/recommendationEngine.ts`, `lib/contentScore.ts`, `lib/aiSearchScore.ts`, `buildArticleContext`, or the endpoint planner/ROI/credit/abort/retry logic. G may EDIT `lib/optimizeSectionEvents.ts` only to ADD the three consumed fields to `SectionEvent` (coordinate with F; the endpoint forwarding is F/D territory).
- **No new LLM call.** The live score delta is the LOCAL pure `computeContentScore`, client-side.
- **AI Search numeric float deferred (Part-8 tension resolution A).** MVP ships live `+N SEO` only; `focus === ai-coverage` gets the qualitative "Improved AI Search coverage" LABEL, no number. Do NOT invent an AI proxy score without product sign-off.
- **New UI = inline styles** per CLAUDE.md; design tokens only (brand `#783AFB`, success `#1AB25E`, muted `#52525C`, input-focus `#AA93FD`); `var(--font-family-primary)`; inline SVG icons only.
- **Reduced motion:** every shimmer/float/pulse gated by `prefersReducedMotion()` (`lib/motion/gsap.ts:32`).
- **Undo preserved:** live applies + reverts go through `editor.chain().insertContentAt(...)` (real PM txns). Do NOT use `emitUpdate:false` on the live per-section applies.
- No new TypeScript `any` (`[[avoid-any-type]]`). Commit each task immediately (`[[concurrent-claude-sessions-hazard]]`).
- **Test isolation:** the pure `lib/optimizeMessaging.ts` imports only types — no jest mock needed; NEVER touch `jest.config.js`/`jest.setup.js`/`__mocks__/`. Use LOCAL `jest.mock(...)` only if a component test needs it.
- **Verify gates:** each code task ends `npx tsc --noEmit` clean + (for logic tasks) its jest suite. **Implementers must NOT run `npm run build`** (it hangs subagents — verified during A/B/C/D); the controller runs the full build once at the end. Execution uses `/frontend-design` + `design.md` for any UI task.

## Assumptions (from the spec ratified decisions)

1. Client-side re-score for the SEO/content delta (OD-1). 2. Both per-section Revert + global Revert-all (OD-2). 3. Live per-section auto-apply, no buffered review doc (OD-3). 4. CSS keyframe shimmer + GSAP one-shots (OD-4). 5. Client messaging helper (OD-5). 6. AI numeric float deferred (Part-8 resolution A). 7. `SectionEvent` gains `focus`/`mode`/`reason`; endpoint forwarding is F/D. 8. Skip sections (`changed:false`) are not applied/animated.

---

## File Structure

**Create:** `lib/optimizeMessaging.ts`; `components/articles/AoScoreFloat.tsx`; `__tests__/lib/optimizeMessaging.test.ts`.
**Modify:** `lib/optimizeSectionEvents.ts` (add fields, with F); `components/articles/contentOptimizerNode.ts` (status enum); `components/articles/optimizeStore.ts` (optional fields); `components/articles/ContentOptimizerNodeView.tsx` (Revert-only + shimmer); `components/articles/OptimizeReviewBar.tsx` (status-by-focus + Revert-all); `pages/articles/[id]/index.tsx` (live-apply orchestration + `activeSectionId` + re-score + revert handlers); `styles/globals.css` (`aoShimmer`).
**Untouched:** all planner/coverage/score-compute libs; the endpoint loop/ROI/credit/abort/retry; `buildReviewDoc` is superseded (may be left in place, unused, or removed in Task 6 — implementer choice, prefer removal if no other caller).

---

## Task 1 — `lib/optimizeMessaging.ts` (pure) + tests

- [ ] Create `lib/optimizeMessaging.ts` with three pure functions and NO imports beyond the `StepFocus`/`EditMode` types.

```ts
import type { StepFocus } from './optimizationPlanner';
// EditMode is added by F; import as a type. Until F lands, mirror the union locally is NOT allowed —
// coordinate so this import resolves. If F is not yet merged, accept `mode?: string` in the signatures.
import type { EditMode } from './optimizationPlanner';

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

## Task 2 — `SectionEvent` fields (coordinate with F)

- [ ] In `lib/optimizeSectionEvents.ts` add `focus: StepFocus`, `mode: EditMode`, `reason: string` to `SectionEvent`, and thread them through `buildSectionEvent(section, result?, step?)` — reading `step?.focus ?? 'skip'`, `step?.mode ?? 'normal'`, `step?.reason ?? ''` so callers that don't pass a step still typecheck. Import `StepFocus`/`EditMode` as types from `lib/optimizationPlanner`.
- [ ] Coordinate with F: the ENDPOINT forwarding (`buildSectionEvent(section, result, step)` at `optimize-sections.ts:148` and `:188`) is F/D territory. If F has not landed, leave the endpoint call sites emitting the defaults; G reads defensively (Task 4/6).
- **Verify:** `npx tsc --noEmit` clean across the repo (the endpoint still compiles because the new params are optional / defaulted).
- **Guard rail:** do NOT change any planner logic to produce these — they already exist on `PlanStep` (`focus` `:17`, `reason` `:23`, `mode` via F). This task only widens the SSE payload type + the pure builder.

## Task 3 — Node status enum + store fields

- [ ] In `components/articles/contentOptimizerNode.ts` extend the `status` attr comment + accepted values to `pending | active | applied | improved | reverted` (no behavioural code change — it is a string attr; only the default `'pending'` stays). 
- [ ] In `components/articles/optimizeStore.ts` add optional `focus?: StepFocus; mode?: EditMode; reason?: string` to `SectionResult` (it already carries optional `scores`/`adjustments`). Import the types.
- **Verify:** `npx tsc --noEmit` clean.

## Task 4 — Revert-only NodeView + active shimmer

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] Rewrite `components/articles/ContentOptimizerNodeView.tsx`:
  - Read `{ sectionId, status }` from node attrs and `{ oldHtml, newHtml, focus, mode, reason }` from `optimizeStore.get(sectionId)`.
  - **`status === 'active'`:** render a shimmer box (the `aoShimmer` gradient from Task 5) + the `sectionStatusLabel({focus,mode,reason})` label (muted, top-left) + a small pulsing loading dot. Glow border `boxShadow: 0 0 0 3px rgba(120,58,251,0.12)`, `border: 1px solid #AA93FD`. No content diff, no buttons.
  - **`status === 'applied' | 'improved' | 'reverted'`:** render the applied HTML (`sanitizeArticleHtml(newHtml)` for applied/improved; `oldHtml` for reverted) as the section body + a single **Revert changes** text button (or restore, if reverted). On `improved`, show a small "Improved" success pill (`#1AB25E`) + the `sectionResultLabel(...)` chip. 
  - Delete `handleAccept` and the two-button toolbar (`:137-166`); rename `handleReject` -> `handleRevert` = `splice(oldHtml)`; add `handleRestore` = `splice(newHtml)` for a reverted section (optional). Keep `splice` (`:44-52`) as-is.
  - Keep `useEntrance` for the box entrance.
- **Verify:** `npx tsc --noEmit` clean. Structure-described verification: (a) no Accept button in the render; (b) exactly one Revert control per applied node; (c) shimmer only when `status === 'active'`.

## Task 5 — `AoScoreFloat` + `aoShimmer` keyframe

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] Add the `aoShimmer` keyframe to `styles/globals.css` (next to `surferLoaderSweep`):
```css
@keyframes aoShimmer { 0% { background-position: -150% 0; } 100% { background-position: 250% 0; } }
```
- [ ] Create `components/articles/AoScoreFloat.tsx` — a self-removing floating chip. Props `{ label: string; onDone: () => void }`. GSAP entrance (rise + fade in ~0.2s, hold, fade out at ~2.5s) via `lib/motion/gsap`; on complete call `onDone`. Reduced motion -> show static then `setTimeout(onDone, 2500)`. Style: `color: #1AB25E`, `fontWeight: 600`, `fontFamily: var(--font-family-primary)`, `fontVariantNumeric: tabular-nums`, absolute position (caller positions it near the active section).
- **Verify:** `npx tsc --noEmit` clean. Structure: renders the `label`, calls `onDone` after the animation/timeout.

## Task 6 — Live-apply orchestration in `pages/articles/[id]/index.tsx`

- [ ] In `handleAutoOptimizeSections` (`~:1150-1259`) change the stream handling so it applies each section LIVE instead of buffering to `buildReviewDoc`:
  - Add state/ref: `activeSectionId` (state, drives which node is `active`), `prevScoreRef` (init to `preScoreRef.current`, `:1159`), and a running `deltas` accumulator for `ScoreTrio`.
  - On **`meta`:** set `activeSectionId` to the first section id from `payload.sections`.
  - On **`section` with `changed:false`:** advance `activeSectionId` to the next section id; no apply. (Skip.)
  - On **`section` with `changed:true`:** `optimizeStore.set(ev.sectionId, { oldHtml, newHtml, changed, focus: ev.focus, mode: ev.mode, reason: ev.reason })`; splice `newHtml` into the live doc wrapped in a `contentOptimizer` atom with `status` `applied`/`improved` (or insert the atom then let the NodeView show it). Re-score: `newScore = computeContentScore(currentDocText, wordCount, headingCount, scoreData, …)` (reuse the exact arg list from `:1160`); `{ animate, delta } = scoreDeltaGate(prevScoreRef.current, newScore)`; if `animate` bump the `ScoreTrio` deltas by `delta` and mount an `AoScoreFloat("+"+delta+" SEO")` near the node (status `improved`), else status `applied`; set `prevScoreRef.current = newScore`; advance `activeSectionId`.
  - On **`done`:** clear `activeSectionId`; set the bar to the resolved/summary state (Task 7). Do NOT call `buildReviewDoc`; delete that branch (`:1234-1239`). Keep the "no changes" branch (`:1240-1245`) as-is.
  - Keep credit/429/error handling (`:1183-1192`, `:1247-1257`) unchanged.
- [ ] Add `handleRevert(sectionId)` (splice `oldHtml` for one section, flip store/status) and `handleRevertAll()` (restore `preReviewHtmlRef.current`, clear store, back to idle — mirrors `handleConfirmCancel` `:1336-1350`).
- [ ] Remove `emitUpdate:false` from the live applies (undo must work). The Save path (`handleSaveOptimizeRun` `:1355`) and `resolveAllOptimizerNodes` (`:1302`) stay; ensure a `reverted` section resolves to `oldHtml` (adjust the `entry?.newHtml || entry?.oldHtml` pick at `:1312` to honor a `reverted` flag).
- **Verify:** `npx tsc --noEmit` clean. Structure-described: (a) each `changed` event triggers exactly one splice + one re-score; (b) only one `activeSectionId` at a time; (c) no `buildReviewDoc` call remains.

## Task 7 — Status/Revert bar

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] Update `components/articles/OptimizeReviewBar.tsx`:
  - While `optimizing`: show the spinner + "Processing section X of Y" (keep) PLUS the current `activeSectionId` status label via `sectionStatusLabel(...)` if available.
  - Drop the "Accept or reject changes, edit afterwards" subtitle (`:87`) -> "Applying upgrades — revert any change you dislike".
  - Replace the `Cancel` semantics with **Revert all** (calls `onRevertAll`); keep `Save`. Remove the prev/next nav OR keep it as jump-to-section (implementer choice; nav is optional now that applying is automatic).
  - Add prop `onRevertAll: () => void` and optional `activeStatusLabel?: string`.
- **Verify:** `npx tsc --noEmit` clean. Structure: bar shows the focus-derived status while optimizing; a Revert-all + Save when done.

## Task 8 — Wire-up, reduced motion, defensive fields

- [ ] Ensure `ScoreTrio` receives the accumulated `deltas` during the run (it already accepts `deltas`, `ScoreTrio.tsx:47`); pass the running accumulator from Task 6.
- [ ] Defensive: if `ev.focus`/`ev.mode` are `undefined` (F not yet merged), the helpers fall back to generic copy (Task 1 already handles this) — verify the run still works end-to-end with default `focus:'skip'`/`mode:'normal'` payloads.
- [ ] Confirm `prefersReducedMotion()` short-circuits the shimmer (CSS: gate via a `reducedMotion` prop that swaps the animated background for a static one) and the floats.
- **Verify:** `npx tsc --noEmit` clean across the repo. Manual structure walkthrough of the data-flow in the design doc.

---

## Verification Summary

- **Pure logic (Tasks 1):** jest — focus/mode -> copy mapping, forbidden-word guard, `scoreDeltaGate` rounding/gating.
- **Types (Tasks 2,3):** `npx tsc --noEmit`.
- **UI (Tasks 4,5,7):** `/frontend-design` + `design.md`; `npx tsc --noEmit`; structure-described checks (no Accept button; one Revert per node; shimmer only when active; float self-removes).
- **Orchestration (Task 6,8):** `npx tsc --noEmit`; structure walkthrough (one active section; live splice + re-score per changed event; honest delta gate; no `buildReviewDoc`).
- **Controller only:** full `npm run build` once at the end. Implementers MUST NOT run it.

## Open item for the human (blocks Task 6 AI-float scope)

Confirm **Part-8 resolution A** (SEO/content live float only; AI label without a number). If instead product wants a real numeric `+N AI Search` per section, that requires F/D to emit a per-section AI-readiness `scores` field on the SSE `section` event (a planner/endpoint scoring change) — out of G scope and contradicting Part 8. Until confirmed, Task 6 ships the SEO float and the AI qualitative label only.
