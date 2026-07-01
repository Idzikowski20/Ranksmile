# Auto-Optimize UX — Live AI Visibility Score + Less-Mode presentation (Sub-project G) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A presentation + **live client-side re-score** layer over the Auto-Optimize section stream. One section shimmers at a time (focus-derived status label, smooth-scrolled into view); the content/SEO score AND a **new live "AI Visibility Score"** re-score client-side as the user accepts changes and types; the ONE re-score feeds the gauge odometer + delta, a **score-attribution** breakdown, a **"Remaining AI Opportunities"** panel, AND the **uncovered-item badges** in `ContentScorePanel`/`WriteOptimizePanel`. Changes are proposed as a tracked-changes review doc reviewed per-change (KEEP Accept/Reject ✓/✗) then committed via a global **Save** behind a confirm modal, with a **top-right saved banner** and Version-History undo. The score delta is labeled **"Optimization Impact +N"**, never "+N AI Search". CONSUMES `focus`/`mode`/`reason` from `PlanStep` + the ordered `section` SSE events; changes NO planner/routing/ROI/`expectedLift`/guideline/mode logic and does NOT edit `lib/aiCoverage.ts`/`lib/contentScore.ts` internals (Part 8). **Re-SCORE, never re-PLAN.**

**Architecture:** The whole "Surfer Auto-Optimize" scoring/planning stack already exists (see the spec Intro table): `computeCoverageScores` (weighted composite, NOT an entity count), Less-Mode AI-takeover + `worthEditing`, ROI planning, LLM-only-for-patches. This sub-project adds ONLY the **live re-score for display + attribution**: a NEW pure module `lib/liveCoverage.ts` (`liveCoverageItems` re-derives presence-checkable `covered` and carries frozen items verbatim → feeds the existing `computeCoverageScores`; plus `scoreAttribution`, `remainingOpportunities`, `scoreDeltaGate`), a pure messaging module `lib/optimizeMessaging.ts`, small presentational components (`AoScoreFloat`, `AoScoreAttribution`, `RemainingOpportunities`, `OptimizeSaveModal`, `OptimizeSavedBanner`), the EXISTING Accept/Reject NodeView extended, the EXISTING `OptimizeResultsPanel` upgraded + wired, one CSS keyframe, and orchestration in `pages/articles/[id]/index.tsx` (activeSectionId + the debounced re-score loop). The `CoverageSnapshot` + `coverageItems` are ALREADY hydrated client-side (T12, `[id]/index.tsx:623-627`) — no fetch, no endpoint, no LLM.

**Tech Stack:** TypeScript, Next.js (pages), React, TipTap/ProseMirror, GSAP (`lib/motion/*`) + `motion/react` (existing odometer), the `diff` package (existing word diff), Jest. Reuses `lib/aiCoverage.ts` (`computeCoverageScores`, `BucketScore`, `CoverageItem`/`CoverageType` — IMPORT, do not edit), `lib/contentScore.ts` (`computeContentScore`, `countOccurrences` — IMPORT), `ScoreTrio`/`ScoreGauge`, `OptimizeResultsPanel`, `lib/optimizeStats.ts`, `lib/optimizeWordDiff.ts`, `lib/optimizeReviewDoc.ts` (`buildReviewDoc` — KEPT), `optimizeStore.ts`, `lib/optimizeSectionEvents.ts`, `styles/globals.css`.

**Spec:** `docs/superpowers/specs/2026-07-01-auto-optimize-ux-design.md`
**Depends on:** the existing D Auto-Optimize section stream (merged) + companion F (`PlanStep.mode`). G reads defensively so it can merge even if F lands the endpoint SSE wiring later.

## Global Constraints

