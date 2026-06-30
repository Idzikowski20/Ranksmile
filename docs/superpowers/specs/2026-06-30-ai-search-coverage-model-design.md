# AI Search Score — Content-Coverage Model (Sub-project #1) — Design

**Date:** 2026-06-30
**Status:** Approved (brainstorming) — ready for writing-plans

## Goal

Make the editor's **AI Search Score** content-driven: it reflects how much of the article's
"Information to cover" (People Also Ask questions + 4 fixed search intents) is actually covered,
plus a bonus for answering the main question early. This replaces the citation-based score *in the
editor gauge*; the existing citation analysis becomes a separate "AI Tracker" metric. Mirrors
SurferSEO's December 2025 model.

This is **sub-project #1 of 3**. It is the foundation:
- **#2 Smart Auto-Optimize** (rework `optimize-sections.ts`: when SEO entities are covered, stop
  adding paragraphs and instead fill AI info-to-cover gaps; short H1; 1–4 paragraphs/section) —
  depends on #1.
- **#3 UI** (Information-to-cover panel, live AI delta, Undo-after-accept, edited-section look) —
  depends on #1.
Each gets its own spec → plan → implementation. This spec covers **only #1**.

## Decisions (locked during brainstorming)

- **Coverage mechanic:** LLM judge per item (one structured-JSON call evaluates the whole article
  against the item list). Not embeddings/heuristics.
- **Score model:** coverage **replaces** the citation-based score in the editor. The citation-based
  `computeAiSearchScore(aiVisibilitySummary)` + ai-visibility analysis stay unchanged as a separate
  "AI Tracker".
- **Compute location:** Node (alongside `optimize-sections.ts`, deepseek-chat), not the sidecar —
  it must react to editor events.
- **Recompute cadence:** event-driven, **not** per-keystroke — on (a) article load / deep-analysis,
  (b) after each Auto-Optimize section completes (drives the live AI delta in #2), (c) a manual
  "refresh AI" action. SEO score stays keystroke-live; AI coverage updates on events to bound LLM cost.

## Architecture

### Information-to-cover model
Per article, a list:
```ts
type InfoItem = {
  id: string;                 // stable slug
  label: string;              // PAA question text, or the intent label
  kind: 'paa' | 'intent';
  covered: boolean;
  section?: string;           // heading text of the section that covers it (when covered)
};
```
- **PAA items:** reuse the People-Also-Ask questions already fetched in `lib/seo/keywordData.ts`
  (DataForSEO). Map each question → one `kind:'paa'` item.
- **Intent items (4, fixed):** `answer-main-question`, `set-expectations`, `who-its-for`,
  `why-it-matters` (`kind:'intent'`).
- Persisted on the article as a JSON column `ai_info_to_cover` (added via `lib/ensureArticlesTables.ts`).

### Coverage checker — `lib/aiCoverage.ts` (new)
- `checkCoverage(plainText: string, items: InfoItem[]): Promise<CoverageResult>` where
  `CoverageResult = { items: Array<{ id: string; covered: boolean; section?: string }>; answersMainQuestionEarly: boolean }`.
- One deepseek-chat call (structured JSON, same pattern as the sidecar/optimize stages —
  deepseek-chat, NOT a reasoning model, per project memory). Prompt fences the article text and asks
  for a strict JSON verdict per item id + whether the opening paragraphs answer the main question.
- Caches by a hash of `(plainText, item ids)`; returns the cached result when unchanged.
- Pure-ish boundary: the LLM call is injected (a `judge` fn) so the scoring logic is unit-testable
  with a stub judge.

### Score — `computeCoverageScore(result, total)` (in `lib/aiCoverage.ts`)
```ts
const coveredRatio = covered / Math.max(total, 1);
const earlyBonus = result.answersMainQuestionEarly ? 1 : 0;
return Math.round(coveredRatio * 80 + earlyBonus * 20); // 0..100
```
Pure function — fully unit-testable, no LLM.

### Wiring
- Article load / deep-analysis builds `ai_info_to_cover` (PAA + 4 intents), runs `checkCoverage`,
  stores the result, and the editor's AI Search gauge reads `computeCoverageScore(...)`.
- `lib/aiSearchScore.ts` is left as-is (citation score → AI Tracker). The editor stops feeding the
  AI gauge from it; instead it uses the coverage score.

## Data flow

```
load/deep-analysis ─► fetch PAA (keywordData) + 4 intents ─► InfoItem[]
                                   │
                          checkCoverage (1 LLM call)
                                   │
                    store ai_info_to_cover  ─►  editor AI gauge = computeCoverageScore()
edit / AO section done ─► (event) re-checkCoverage ─► AI gauge updates (live delta, used by #2)
```

## Error handling
- LLM failure / timeout → keep the previous coverage result (or all-`covered:false` on first run);
  never block the editor. The gauge shows the last known coverage; a small "stale" affordance is a
  #3 concern, not #1.
- No PAA available (DataForSEO empty) → info-to-cover = the 4 intents only; score still computes.
- Malformed JSON from the model → `safeJsonParse` (existing helper) → treat as "no change".

## Testing
- `computeCoverageScore` — pure unit tests (0 items, all covered, none covered, early bonus on/off).
- `checkCoverage` with a **stub judge** — maps the stub verdict to `CoverageResult`, handles
  malformed/empty model output, dedupes item ids.
- `ai_info_to_cover` column round-trips (ensureArticlesTables migration test).
- `tsc --noEmit` clean; build succeeds.

## Files
- **Create:** `lib/aiCoverage.ts` (model types, `checkCoverage`, `computeCoverageScore`).
- **Create:** `__tests__/lib/aiCoverage.test.ts`.
- **Modify:** `lib/ensureArticlesTables.ts` (add `ai_info_to_cover` JSON column).
- **Modify:** `lib/seo/keywordData.ts` (expose PAA questions as `InfoItem[]` builder input).
- **Modify:** the article load / deep-analysis path that populates score data, to build + store
  coverage and feed the editor AI gauge.
- **Untouched:** `lib/aiSearchScore.ts` (citation score → AI Tracker).

## Out of scope (explicitly)
Smart Auto-Optimize behavior, the Information-to-cover UI panel, live AI delta wiring in the gauge,
Undo-after-accept, edited-section appearance. Those are sub-projects #2 and #3.
