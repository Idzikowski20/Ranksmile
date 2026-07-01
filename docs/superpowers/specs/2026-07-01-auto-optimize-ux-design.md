# Auto-Optimize UX — Live AI Visibility Score + Less-Mode presentation (Sub-project G) — Design

**Date:** 2026-07-01
**Branch:** `feature/auto-optimize-ux`
**Status:** Draft v3 — awaiting decision to execute. Direction: the 8-part brief (approved) + tech-lead Part 8 + **[RATIFIED] Option A** review flow + **[RATIFIED] live "AI Visibility Score" re-score loop** (this revision). Extends v2 — Option A and the Surfer screenshot enhancements are KEPT and carried forward, not replaced.
**Depends on:** the existing Auto-Optimize section-streaming flow (D, `pages/api/articles/optimize-sections.ts`) and the companion **Less Mode (decision logic, Sub-project F)** `docs/superpowers/specs/2026-07-01-auto-optimize-less-mode-design.md`, which adds `PlanStep.mode: EditMode` and owns ALL planner changes.

---

## Intro — what already exists, and the one piece this adds

Most of the "Surfer Auto-Optimize" architecture **ALREADY EXISTS in this repo and MUST NOT be rebuilt.** Before designing anything new, map the ask onto what is already shipped:

| "Surfer Auto-Optimize" capability | Where it already lives (do NOT reinvent) |
| --- | --- |
| Weighted-composite AI score (NOT an entity count) | `computeCoverageScores(items, answersMainQuestionEarly)` (`lib/aiCoverage.ts:176`) — `blendBuckets` (cap 85) + `earlyAnswerBonus (+15)`; `BUCKET_WEIGHT {intent:3,knowledge:2,authority:2,quality:2,style:1}`, `IMPORTANCE_WEIGHT {critical:3,recommended:2,optional:1}`. |
| "Don't pile on entities — shift to AI" behavior | Less-Mode AI-takeover + `worthEditing` (Sub-project F). |
| Per-step `reason` / `focus` | `PlanStep.focus` (`lib/optimizationPlanner.ts:11`, `StepFocus`), `PlanStep.reason` (`:23`); `EditMode` (`:13`) via F. |
| Gap→targeted-patch planning + ROI priority = impact×(1−difficulty) | Sub-project D: `scoreContribution`×`effortOf`, `diminishingLift`, `trimToBudget`. |
| LLM used ONLY for patch generation | Endpoint loop (D); the AI *judge* (`deepseekJudge`, `aiCoverage.ts:250`) runs once at deep-analysis time, not per edit. |

**The ONLY missing piece this sub-project adds** is a **live re-score loop for display + attribution**: a client-side, pure recompute of the AI Visibility Score (and the content/SEO score, which is already live) as the user accepts changes and types, so the gauge, the delta badge, the attribution breakdown, the "Remaining AI Opportunities" panel, and the uncovered-item badges all move together and honestly reflect the current document. **We add a re-SCORE loop; we do NOT add a re-PLAN loop.** State this mapping explicitly so implementers do not touch the planner.

---

## Goal

A **presentation + live-re-score** layer over the Auto-Optimize section stream:

1. One section animates at a time (shimmer + focus-derived status label) while the run streams.
2. As sections resolve and as the user accepts/types, the editor **re-scores client-side** — both the content/SEO score (already live via `computeContentScore`) AND a **new live AI Visibility Score** (pure recompute over a live-derived coverage-items array feeding the existing `computeCoverageScores`).
3. Changes are proposed as a **tracked-changes review doc** the user reviews per-change (Accept/Reject ✓/✗) then commits with a global **Save** (behind a confirmation modal).
4. The one re-score feeds EVERYTHING: the gauge odometer + delta badge, a **score-attribution breakdown** ("why it improved"), a **"Remaining AI Opportunities" panel** (uncovered counts per bucket), AND the **uncovered-item badges** in `ContentScorePanel`/`WriteOptimizePanel` (so "React ❌ → ✓" flips as the entity appears).
5. Every message says "small upgrade", never "rewrite", and the score delta is labeled **"Optimization Impact +N"**, never "+N AI Search".

`Planner (D+F) "where + whether + how much" → section SSE stream → UX (G) "how it looks + how it is reviewed + how it re-scores".`

## The "Not a rewrite. An upgrade." philosophy

Every visible cue reinforces one message: the model made a **small, precise, reviewable** edit — not a rewrite. The rules:

1. **One section at a time.** Exactly one section is `active` (shimmer + glow + status) while the run streams. The whole document is never animated. Shimmer clears the instant that section's `section` event arrives.
2. **Immediate, honest impact — via real re-score.** As sections resolve, RE-SCORE the document (content/SEO + AI Visibility) from the actual current text/HTML. Animate a positive delta ONLY when the recomputed score really rose. `delta <= 0` → no animation, no fake number.
3. **Review, then Save (Option A).** Changes are proposed as a **tracked-changes review doc**, NOT auto-applied. The user keeps or discards each change with the existing per-change Accept/Reject (✓/✗), then commits the whole run with a global **Save** (confirmation modal). Post-save undo is via **Version History**, not an inline revert.
4. **Minimal-upgrade language.** Copy is derived from `focus`/`mode`/`reason`. Never "Rewrote / Expanded / Generated" — UNLESS `mode === 'expand'` (F deliberate EXPAND).
5. **Honest score labeling.** The composite is an internal *proxy* for how likely the content is to be cited — NOT a promise that Google/OpenAI will grant +N. The delta reads **"Optimization Impact +N"**, never "+N AI Search". (Global Constraint — see below.)

## Non-goals (explicitly OUT)

- **No planner/routing/ROI/`expectedLift`/guideline-assignment/mode-selection change.** All of that is D + F. G reads their output and re-SCORES for display; it never re-PLANS.
- **No new LLM call. No new endpoint.** The live re-score is a NEW PURE client-side helper reusing `computeCoverageScores`/`countOccurrences`/`_faqCoverage`. An earlier draft floated a lightweight re-score endpoint — that is **superseded** (client-side is lighter, zero round-trips; see "Ratified decisions").
- **No new DB column, no persistence-shape change.** The `auto_optimize` version snapshot on Save (`handleSaveOptimizeRun`, `[id]/index.tsx:1355`) is unchanged — it already creates the Version-History entry Option A relies on.
- **No change to the credit/abort/retry machinery** in the endpoint loop.
- **No mutation of `lib/aiCoverage.ts` / `lib/contentScore.ts` internals.** Import + reuse only.

## What already exists in code (build on it, do NOT reinvent)

The current branch already implements most of the Option-A flow AND already hydrates the coverage snapshot client-side. G **extends** it.

- **Coverage snapshot already hydrated client-side (T12):** `parseSnapshot(art.ai_info_to_cover)` runs on article load and sets `coverageItems`, `coverageBuckets`, `aiCoverageScore`, `coverageSnapshot` into React state (`[id]/index.tsx:623-627`). So the frozen, LLM-graded `CoverageItem[]` (with `covered`/`quality`) is ALREADY in the editor — no fetch needed to re-score.
- **Content/SEO score already re-scores live client-side:** `computeContentScore` is pure/sync and already re-runs on every keystroke (`ContentScorePanel.tsx:339-356`) and during review (`optimizeReview` memo, `[id]/index.tsx:726-747`) — the latter substitutes each unresolved `contentOptimizer` placeholder's `newHtml` back in before scoring, so the SEO gauge already climbs live. **The LIVE entity slot** (`contentScore.ts:334-338`) already re-derives entity coverage from the CURRENT text (`countOccurrences(plainText, i.label) >= 1`) rather than the frozen snapshot flag — this is the exact pattern the AI-Visibility live layer generalizes.
- **Review-doc mechanism (KEEP):** `buildReviewDoc` (`lib/optimizeReviewDoc.ts`) turns the ordered `section` events into a doc where each changed section is a `contentOptimizer` atom; the FIRST changed section is `active`, the rest `pending`. Buffered at `done` with `changedCount > 0` and set with `emitUpdate:false` (`[id]/index.tsx:1235-1239`).
- **Per-change Accept/Reject NodeView (KEEP):** `ContentOptimizerNodeView.tsx` renders a bordered box with a floating ✓/✗ toolbar. `handleAccept` splices `newHtml`; `handleReject` splices `oldHtml` (real PM transactions). It renders a **word-level inline diff** (green added / gray strikethrough `#9f9fa9`) via `lib/optimizeWordDiff.ts`, with a two-block fallback for block-complex markup (`BLOCK_COMPLEX_RE`).
- **Store (KEEP + extend):** `optimizeStore` (`optimizeStore.ts`) is a `Map<sectionId, SectionResult>`; `SectionResult` already carries optional `scores?` and `adjustments?`. G adds optional `focus`/`mode`/`reason`.
- **Review bar / cancel modal (KEEP + extend):** `OptimizeReviewBar.tsx` (fixed bottom bar) + `OptimizeCancelModal.tsx` (design-system confirm modal). G adds a **Save**-confirm twin + focus-derived subtitle.
- **Score gauges + odometer (REUSE):** `ScoreGauge.tsx` = dual-arc gauge with an **odometer** (`motion/react`) + a green `↑N` `DeltaBadge`. `ScoreTrio.tsx` composes SEO | overall | AI Search and already accepts a `deltas` prop wired via `scoreDeltas` (`[id]/index.tsx:1959`, `ContentScorePanel.tsx:84`). AI Search gauge value comes from `aiCoverageScore` (snapshot overall).
- **Uncovered-items UI (KEEP + refresh live):** `WriteOptimizePanel.tsx` renders **bucket badges** (`bucketBadges`, `:415/632`) from `coverageBuckets`, and per-item covered/uncovered rows (`StatusDot` + line-through, `:186-188/210`) from `coverageItems`. `ContentScorePanel` shows the SEO term chips and the "What's missing" gaps. These are driven by the SAME `coverageItems`/`coverageBuckets`/`coverageSnapshot` props — feeding them the live-updated items array makes them refresh.
- **Summary panel (REUSE + upgrade):** `OptimizeResultsPanel.tsx` (gauge + "Auto-Optimize completed" + 3 stat cards + adjustments list) EXISTS but is NOT yet imported/rendered in `[id]/index.tsx`. `computeOptimizeStats` (`lib/optimizeStats.ts`) computes its word-delta stats. G wires it in as the summary header and swaps its tiles to the Surfer target.
- **Save + Version History (REUSE):** `handleSaveOptimizeRun` resolves optimizer atoms then `doSave('auto_optimize', …)` persists a version snapshot; `showHistory` panel (`:404/1940`) restores per-version. Option-A post-save revert = this existing versioning.