- **Part 8 — presentation + re-SCORE only, no re-PLAN.** Do NOT touch `lib/optimizationPlanner.ts`, `lib/optimizeGuidelineRouting.ts`, `lib/recommendationEngine.ts`, `lib/aiSearchScore.ts`, `buildArticleContext`, or the endpoint planner/ROI/credit/abort/retry logic. **Do NOT modify the BODY of any function in `lib/aiCoverage.ts` or `lib/contentScore.ts`** — import and reuse `computeCoverageScores` / `computeContentScore` / `countOccurrences`. **[RATIFIED — Open item #2] To keep ONE source of truth for the deterministic checks, ADD an `export` keyword to the existing pure helpers `_faqCoverage`, `_readability`, `_listUsage` in `contentScore.ts` (a non-behavioral change — zero edits to their bodies or signatures) and REUSE them in `liveCoverage.ts` for the `structure`/`readability`/`paa` layers. Do NOT re-implement them locally (avoids live-score vs content-score drift).** The NEW pure `liveCoverage.ts` re-scorer REUSES all of these; it never re-plans.
- **No endpoint, no LLM for the re-score.** The `CoverageSnapshot` + pure scorers are already hydrated client-side (T12). The re-score is a pure client recompute. (An earlier re-score-endpoint idea is explicitly superseded — do NOT add one.)
- **[RATIFIED] Option A — review then Save. KEEP Accept/Reject.** Do NOT replace the review-doc mechanism with a Revert-only / auto-apply flow. No per-section Revert, no "Revert all". Post-save undo = Version History (`auto_optimize` snapshot).
- **Honest labeling.** The score-delta badge + float say **"Optimization Impact +N"** (alt: "+N coverage gained"), NEVER "+N AI" / "+N AI Search". The composite is our internal cite-likelihood proxy, not a promise Google/OpenAI grants +N. (The static "AI Search" side-gauge label stays — only the DELTA wording changes.)
- **Immutable coverage items.** `liveCoverageItems` spreads to a NEW readonly array; never mutate a `CoverageItem` (`item.covered = …` is forbidden — they are `readonly`). Frozen items are copied through verbatim.
- **One re-score → many consumers.** A single `liveItems` array feeds the gauge, `scoreAttribution`, `remainingOpportunities`, AND the `ContentScorePanel`/`WriteOptimizePanel` badge props. Never compute coverage twice per tick.
- **Debounce, never per-keystroke.** Manual typing re-scores on `AO_RESCORE_DEBOUNCE_MS = 1200` (1000–1500ms band). Accept re-scores immediately.
- **New UI = inline styles** per CLAUDE.md; design tokens only (brand `#783AFB`, success `#1AB25E`, error `#FF6F77`, muted `#52525C` / `#9f9fa9`, input-focus/purple-40 `#AA93FD`, dark CTA `#2F2F34`, panel border `#E4E4E7`, card border `#F4F4F5`); `var(--font-family-primary)`; inline SVG icons only.
- **Reduced motion:** every shimmer/float/pulse/odometer/**smooth-scroll** gated by `prefersReducedMotion()` (`lib/motion/gsap.ts:32`) → static state / instant scroll.
- **Undo preserved:** Accept/Reject go through `editor.chain().insertContentAt(...)` (real PM txns). The review-entry `setContent(reviewHtml, {emitUpdate:false})` and Cancel/Save restore stay as-is.
- No new TypeScript `any` (`[[avoid-any-type]]`). Commit each task immediately (`[[concurrent-claude-sessions-hazard]]`).
- **Test isolation:** the pure modules (`lib/liveCoverage.ts`, `lib/optimizeMessaging.ts`) import only types + the two reused pure scorers — no jest mock of infra; NEVER touch `jest.config.js`/`jest.setup.js`/`__mocks__/`. LOCAL `jest.mock(...)` only if a component test needs it.
- **Verify gates:** each code task ends `npx tsc --noEmit` clean + (for logic tasks) its jest suite. **Implementers must NOT run `npm run build`** (it hangs subagents — verified during A/B/C/D); the controller runs the full build once at the end. Execution uses `/frontend-design` + `design.md` for any UI task.

## Assumptions (from the spec ratified decisions)

1. Live re-score is client-side pure recompute (no endpoint, no LLM). 2. Two layers: presence-checkable types re-derived, frozen types carried verbatim. 3. `PRESENCE_CHECKABLE = {entity, structure, readability, paa}`; everything else FROZEN (`process` FROZEN by default — flag for human). 4. `answersMainQuestionEarly` is FROZEN (read from snapshot). 5. Option A review flow (KEEP Accept/Reject). 6. Score delta labeled "Optimization Impact +N". 7. `SectionEvent` already carries `focus`/`mode`/`reason`; endpoint forwarding is F/D. 8. **[RATIFIED] `liveCoverage.ts` REUSES `_faqCoverage`/`_readability`/`_listUsage`** — these get an `export` added in `contentScore.ts` (non-behavioral) and are imported, NOT re-implemented (single source of truth; no live-vs-content drift). Open item #2 resolved: export + reuse.

---

## What already exists (do NOT reinvent)

- **The scoring/planning stack** — see the spec Intro table. `computeCoverageScores` (`aiCoverage.ts:176`), ROI planner (D), Less-Mode (F), LLM-only-for-patches. **Reuse, never rebuild.**
- **Client-side coverage hydration (T12)** — `[id]/index.tsx:623-627` sets `coverageItems`/`coverageBuckets`/`aiCoverageScore`/`coverageSnapshot`. The frozen graded items are already in the editor.
- **Live content/SEO score** — `computeContentScore` already re-runs live (`ContentScorePanel.tsx:339-356`; `optimizeReview` memo `[id]/index.tsx:726-747`, which substitutes each placeholder's `newHtml`). The **live entity slot** (`contentScore.ts:334-338`, `countOccurrences(plainText, i.label) >= 1`) is the exact pattern the AI-Visibility `entity` rule mirrors.
- **`scoreDeltas` already wired** — `ContentScorePanel` accepts `scoreDeltas` (`:84`) fed from `optimizeReview.seoDelta` (`[id]/index.tsx:1959`) → `ScoreTrio` `deltas`. `deltas.ai` exists on `ScoreTrio`/`ScoreGauge` but is currently unused — G drives it.
- **Review doc + NodeView + store + bar + cancel modal + odometer + OptimizeResultsPanel** — as in the spec "What already exists". `buildReviewDoc` KEPT.
- **Uncovered-items UI** — `WriteOptimizePanel` bucket badges (`:415/632`) + covered/uncovered rows (`StatusDot`, `:186`) from `coverageItems`/`coverageBuckets`. Feed them `liveItems` to refresh.
- **`[id]/index.tsx` anchors** — `handleAutoOptimizeSections` (`~:1150`), `buildReviewDoc` at `done` (`:1235`), review-completion effect (`:1266`), `resolveAllOptimizerNodes` (`:1302`), `handleConfirmCancel` (`:1336`), `handleSaveOptimizeRun` (`:1355`, creates `auto_optimize` version; toast at `:1394`), render (`:1952`/`:2035`/`:2052`), Version History (`showHistory`, `:404`/`:1940`).

---

## File Structure

**Create:** `lib/liveCoverage.ts`; `lib/optimizeMessaging.ts`; `components/articles/AoScoreFloat.tsx`; `components/articles/AoScoreAttribution.tsx`; `components/articles/RemainingOpportunities.tsx`; `components/articles/OptimizeSaveModal.tsx`; `components/articles/OptimizeSavedBanner.tsx`; `__tests__/lib/liveCoverage.test.ts`; `__tests__/lib/optimizeMessaging.test.ts`.
**Modify:** `components/articles/contentOptimizerNode.ts` (status enum +`improved`); `components/articles/optimizeStore.ts` (optional `focus`/`mode`/`reason`); `components/articles/ContentOptimizerNodeView.tsx` (status label + result chip + Improved pill; KEEP ✓/✗ + diff); `components/articles/OptimizeResultsPanel.tsx` (summary header + Adjustments cards + Remaining-Opportunities slot); `components/articles/OptimizeReviewBar.tsx` (status-by-focus subtitle + Save → confirm modal); `pages/articles/[id]/index.tsx` (activeSectionId + live re-score loop + debounce + Save-modal/banner wiring + render OptimizeResultsPanel + pass liveItems to ContentScorePanel); `styles/globals.css` (`aoShimmer`).
**Untouched:** all planner/ROI/credit/abort/retry; **`lib/aiCoverage.ts` + `lib/contentScore.ts` internals** (import + reuse only); `lib/aiSearchScore.ts`; `lib/optimizeReviewDoc.ts` `buildReviewDoc` (KEPT); `lib/optimizeWordDiff.ts`; `lib/optimizeSectionEvents.ts` (fields already present; F/D territory).

---

## Task 1 — `lib/liveCoverage.ts` (pure re-score core) + tests

- [ ] Create `lib/liveCoverage.ts` importing types + the reused pure functions (`import type { CoverageItem, CoverageType, BucketScore } from './aiCoverage'`; `import { computeCoverageScores } from './aiCoverage'`; `import { countOccurrences, _faqCoverage, _readability, _listUsage } from './contentScore'`). First add the `export` keyword to those three helpers in `contentScore.ts` (non-behavioral, no body change) so they can be imported. Do NOT re-export or alter any other internals.

```ts
export const PRESENCE_CHECKABLE: ReadonlySet<CoverageType> = new Set(['entity', 'structure', 'readability', 'paa']);

/** Re-derive `covered` for presence-checkable items from the current text/HTML; carry frozen items
 *  verbatim. Immutable — returns a NEW readonly array, never mutates an item. */
export function liveCoverageItems(
  snapshotItems: readonly CoverageItem[],
  plainText: string,
  html: string,
): readonly CoverageItem[] {
  return snapshotItems.map((it) => {
    if (!PRESENCE_CHECKABLE.has(it.type)) return it;                 // frozen — verbatim
    const covered = presenceCovered(it, plainText, html);
    return covered === it.covered ? it : { ...it, covered };         // spread, never mutate
  });
}

/** Deterministic presence check per type. Local re-implementations of the same rules the content
 *  scorer uses (contentScore.ts helpers are private + must stay untouched — Part 8). */
function presenceCovered(it: CoverageItem, plainText: string, html: string): boolean {
  switch (it.type) {
    case 'entity':      return countOccurrences(plainText, it.label) >= 1;             // == contentScore.ts:336
    case 'structure':   return hasStructure(html);                                     // headings/lists/question-format
    case 'readability': return readableParagraphs(html);                               // paragraph-length metric
    case 'paa':         return faqAnswered(it.label, html);                            // question answered in body/heading
    default:            return it.covered;
  }
}

/** Positive per-bucket deltas only, sorted desc — "why it improved". Matched by bucket key. */
export function scoreAttribution(before: readonly BucketScore[], after: readonly BucketScore[]): Array<{ label: string; delta: number }> {
  const beforeByKey = new Map(before.map((b) => [b.key, b.score]));
  return after
    .map((b) => ({ label: b.label, delta: b.score - (beforeByKey.get(b.key) ?? b.score) }))
    .filter((r) => r.delta > 0)
    .sort((a, b) => b.delta - a.delta);
}

/** Uncovered items grouped by display bucket — the "Remaining AI Opportunities" panel. */
export function remainingOpportunities(liveItems: readonly CoverageItem[]): Array<{ label: string; count: number }> { /* group !covered by a display label */ }

/** Real-evaluation gate: only a positive recomputed delta animates. */
export function scoreDeltaGate(oldScore: number, newScore: number): { animate: boolean; delta: number } {
  const delta = Math.round(newScore) - Math.round(oldScore);
  return { animate: delta > 0, delta };
}
```
Implement `hasStructure` (heading/list regex over `html`, mirroring `_listUsage` intent), `readableParagraphs` (avg words-per-`<p>` in 40–100, mirroring `_readability`), `faqAnswered` (≥70% of the label's content words present in body OR ≥60% in a heading, mirroring `_faqCoverage`) as small LOCAL pure functions. Keep them minimal and deterministic.

- [ ] Create `__tests__/lib/liveCoverage.test.ts` covering:
  - `liveCoverageItems` **immutability**: input array + items are unchanged after the call (deep-equal the input); output is a new array; frozen-type items are the SAME object reference (verbatim) while a flipped presence item is a NEW object.
  - `entity` flips covered `false→true` when the label appears in `plainText`; `true→false` when removed.
  - a FROZEN type (`intent`, `fact`, `definition`, …) is NEVER changed even if its label happens to appear in the text (assert `covered` unchanged) — "frozen items never fabricate movement".
  - `structure`/`readability`/`paa` toggle on constructed HTML fixtures.
  - end-to-end: `computeCoverageScores(liveCoverageItems(snap, text, html), early)` rises when an entity is added and is FLAT when only a frozen-only edit happens.
  - `scoreAttribution`: only positive bucket deltas, sorted desc, matched by key; equal/negative buckets dropped.
  - `remainingOpportunities`: counts only `!covered`, grouped.
  - `scoreDeltaGate`: `(70,70)→{false,0}`, `(70,68)→{false,-2}`, `(70,73)→{true,3}`, rounding `(70.4,71.6)→2`.
- **Verify:** `npx tsc --noEmit` clean; `npx jest __tests__/lib/liveCoverage.test.ts` green.
- **Guard rail:** `lib/aiCoverage.ts` and `lib/contentScore.ts` are IMPORTED, never edited.

## Task 2 — `lib/optimizeMessaging.ts` (pure copy helpers) + tests

- [ ] Create `lib/optimizeMessaging.ts` (imports only `StepFocus`/`EditMode` types from `./optimizationPlanner`):
  - `sectionStatusLabel({focus,mode,reason})` (Part 6): `expand`/`mode==='expand'`→"Expanding thin content…"; `ai-coverage`→ `reason` matches `/authorit|fact|citation|source/i` ? "Strengthening factual authority…" : "Improving AI answer readiness…"; `seo-terms`→"Improving SEO coverage…"; `readability`→"Improving readability…"; `skip`→"Already optimized."; fallback→"Optimizing section…".
  - `sectionResultLabel({focus,mode,reason})` (Part 5): never "Rewrote/Expanded/Generated" unless `mode==='expand'` → "Expanded thin content"; `ai-coverage`→ authority/citation/intent refinements else "Improved AI Search coverage"; `seo-terms`→"Added missing coverage"; `readability`→"Improved readability"; fallback→"Improved section".
- [ ] Create `__tests__/lib/optimizeMessaging.test.ts`: every focus → expected status string; `mode==='expand'` overrides; ai-coverage+authority reason; missing focus → fallback; `sectionResultLabel` forbidden-substring guard ("Rewrote"/"Generated" absent for non-expand inputs).
- **Verify:** `npx tsc --noEmit` clean; `npx jest __tests__/lib/optimizeMessaging.test.ts` green.

## Task 3 — Confirm `SectionEvent` fields (coordinate with F)

- [ ] Confirm `lib/optimizeSectionEvents.ts` `SectionEvent` declares `focus?`/`mode?`/`reason?` and `buildSectionEvent(section, result?, step?)` forwards them (it does). No type change unless F asks.
- [ ] Coordinate with F: the ENDPOINT must CALL `buildSectionEvent(section, result, step)` WITH the `step` at both call sites (`optimize-sections.ts:148` skip, `:188` changed). F/D territory. If not landed, the client reads defensively (Tasks 2/10) → generic copy.
- **Verify:** `npx tsc --noEmit` clean.
- **Guard rail:** do NOT change planner logic — these fields already exist on `PlanStep`.

## Task 4 — Node status enum + store fields

- [ ] `components/articles/contentOptimizerNode.ts`: extend the `status` attr accepted values to `pending | active | accepted | rejected | improved` (default `'pending'` stays; string attr — no behavioural change).
- [ ] `components/articles/optimizeStore.ts`: add optional `focus?: StepFocus; mode?: EditMode; reason?: string` to `SectionResult` (already has optional `scores`/`adjustments`). Import the types from `lib/optimizationPlanner`.
- **Verify:** `npx tsc --noEmit` clean.

## Task 5 — `AoScoreFloat` + `AoScoreAttribution` + `aoShimmer` keyframe

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] Add `aoShimmer` to `styles/globals.css` (next to `surferLoaderSweep`): `@keyframes aoShimmer { 0% { background-position: -150% 0; } 100% { background-position: 250% 0; } }`.
- [ ] Create `components/articles/AoScoreFloat.tsx` — self-removing floating chip. Props `{ label: string; onDone: () => void }` (caller passes `label="Optimization Impact +N"` — NEVER "+N AI"). GSAP rise+fade (in ~0.2s, hold, fade out ~2.5s) via `lib/motion/gsap`; on complete call `onDone`. Reduced motion → static then `setTimeout(onDone, 2500)`. Style: `#1AB25E`, 600, `var(--font-family-primary)`, tabular-nums, absolute (caller positions near the active section).
- [ ] Create `components/articles/AoScoreAttribution.tsx` — presentational. Props `{ rows: Array<{ label: string; delta: number }> }` (from `scoreAttribution`). Renders `✓ {label} +{delta}` rows (`✓`/`+N` in `#1AB25E`, label `#18181B`). Renders nothing when `rows` is empty.
- **Verify:** `npx tsc --noEmit` clean. Structure: float renders the label + self-removes; attribution renders one row per positive bucket delta; no "+N AI" wording anywhere.

## Task 6 — `RemainingOpportunities` panel (addition C)

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] Create `components/articles/RemainingOpportunities.tsx` — presentational. Props `{ rows: Array<{ label: string; count: number }> }` (from `remainingOpportunities(liveItems)`). Card style (`background: #f8f9ff, border: 1px solid #E4E4E7, borderRadius: 12`); a "Remaining AI Opportunities" header + a compact row/badge list ("Entities 0 · Facts 3 · Questions 2 · Structure 1"). Zero-count buckets rendered muted (or hidden — pick one, be consistent). This **replaces** the old "Added SEO Entities" tile — do NOT add that tile anywhere.
- **Verify:** `npx tsc --noEmit` clean. Structure: header + per-bucket count; updates purely from its `rows` prop.

## Task 7 — NodeView status label + result chip (KEEP ✓/✗ + word diff)

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] Extend `components/articles/ContentOptimizerNodeView.tsx` (do NOT rewrite; KEEP the Accept/Reject toolbar + the `wordDiffSegments`/`renderDiffHtml` diff body + block-complex fallback; deletion color stays `#9f9fa9`):
  - Read `{ focus, mode, reason }` from `optimizeStore.get(sectionId)` (available after Task 4).
  - **`status === 'active'`:** overlay the `aoShimmer` gradient + `sectionStatusLabel(...)` (muted, top-left) + a pulsing dot. Keep the active glow border (`--purple-40` / `boxShadow: 0 0 0 3px rgba(120,58,251,0.12)`).
  - **`status === 'improved'`:** small "Improved" success pill (`#1AB25E`) + `sectionResultLabel(...)` chip. `accepted`/`rejected` unchanged. Accept/reject splice logic UNCHANGED.
  - Keep `useEntrance`, `sanitizeArticleHtml`, the ✓/✗ buttons as-is. Gate shimmer on `prefersReducedMotion()` (static bg).
- **Verify:** `npx tsc --noEmit` clean. Structure: (a) ✓/✗ toolbar present; (b) word diff still green-add / gray-strikethrough; (c) shimmer + label only when `active`; (d) result chip only on `improved`.