---

## RATIFIED ARCHITECTURE — "AI Visibility Score" = Frozen AI Evaluation + Live Coverage Delta

The AI Visibility Score shown during a run is:

```
AI Visibility = computeCoverageScores( liveCoverageItems(snapshotItems, plainText, html), answersMainQuestionEarly ).overall
            = baseline + optimizationGain        // displayed e.g. "67 (+6)"
```

### 1. Client-side, NO endpoint, NO LLM
The `CoverageSnapshot` + pure scorers are already hydrated in the editor (T12; `ContentScorePanel`/`WriteOptimizePanel` already score client-side). The live re-score is a NEW PURE client-side helper that reuses `computeCoverageScores`. **No round-trip, no LLM.** (The rejected endpoint alternative is documented under Ratified decisions.)

### 2. Two layers — LIVE-checkable vs FROZEN

Each `CoverageType` is classified as either **presence-checkable client-side** (its `covered` is re-derivable from the current text/DOM) or **frozen** (its `covered`/`quality` require the LLM judge and MUST be carried through verbatim from the snapshot). Define an explicit set:

```ts
// The coverage types whose `covered` we RE-DERIVE client-side on each re-score.
const PRESENCE_CHECKABLE: ReadonlySet<CoverageType> = new Set([
  'entity',       // label match via countOccurrences(plainText, label) >= 1  (SAME rule as contentScore.ts:336)
  'structure',    // DOM headings/lists/question-format present               (regex over html, like _listUsage)
  'readability',  // paragraph-length text metric                             (mirror of _readability(html))
  'paa',          // FAQ-answer presence                                      (reuse _faqCoverage semantics over the label as a question)
]);
// Everything NOT in this set is FROZEN (semantic — needs the LLM judge).
```

**Presence-checkable — the mapping, with the exact rule and justification:**

| Type | Live rule (pure, client-side) | Why it is safe to re-derive |
| --- | --- | --- |
| `entity` | `countOccurrences(plainText, item.label) >= 1` | A literal label match; already done live at `contentScore.ts:336`. Deterministic. |
| `structure` | Regex/DOM check for the expected heading/list/question-format in `html` | Structural presence is observable in the markup (cf. `_listUsage`, heading regex in `contentScore.ts`). |
| `readability` | Paragraph-length metric over `html` (mirror `_readability`) | A pure text metric — no semantics needed. |
| `paa` | FAQ-answer presence for the label-as-question (reuse `_faqCoverage` matching) | `_faqCoverage` already decides "is this question answered" from body/heading word overlap — a deterministic client-side check. |

Note: `keyword`, `formatting`, and `lists` referenced in the brief are NOT distinct `CoverageType`s — they are folded into `entity`/`structure` above and are ALSO already covered by the live content/SEO score (`_kwPlacement`, `_listUsage`). No new type is invented.

**FROZEN — carried verbatim from the snapshot (never fabricate movement):**

| Type | Why frozen |
| --- | --- |
| `intent` | The +15 early-answer bonus + intent quality are LLM judgments ("does the FIRST paragraph answer the main question"). Not client-verifiable. |
| `fact` | Factual correctness/completeness needs the judge; a keyword match ≠ the fact being stated correctly. |
| `definition`, `comparison`, `example`, `statistic`, `expectation`, `warning`, `process` | All semantic "is this concept genuinely covered/explained" judgments. Client can pattern-match words but cannot verify the semantics — re-deriving them would fabricate movement. |
| (authority / citation-probability signals) | Authority items map to `category: 'authority'` and are judged by the LLM (and, for AI-visibility, are domain-level). Frozen. |

> **AMBIGUOUS — flag for the human:** `process` is arguably weakly presence-checkable (a numbered/step list is structural). We classify it **FROZEN** by default (whether a *process is correctly explained* is semantic, and a bare list ≠ a covered process). If product wants `process` to flip on list-presence, move it into `PRESENCE_CHECKABLE` with a `structure`-style rule — a one-line change. Called out in "Open items for the human".