## Task 8 — Summary header: wire + upgrade `OptimizeResultsPanel` (E1 + slot for C)

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] In `components/articles/OptimizeResultsPanel.tsx` upgrade the tiles (keep the gauge + "Auto-Optimize completed" headline + odometer):
  - **"Boosted content score {old} → {new}"** — from `preScore`/`postScore` props.
  - **"Optimized Sections {N}"** — from `changedCount` prop.
  - **DROP the "Added SEO Entities"/old third tile.** Render `<RemainingOpportunities rows={remainingRows} />` (new prop `remainingRows`) in its place.
- [ ] Wire the panel into `pages/articles/[id]/index.tsx` in the `reviewing` state (currently unimported): fed by `preScoreRef.current`, the live `postScore`, `optimizeMetaRef.current.changedCount`, `computeOptimizeStats(changedSectionsRef.current)`, and `remainingOpportunities(liveItems)`.
- **Verify:** `npx tsc --noEmit` clean. Structure: gauge + 2 tiles + Remaining-Opportunities + "✓ Auto-Optimize completed"; no "Added SEO Entities" tile.

## Task 9 — Adjustments list: live nav + labels (E2)

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] In `components/articles/OptimizeResultsPanel.tsx` grow each adjustments row into a card:
  - **label** from `sectionResultLabel({focus,mode,reason})` (pass per-section `focus`/`mode`/`reason` in the adjustments prop, sourced from `optimizeStore`);
  - keep the **`+N words`** chip + the "+N more" overflow;
  - **clickable during the run** → `onCardClick(sectionId)` prop → caller smooth-scrolls to that section (Task 10/11).
  - **snippet + favicons DEFERRED** — do NOT render them until `adjustments[].snippet`/`sourceDomains` are populated (Open item #3). Label + word-delta only.
- **Verify:** `npx tsc --noEmit` clean. Structure: each card = label + word-delta (+ clickable); labels never say "rewrote/generated" for non-expand; no empty snippet/favicon rows.

## Task 10 — Save-confirm modal + top-right saved banner (E5)

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] Create `components/articles/OptimizeSaveModal.tsx` mirroring `OptimizeCancelModal.tsx` (420px, `growOut`, design-system shadow). Props `{ open; onContinueEditing; onSave; saving? }`. Title "Save changes?"; body "Any changes you haven't rejected will be applied to your article." (accept-any-undenied semantics); buttons `Continue editing` (`#F4F4F5`) / `Save` (brand `#783AFB` or dark `#2F2F34`, disabled while `saving`).
- [ ] Create `components/articles/OptimizeSavedBanner.tsx` — a **top-right** fixed banner (NOT a bottom toast). Props `{ open; onOpenHistory; onClose }`. `position: fixed; top: 16; right: 16`; card `#FFFFFF`/border `#F4F4F5`/`growOut`; ✓ `#1AB25E` + "Your changes have been saved" + a `Version History` button (dark `#2F2F34`) → `onOpenHistory`. Auto-dismiss after ~6s or on `onClose`.
- [ ] In `pages/articles/[id]/index.tsx`: add `saveModalOpen` + `savedBannerOpen` state; the bar's `onSave` opens the modal; the modal's `onSave` calls `handleSaveOptimizeRun` then closes; on success open the banner. Replace the plain `toast.success('Auto-Optimize changes saved')` (`:1394`) with the banner; the banner's `Version History` runs `setShowHistory(true)` (mirroring `:1945`).
- **Verify:** `npx tsc --noEmit` clean. Structure: Save opens the modal; confirming saves + shows the top-right banner with a working Version-History button; no bottom success toast.