**Rule: FROZEN items NEVER fabricate movement.** `liveCoverageItems` copies their `covered`/`quality` through untouched. Only presence items can flip.

### 3. Re-score = pure recompute

```ts
/** Return a NEW readonly items array with presence-checkable items' `covered` re-derived from the
 *  current text/HTML; frozen items are carried through verbatim. Immutable — spreads, never mutates. */
export function liveCoverageItems(
  snapshotItems: readonly CoverageItem[],
  plainText: string,
  html: string,
): readonly CoverageItem[];
```

Then feed the result to the existing `computeCoverageScores(liveItems, answersMainQuestionEarly)` → new AI Visibility `overall` + `buckets`. Pure, synchronous, unit-testable. `answersMainQuestionEarly` is FROZEN — read from the snapshot (`CoverageSnapshot.answersMainQuestionEarly`), not re-derived (it is an intent judgment).

### 4. Triggers + debounce
Re-score on:
- **`onAcceptOptimization()`** — each Accept (immediate; the doc changed by a discrete, meaningful chunk).
- **Manual typing** — debounced **`AO_RESCORE_DEBOUNCE_MS = 1200`** (in the 1000–1500ms band). NEVER per keystroke — `liveCoverageItems` + `computeCoverageScores` walk every item; running that on each keypress would lag the editor. Document the constant next to the debounce.

### 5. Re-SCORE, not re-PLAN
DO NOT touch planner/ROI/order/LLM. The planner prioritizes ONCE up front (D+F). We only recompute the score for the gauge/attribution/opportunities. No re-planning, ever.

### 6. Display: baseline + delta
AI Visibility = `baseline + optimizationGain`, e.g. **"67 (+6)"**. `baseline` = the snapshot overall captured at run start (`aiVisibilityBaselineRef`); `optimizationGain` = `liveOverall − baseline` (positive only for the badge). Reuse `ScoreTrio` `deltas.ai` + `ScoreGauge` odometer. The SEO/content arc stays live via `computeContentScore` (already wired through `scoreDeltas`, `[id]/index.tsx:1959`).

---

## THREE ratified additions

### A. Honest labeling — NOT "+N AI"
The gauge delta badge and the floating chip say **"Optimization Impact +N"** (acceptable alt: "+N coverage gained"), never "+N AI Search". Rationale: "+7 AI" falsely implies Google/OpenAI will grant +7 citations; the composite is our internal cite-likelihood proxy. Building a credible tool means labeling it as an *optimization impact* on the proxy, not a promised outcome. This is a **Global Constraint** — every task, mock, and helper uses it. (Note: the static gauge *label* "AI Search" on the trio side-gauge is a category name and stays; it is the DELTA/float wording — the number people read as a promise — that must be "Optimization Impact".)

### B. Score attribution — "Why did it improve?"
After each Accept, show a per-dimension breakdown from the before/after **bucket** deltas: e.g. "✓ Knowledge +2  ✓ Intent +3  ✓ Style +1". Pure helper:

```ts
/** Positive per-bucket deltas only, as display rows. Pure. */
export function scoreAttribution(before: readonly BucketScore[], after: readonly BucketScore[]): Array<{ label: string; delta: number }>;
```

matched by `key`, `delta = after.score − before.score`, keep `delta > 0`, sort desc. Plus a small presentational component (`AoScoreAttribution`). This is the key "the change DID something" UX — not a magic jump. (Bucket labels come from `BucketScore.label` — "Intent"/"Knowledge"/"Authority"/"Quality"/"Style".)

### C. "Remaining AI Opportunities" panel (replaces the "Added SEO Entities 57" tile)
Live-updating counts of **UNCOVERED** items per bucket/type from the (live-updated) items array: e.g. "Entities 0 · Facts 3 · Questions 2 · Structure 1". Data = `liveItems.filter(i => !i.covered)` grouped by a display bucket. **Drop the entities-added tile entirely** (it had no honest source anyway — see v2 "Screenshot vs code #2"). Summary header now = **content-score X→Y tile + Optimized Sections N tile + Remaining-Opportunities panel**. Small pure helper:

```ts
/** Count uncovered items grouped by display bucket, for the Remaining-Opportunities panel. Pure. */
export function remainingOpportunities(liveItems: readonly CoverageItem[]): Array<{ label: string; count: number }>;
```

---

## Also fold in (from the latest screenshots)