## Task 11 — Orchestration: activeSectionId + the live re-score loop

- [ ] In `handleAutoOptimizeSections` (`~:1150-1259`): add `activeSectionId` state; on `meta` set it to the first section id, advance on each `section` event; capture `aiVisibilityBaselineRef.current = coverageSnapshot?.overall ?? 0` at run start. Persist per-section `focus`/`mode`/`reason` into `optimizeStore.set(...)` alongside `oldHtml/newHtml/changed` (`:1225`). Do NOT change the `buildReviewDoc`/`setContent(emitUpdate:false)` review-entry (`:1235-1239`).
- [ ] Add the re-score loop. On each Accept (and during streaming, and debounced on manual typing at `AO_RESCORE_DEBOUNCE_MS = 1200`): recompute the post HTML/text the SAME way `optimizeReview` (`:726-747`) already does (substitute unresolved placeholders' `newHtml`), then:
  - `liveItems = liveCoverageItems(coverageItems, postText, postHtml)` (`coverageItems` = the frozen snapshot items from state, `:468/624`).
  - `{ overall: aiNew, buckets: after } = computeCoverageScores(liveItems, coverageSnapshot?.answersMainQuestionEarly ?? false)`.
  - `seoNew = optimizeReview.postScore` (already computed).
  - `scoreDeltaGate(aiVisibilityBaselineRef.current, aiNew)` and the existing SEO gate → drive `ScoreTrio` `deltas.ai` (new) + `deltas.seo` (existing); on `animate`, mount an `AoScoreFloat("Optimization Impact +"+delta)` near the accepted node.
  - keep `after` buckets in a ref as the `before` for the next Accept; render `AoScoreAttribution(scoreAttribution(before, after))`.
  - compute `remainingOpportunities(liveItems)` for the header (Task 8).
  - **feed `liveItems` down**: during the run pass `liveItems` (not the frozen `coverageItems` state) into `ContentScorePanel`'s `coverageItems` prop and the live buckets into `coverageBuckets`, so the uncovered-item badges + bucket badges flip live (spec "Uncovered-items live update"). Guard: only substitute during `optimizeState !== 'idle'`; idle uses the frozen state.
- [ ] KEEP `handleConfirmCancel` (restore `preReviewHtmlRef`) + `handleSaveOptimizeRun` (resolve + `doSave('auto_optimize')`). Do NOT add a Revert handler.
- **Verify:** `npx tsc --noEmit` clean. Structure: (a) `buildReviewDoc` still called at `done`; (b) one `activeSectionId`; (c) each Accept re-scores ONCE and feeds gauge+attribution+opportunities+badges from one `liveItems`; (d) typing re-scores debounced, not per-keystroke; (e) frozen items never move the AI score on a frozen-only edit; (f) no Revert path.

## Task 12 — Smooth scroll + status bar subtitle + Save-modal wiring

> UI task — run `/frontend-design`, read `design.md` first.

- [ ] `components/articles/OptimizeReviewBar.tsx`: while `optimizing`, keep spinner + "Processing section X of Y" and add the active `sectionStatusLabel(...)` (new optional prop `activeStatusLabel?: string`) as the subtitle. Replace the static subtitle "Accept or reject changes, edit afterwards" (`:87`) with the Less-mode line ("Review each upgrade, then Save to apply"). Route `Save` through the confirm modal: the bar keeps calling `onSave`; the CALLER opens the modal. Keep `Cancel` + prev/next.
- [ ] Smooth-scroll: on active-section auto-advance, on prev/next `navigateSection` (`:1321-1333` already uses `scrollIntoView()` — make it `{behavior: prefersReducedMotion() ? 'auto' : 'smooth'}`), and on Adjustments-card click (Task 9 `onCardClick` → find the section's PM pos via `collectOptimizerPositions` + `setTextSelection(...).scrollIntoView()`).
- **Verify:** `npx tsc --noEmit` clean. Structure: bar shows focus-derived status while optimizing; Save opens the confirm modal; scroll is smooth (instant under reduced motion); Accept/Reject unchanged.

## Task 13 — Wire-up, reduced motion, defensive fields

- [ ] Confirm `ScoreTrio` receives BOTH `deltas.seo` (existing) and `deltas.ai` (new) during review, and the summary-header gauge + trio show the SAME `preScore`/`postScore` and the SAME AI baseline/delta.
- [ ] Defensive: if `ev.focus`/`ev.mode` are `undefined` (F not merged), the helpers fall back to generic copy — verify the run reviews + saves end-to-end. If there is NO `coverageSnapshot` (older article), the AI live layer is inert: `liveCoverageItems([]) → []`, AI delta stays 0, the SEO layer + review still work.
- [ ] Confirm `prefersReducedMotion()` short-circuits shimmer, floats, odometer roll, AND smooth scroll.
- **Verify:** `npx tsc --noEmit` clean across the repo. Manual structure walkthrough of the spec data-flow.

---

## Verification Summary

- **Pure logic (Tasks 1,2):** jest — `liveCoverageItems` immutability + frozen-never-moves + presence-flips; `scoreAttribution`/`remainingOpportunities`/`scoreDeltaGate`; messaging mapping + forbidden-word guard.
- **Types (Tasks 3,4):** `npx tsc --noEmit`.
- **UI (Tasks 5–10,12):** `/frontend-design` + `design.md`; `npx tsc --noEmit`; structure-described (✓/✗ + word diff kept; shimmer only when active; summary header 2 tiles + Remaining-Opportunities, no "Added SEO Entities"; attribution rows; "Optimization Impact +N" not "+N AI"; Save-confirm modal; top-right saved banner; float self-removes; smooth scroll).
- **Orchestration (Tasks 11,13):** `npx tsc --noEmit`; structure walkthrough (`buildReviewDoc` kept; one active section; ONE re-score per tick feeding gauge+attribution+opportunities+badges; debounced typing; frozen-only edit → flat AI score; no Revert path; graceful with no snapshot / missing focus).
- **Controller only:** full `npm run build` once at the end. Implementers MUST NOT run it.

## Task count

**13 tasks** (was 11). Rationale: the sub-project now adds the live AI-Visibility re-score loop, so the pure core splits into TWO modules with dedicated TDD — Task 1 `lib/liveCoverage.ts` (`liveCoverageItems` + `scoreAttribution` + `remainingOpportunities` + `scoreDeltaGate`, the immutability/frozen-never-moves tests are the heart of the change) and Task 2 messaging; three new presentational pieces are folded into Tasks 5/6 (`AoScoreFloat` + `AoScoreAttribution`, `RemainingOpportunities`); Task 10 gains the top-right banner (was a toast); Task 11 orchestration now runs the debounced re-score loop feeding the gauge + attribution + opportunities + the live uncovered-item badges from ONE `liveItems`; Task 12 adds smooth-scroll to the bar/nav work. The Revert-only NodeView rewrite, Revert/Revert-all handlers, and `buildReviewDoc` removal remain dropped (Option A).

## Open items for the human

1. **`process` classification.** Defaulted FROZEN (a bare step-list ≠ a correctly-explained process). Move `process` into `PRESENCE_CHECKABLE` (with a `structure`-style rule) only if product wants it to flip on list-presence. One-line change in Task 1.
2. **Reuse of private `contentScore` helpers.** `_faqCoverage`/`_readability`/`_listUsage` are NOT exported and `contentScore.ts` must stay untouched (Part 8). Task 1 re-implements the same deterministic checks LOCALLY in `liveCoverage.ts`. If you'd rather export the originals (single source of truth), that's a `contentScore.ts` edit — confirm before doing it.
3. **Adjustments snippet + source favicons (Task 9).** `adjustments[].snippet`/`sourceDomains` are optional `SectionResult` fields nothing writes yet — cards ship as label + word-delta; enable snippet/favicons only when the endpoint/section-edit path emits them.
4. **"AI Search" side-gauge label vs "Optimization Impact" delta.** The static side-gauge title "AI Search" (a category name) stays; only the DELTA/float wording is "Optimization Impact +N". Confirm this split (vs renaming the side-gauge too).
5. **Part-8 boundary reminder.** The live re-score REUSES `computeCoverageScores`/`computeContentScore`/`countOccurrences` and never re-plans. If any task tempts an edit to `lib/aiCoverage.ts`/`lib/contentScore.ts`/the planner, STOP — that's out of scope.