- **Uncovered-items live update (critical — else the panel lies):** the SAME live-updated items array must refresh the coverage item list / bucket badges in `WriteOptimizePanel`/`ContentScorePanel` (e.g. "React ❌ → ✓"), not just the gauge. **One re-score → gauge + attribution + Remaining-Opportunities + item badges** — a single source of truth (`liveItems`). Implementation: during the run, pass the live-updated items array (not the frozen `coverageItems` state) down into `ContentScorePanel`'s `coverageItems`/`coverageBuckets` props.
- **Smooth scroll-to-active-section** on auto-advance, arrow ↑↓ nav, and Adjustments-card click. Use `scrollIntoView({ behavior: 'smooth' })` (the codebase already uses smooth `scrollIntoView`/`scrollTo` in `WriteOptimizePanel:381-382`). Gate on `prefersReducedMotion()` → `'auto'`.
- **Adjustments panel = live nav column during the run** (cards clickable → smooth-scroll to that change) AND post-run summary; cards = **label + word-delta only** (snippet/favicons deferred until the endpoint emits them — see Open items).
- **Save = "accept any undenied adjustments"** — pending → accept via `resolveAllOptimizerNodes` (which already resolves each atom to `newHtml || oldHtml`, `[id]/index.tsx:1302-1316`), behind the confirm modal. Make the semantics explicit in the Save copy.
- **Confirmation banner TOP-RIGHT** ("Your changes have been saved" + a `Version History` button) — NOT a bottom toast. Positioned `position: fixed; top; right`.
- **Diff deletion color = muted gray `#9f9fa9`** (strikethrough) — already the value in `renderDiffHtml` + the block-complex fallback (`ContentOptimizerNodeView.tsx:118`). Confirmed, not changed.

---

## Ratified decisions (recommendation + rationale)

### [RATIFIED] Live re-score = **client-side pure recompute** (supersedes the endpoint idea)
An earlier draft floated a lightweight re-score endpoint. **Rejected / superseded.** The snapshot + pure scorers are already client-side (T12); a client recompute is lighter, has zero round-trips, and keeps Part 8 clean (no endpoint change). Recorded as an explicitly-rejected alternative so it isn't re-proposed.

### [RATIFIED] Review flow = **Option A** (tracked-changes review-then-Save) — carried from v2
- KEEP the per-change Accept/Reject (✓/✗) review-doc mechanism (`contentOptimizer` atom + NodeView + `buildReviewDoc` + `optimizeStore`).
- Global `Cancel` / `Save` bar + a **Save-confirm modal** (mirrors `OptimizeCancelModal`).
- After Save: a **top-right confirmation banner** — "Your changes have been saved" + `Version History` button. Post-save revert is Version History.
- This SUPERSEDES the old OD-2/OD-3 (Revert-only + auto-apply). No per-section Revert, no "Revert all".

### [RATIFIED] Score-delta gate is a real recompute, not a heuristic
The delta gate is `after > before` on the recomputed score, via the SAME pure scorers the editor uses. `scoreDeltaGate(oldScore, newScore) → { animate: delta > 0, delta }` (unit-tested). A section that improves its own text but moves no document-level slot yields `delta === 0` → correctly no animation.

### OD-4 — Animation tech: CSS keyframe for the loop; GSAP + existing `motion/react` odometer for one-shots
CSS `@keyframes aoShimmer` (new, in `styles/globals.css`, tokens only) for the infinite active-section shimmer; project GSAP layer (`lib/motion/gsap.ts`, `useEntrance`) for the "+N" float / "Improved" pill one-shots; existing `ScoreGauge` odometer (`motion/react`) for the number roll. All honor `prefersReducedMotion()` (`gsap.ts:32`).

### OD-5 — Messaging source: a small PURE client helper `lib/optimizeMessaging.ts`
`{focus, mode, reason}` → human copy (`sectionStatusLabel` / `sectionResultLabel`). Server sends DATA, client owns WORDS. Unit-testable, no endpoint deploy to iterate copy.

---

## The SSE contract G REQUIRES from the endpoint

G needs three additive fields on the existing `section` event. These are the **only** endpoint changes G depends on (provided by F + D); G does not write the endpoint. All three already exist on `PlanStep`; `SectionEvent` (`lib/optimizeSectionEvents.ts`) already declares `focus?`/`mode?`/`reason?` optional and `buildSectionEvent(section, result?, step?)` already forwards them when a `step` is passed.

```ts
// lib/optimizeSectionEvents.ts — the additive fields (ALREADY present as optional)
export type SectionEvent = {
   sectionId: string; index: number; headingText: string;
   oldHtml: string; newHtml: string; changed: boolean;
   // -- consumed by G (sourced verbatim from PlanStep; never re-derived) --
   focus?: StepFocus;   // seo-terms | ai-coverage | readability | expand | skip
   mode?: EditMode;     // less | normal | expand   (F)
   reason?: string;     // planner human reason
};
```

**Endpoint wiring G requires (F/D provide it):** call `buildSectionEvent(section, result, step)` WITH the `step` at both call sites (`optimize-sections.ts:148` skip branch, `:188` changed branch). No score is emitted from the server — the live re-score is client-side.

**Boundary contract:**
- **F/D own:** setting `focus`/`mode`/`reason` on `PlanStep`; passing `step` into `buildSectionEvent`.
- **G owns:** consuming them client-side; the whole live re-score loop (`liveCoverageItems`, `scoreAttribution`, `remainingOpportunities`, debounce, wiring); all UI/animation/review-flow; `lib/optimizeMessaging.ts`; the summary header + Adjustments panel + attribution + Remaining-Opportunities; the Save-confirm modal + top-right banner.
- **Shared:** the `SectionEvent` type (already widened). G reads defensively (missing `focus`/`mode` → generic copy) so it merges even if F lands endpoint wiring later.

---

## The 8 parts as concrete component/state/flow specs

### Part 1 — Active-section animation (exactly one active)
- Client keeps `activeSectionId: string | null`. On `meta`, set it to the FIRST section id; advance on each `section` event. `buildReviewDoc` already marks the first changed section `active`.
- `contentOptimizer` `status` attr extended `pending | active | accepted | rejected | improved` (`improved` = accepted with a positive delta). String attr only — no behavioural change.
- Active = shimmer (`aoShimmer`) + glow (`boxShadow: 0 0 0 3px rgba(120,58,251,0.12)`, `border: 1px solid var(--purple-40)` — the NodeView already uses `--purple-40`) + status label (top-left) + pulsing dot.
- Only the single active node shimmers; every other node is static. **Smooth scroll** the active node into view on advance (reduced-motion → instant).

### Part 2 — Live re-score as the run streams (+ odometer on Save)
- **Content/SEO:** `computeContentScore(...)` on the current doc HTML → drives the SEO/overall arcs via the existing `scoreDeltas` (`ContentScorePanel.tsx:84`, `[id]/index.tsx:1959`). Already wired — KEEP.
- **AI Visibility (NEW):** `liveCoverageItems(snapshotItems, plainText, html)` → `computeCoverageScores(...)` → new overall + buckets. Drive `ScoreTrio` `deltas.ai` (currently unused) from `liveOverall − aiVisibilityBaseline`.
- On Save, the odometer rolls old → new on both arcs.

### Part 3 — Real evaluation (no fake improvement)
- Single source of truth: `scoreDeltaGate(old, new)` over the recomputed scores. `delta <= 0` → no bump, no float, node stays `accepted`. `delta > 0` → node `improved`, arc bumps, float "Optimization Impact +N". Frozen coverage items can never move, so semantic scores never fabricate movement.

### Part 4 — Tracked-changes review UX ([RATIFIED] Option A — KEEP Accept/Reject)
- Review doc buffered at `done`, `setContent(reviewHtml, {emitUpdate:false})`. Per-change ✓/✗ KEPT; word-diff KEPT. Completion effect (`[id]/index.tsx:1266-1295`) unchanged. Bar keeps prev/next + Cancel + Save; Save → NEW Save-confirm modal. Save resolves atoms + persists the `auto_optimize` version → top-right banner.

### Part 5 — Less-Mode messaging (minimal upgrades, never rewrites)
- Copy via `lib/optimizeMessaging.ts` `sectionResultLabel({focus,mode,reason})`. Forbidden: "Rewrote/Expanded/Generated" unless `mode==='expand'`.

### Part 6 — Status messaging by focus (active-section label)
- `sectionStatusLabel({focus,mode,reason})`: `seo-terms`→"Improving SEO coverage…", `ai-coverage`→"Improving AI answer readiness…" (or "Strengthening factual authority…" when `reason` matches authority/fact/citation), `readability`→"Improving readability…", `expand`/`mode==='expand'`→"Expanding thin content…", `skip`→"Already optimized.", fallback→"Optimizing section…". (Note: there is NO `authority` `StepFocus` value — authority maps to `focus: ai-coverage`; the refinement is `reason`-derived.)

### Part 7 — Visual polish
- Active: shimmer + glow + status label + pulsing dot. On accept (delta>0): brief "Improved" pill (`#1AB25E`, ~1.2s) + floating **"Optimization Impact +N"** chip (`AoScoreFloat`, GSAP rise+fade, auto-remove ~2.5s) + the attribution rows (`AoScoreAttribution`). On accept (delta≤0): settles to accepted, no float. On Save: odometer roll.

### Part 8 — Overall feel
"Not a rewrite. An upgrade." One section at a time; user sees exactly what the model works on; immediate HONEST impact via real re-score; small precise reviewable edits committed on Save; the score is labeled as *optimization impact*, not a promise.

---

## Enhancements (from the Surfer reference screenshots)

### E1 — Summary header in the Auto-Optimize panel
Reuse the gauge trio as the header + stat tiles + "✓ Auto-Optimize completed". Upgrade the (currently unwired) `OptimizeResultsPanel.tsx` and wire it into the reviewing state.
- **Gauge:** SEO | overall | AI Search trio, `preScore → postScore` via odometer + `↑N` badge.
- **Tiles (the new set):**
  - **"Boosted content score {old} → {new}"** — `old = round(preScoreRef)`, `new = round(postScore)` (client `computeContentScore`).
  - **"Optimized Sections {N}"** — `N = changedCount`.
  - **"Remaining AI Opportunities"** panel (addition C) — REPLACES the old "Added SEO Entities" tile. Uncovered counts per bucket from `remainingOpportunities(liveItems)`.
- **"✓ Auto-Optimize completed"** headline + Option-A subtitle "Review the changes below, then Save to keep them."

### E2 — "Adjustments" list panel (live nav + summary)
Below the header, a scrollable list of per-change cards (grows the existing `{heading, wordDelta}` rows). Each card:
- a **human label** via `sectionResultLabel(...)` (from `optimizeStore` `focus`/`mode`/`reason`);
- the **word-delta** chip (KEEP);
- **clickable during the run** → smooth-scroll to that section;
- **snippet + source favicons DEFERRED** until the endpoint populates `adjustments[].snippet`/`sourceDomains` (Open items). No fabrication.

### E3 — Word-level tracked-changes diff (enhance what exists)
KEEP the word-level diff as the primary render. **Deletion color = muted gray `#9f9fa9` strikethrough** (already the value — confirmed, not red). Block-complex two-block fallback stays. ✓/✗ controls stay.

### E4 — Score attribution + odometer + float (addition B + honest label)
On Accept: `scoreAttribution(before, after)` rows ("✓ Knowledge +2 …") + the "Optimization Impact +N" float + the odometer roll. All aligned to the same before/after buckets.

### E5 — Save-confirm modal + top-right banner + Version History
- **Save-confirm modal** (`OptimizeSaveModal.tsx`, new — mirror `OptimizeCancelModal`): title "Save changes?", body "Any changes you haven't rejected will be applied to your article." (accept-any-undenied semantics), buttons `Continue editing` / `Save`.
- **Top-right confirmation banner** (NOT a bottom toast): "Your changes have been saved" + a `Version History` button (`setShowHistory(true)`). Replaces the plain `toast.success('Auto-Optimize changes saved')` at `[id]/index.tsx:1394`.
- Post-save revert = Version History (the `auto_optimize` snapshot).

---

## Visual specs (design tokens only)

**New CSS keyframe (`styles/globals.css`, next to `surferLoaderSweep`):**
```css
@keyframes aoShimmer { 0% { background-position: -150% 0; } 100% { background-position: 250% 0; } }
```
- **Shimmer fill:** `linear-gradient(100deg, transparent 40%, rgba(120,58,251,0.10) 50%, transparent 60%); background-size: 200% 100%; animation: aoShimmer 1.4s linear infinite;`
- **Active glow:** `boxShadow: 0 0 0 3px rgba(120,58,251,0.12)`, `border: 1px solid var(--purple-40)`.
- **Status label:** `#52525C`, 12px, 500, `var(--font-family-primary)`.
- **Improved pill:** `background: rgba(26,178,94,0.10)`, `color: #1AB25E`, `borderRadius: 9999`.
- **"Optimization Impact +N" float:** `#1AB25E`, 600, `fontVariantNumeric: tabular-nums`.
- **Attribution row:** `✓` in `#1AB25E`, label `#18181B`, `+N` in `#1AB25E`, 12–13px.
- **Diff added:** `background: rgba(26,178,94,0.18); border-radius: 2px`. **Diff removed:** `color: #9f9fa9; text-decoration: line-through` (existing).
- **Summary tiles / Remaining-Opportunities / Adjustments cards:** card `background: #f8f9ff, border: 1px solid #E4E4E7, borderRadius: 12`; value 20px/600/tabular-nums; favicons 14–16px (when eventually enabled).
- **Save-confirm modal:** identical shell to `OptimizeCancelModal` (420px, `growOut`, design-system shadow); primary `Save` = brand `#783AFB` (or dark `#2F2F34`), secondary `Continue editing` = `#F4F4F5`.
- **Top-right banner:** `position: fixed; top: 16; right: 16`; card `#FFFFFF`, border `#F4F4F5`, `growOut`; ✓ `#1AB25E`; `Version History` button dark `#2F2F34`.
- **Reduced motion:** all shimmer/float/pulse/odometer/scroll gated by `prefersReducedMotion()` → static state, instant score/scroll.

---

## Live-score + real-evaluation flow (data flow)

```
meta            → set total; activeSectionId = first; aiVisibilityBaseline = snapshot.overall
section (skip)  → advance active; (no atom)
section (changed)
                → orderedEvents.push; optimizeStore.set(id, {old,new,changed,focus,mode,reason})
                → advance activeSectionId (shimmer moves + smooth scroll)
done (changedCount>0)
                → reviewHtml = buildReviewDoc(orderedEvents); setContent(emitUpdate:false)
                → render summary header (E1) + Adjustments (E2) + Remaining-Opportunities (C); bar = Save
done (changedCount==0)
                → "well-optimized" toast; idle (KEEP)
[user accepts ✓] → splice newHtml (real txn)
                → RE-SCORE ONCE:
                     liveItems = liveCoverageItems(snapshotItems, plainText, html)     [presence re-derived, frozen carried]
                     { overall: aiNew, buckets: after } = computeCoverageScores(liveItems, snapshot.answersMainQuestionEarly)
                     seoNew = computeContentScore(...)                                  [already wired]
                → feed liveItems → ContentScorePanel props (badges/bucket badges flip live)
                → scoreDeltaGate → if animate: ScoreTrio deltas.ai/.seo bump; AoScoreFloat "Optimization Impact +N"; node=improved
                → AoScoreAttribution(scoreAttribution(before, after))
                → Remaining-Opportunities = remainingOpportunities(liveItems)
[user types]    → same re-score, DEBOUNCED 1200ms (AO_RESCORE_DEBOUNCE_MS)
[user Save]     → Save-confirm modal → resolveAllOptimizerNodes → doSave('auto_optimize') → odometer roll
                → top-right banner + Version History button
[user Cancel]   → cancel-confirm modal → restore preReviewHtmlRef (KEEP)
error           → toast; restore preReviewHtmlRef (KEEP)
```

`before` buckets for attribution = the buckets from the PREVIOUS re-score (or the baseline at run start). `preScore`/`aiVisibilityBaseline` captured at run start.

---

## Files (summary; see the plan doc for bite-sized tasks)

**Create:** `lib/liveCoverage.ts` (`liveCoverageItems`, `scoreAttribution`, `remainingOpportunities`, `PRESENCE_CHECKABLE`, `scoreDeltaGate`); `lib/optimizeMessaging.ts` (`sectionStatusLabel`/`sectionResultLabel`); `components/articles/AoScoreFloat.tsx`; `components/articles/AoScoreAttribution.tsx`; `components/articles/RemainingOpportunities.tsx`; `components/articles/OptimizeSaveModal.tsx`; `components/articles/OptimizeSavedBanner.tsx`; tests for the pure helpers.
**Modify:** `components/articles/contentOptimizerNode.ts`; `components/articles/ContentOptimizerNodeView.tsx`; `components/articles/optimizeStore.ts`; `components/articles/OptimizeReviewBar.tsx`; `components/articles/OptimizeResultsPanel.tsx`; `pages/articles/[id]/index.tsx`; `styles/globals.css`.
**Reuse (no change):** `lib/aiCoverage.ts` (`computeCoverageScores` — IMPORT, do not edit), `lib/contentScore.ts` (`computeContentScore`/`countOccurrences` — IMPORT), `lib/optimizeWordDiff.ts`, `lib/optimizeStats.ts`, `components/articles/ScoreTrio.tsx`/`ScoreGauge.tsx`, `lib/optimizeReviewDoc.ts` (`buildReviewDoc` — KEPT).
**Untouched (Part 8 guarantee):** `lib/optimizationPlanner.ts`, `lib/optimizeGuidelineRouting.ts`, `lib/recommendationEngine.ts`, `lib/aiSearchScore.ts`, `buildArticleContext`, the endpoint planner/ROI/credit/abort/retry logic; **`lib/aiCoverage.ts` + `lib/contentScore.ts` internals** (import + reuse only).

---

## Superseded decisions (record so they aren't re-proposed)

1. **Re-score endpoint → client-side pure recompute.** The snapshot is already hydrated (T12); an endpoint adds latency for no benefit and would break Part 8.
2. **"Added SEO Entities {N}" tile → "Remaining AI Opportunities" panel.** The entities-added count had no honest client source (v2 "Screenshot vs code #2"); uncovered counts from `liveItems` are exact.
3. **"+N AI" / "+N AI Search" delta → "Optimization Impact +N".** Avoids implying a guaranteed third-party outcome.
4. **Revert-only + auto-apply (old OD-2/OD-3) → Option A** (from v2; carried).

---

## Screenshot vs code — items the human MUST resolve

1. **`process` classification (presence vs frozen).** Defaulted FROZEN (a bare step-list ≠ a correctly-explained process). If product wants it to flip on list-presence, move `process` into `PRESENCE_CHECKABLE` with a `structure`-style rule. One-line change.
2. **`structure`/`paa` live rules reuse private helpers.** `_faqCoverage`, `_readability`, `_listUsage` are NOT exported from `lib/contentScore.ts`. `liveCoverage.ts` must either (a) re-implement the same deterministic checks locally (recommended — keeps `contentScore.ts` untouched per Part 8), or (b) the human exports them. Plan assumes (a); flag if (b) is preferred.
3. **Adjustments snippets + source favicons (E2).** `adjustments[].snippet`/`sourceDomains` are optional `SectionResult` fields nothing writes yet. Cards ship as **label + word-delta**; snippet/favicons enable only when the endpoint/section-edit path emits them.
4. **Static "AI Search" side-gauge label.** The trio side-gauge is titled "AI Search" (category name) and stays. Only the DELTA/float wording is "Optimization Impact +N". Confirm this split is acceptable (vs renaming the side-gauge too).
5. **`buildReviewDoc` retained.** Option A KEEPS it (turns the buffered stream into the review doc). Do NOT remove.
