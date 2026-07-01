# Recommendation Engine (Sub-project C) — Design

**Date:** 2026-06-30
**Status:** Draft — awaiting decision to execute. Direction set by the audit + A's §10 roadmap (4 tech-lead reviews) + `[[surfy-coverage-direction]]`.
**Depends on:** A (Coverage Foundation, merged #9) + B (Shared Context, PR #10). Reuses `CoverageSnapshot`/`CoverageItem`/`computeCoverageScores` (A) and `buildArticleContext`/`ArticleContext` (B).
**Audit:** `docs/superpowers/specs/2026-06-30-coverage-engine-audit.md`. **Foundation preview:** `docs/superpowers/specs/2026-06-30-coverage-foundation-design.md` §10 "Sub-project C preview".

## Goal

Insert the **Recommendation Engine** — the layer the 2nd tech-lead review identified as the system's "heart": it turns a raw `CoverageSnapshot` into a list of **actionable, user-facing recommendations** grouped into **GuidelineGroups** (Surfer's "AI Search Guidelines"). Every downstream consumer (the editor UI now; Auto-Optimize + Outline in D) reads ONE shared recommendation source instead of re-interpreting coverage on its own.

`Coverage (A) answers "what is" → Recommendation Engine (C) answers "what to do" → Planner (D) answers "where" → Optimize answers "how".`

**The defining constraint: NO new LLM call.** C is a pure transformation. A already captured `reason` + `missing[]` on the judge pass (sub-project A, for exactly this). C templates those into an `instruction` — deterministic, cheap, instant. This is the whole reason `reason` was pulled into A.

## What C ships

1. `lib/recommendationEngine.ts` — `buildRecommendations(snapshot, context?)` → `Recommendation[]`, `groupRecommendations(recs, snapshot)` → `GuidelineGroup[]`, and the pure `scoreContribution(item, snapshot)` helper.
2. The **AI Search Guidelines** UI: `WriteOptimizePanel` renders `GuidelineGroup[]` (named groups with per-group score + actionable rows with projected `+N` lift) — replacing A's raw per-item cards with grouped, actionable recommendations.
3. `lib/coverage/derived/` — the home the 4th review named for derived values (`scoreContribution`, `projectedLift`, `priority`), keeping them out of both the Coverage and Recommendation models.

## Non-goals (deferred)

- **`OptimizationPlanner`** (picks the subset to send to the Auto-Optimize LLM; per-section routing; cost-aware) → **D**. C produces the recommendation *catalogue*; D decides which to *act on*.
- **Outline** generation from the Plan → **D**.
- **Auto-Optimize per-step prompts** consuming `Recommendation.instruction` → **D**.
- **CoverageGraph / Fact / Authority item sources** → **E**. C works with whatever item types the snapshot carries (A ships paa/intent/readability/entity; C handles them + is forward-compatible with future types).
- No new LLM calls, no new DB columns (recommendations are derived on read, not persisted — a snapshot already captures everything they need).

## Architecture

### Model

```ts
// lib/recommendationEngine.ts
export type GuidelineGroupKey = 'intent' | 'knowledge' | 'authority' | 'quality' | 'structure';

export interface Recommendation {
  id: string;                    // stable: `rec-${coverageItemId}`
  coverageItemId: string;        // provenance → the CoverageItem it derives from
  group: GuidelineGroupKey;      // which AI Search Guideline group it belongs to
  title: string;                 // short imperative, e.g. "Add a comparison of X vs Y"
  instruction: string;           // the applyPrompt Auto-Optimize (D) will consume — synthesized, no LLM
  importance: Importance;        // from the CoverageItem (critical | recommended | optional)
  status: 'open' | 'applied' | 'dismissed';  // 'open' derived; 'applied'/'dismissed' are UI state (not persisted in C)
  projectedLift: number;         // scoreContribution(item, snapshot) — the "+N" the UI shows
  sectionId?: string;            // from the CoverageItem, when the judge localized it
}

export interface GuidelineGroup {
  key: GuidelineGroupKey;
  label: string;                 // 'Intent Alignment' | 'Knowledge Coverage' | 'Authority' | 'Content Quality' | 'Structure'
  score: number;                 // the matching bucket's score (0..100) from the snapshot
  recommendations: Recommendation[];  // open recs in this group, sorted by projectedLift desc then importance
  covered: number;               // covered items in the group
  total: number;                 // total items in the group
}
```

Design notes:
- **Recommendations are DERIVED, not stored.** `buildRecommendations(snapshot)` runs on read (editor load / after analysis). The snapshot already persists `covered`/`quality`/`missing`/`reason`/`sectionId` — everything a recommendation needs. No `recommendations` table, no migration. (`status: applied/dismissed` is transient UI state; if persistence is ever wanted it's a later, separate decision.)
- **One recommendation per NOT-fully-covered CoverageItem.** An item that is `covered && quality >= 4` produces no recommendation (nothing to do). `!covered` or `needsExpansion` or `quality < 4` → a recommendation. This mirrors the planner's "skip already-strong items" logic but at the catalogue level.
- **`instruction` is synthesized deterministically** from `(type, category, label, missing[], reason)` via per-category templates (below). NO LLM. Optional `context` (from B's `ArticleContext`) flavors it with brand voice / custom rules when present, but the base instruction never depends on an LLM.

### Instruction synthesis (the core, LLM-free)

`buildInstruction(item, context?)` is a pure function. Templates by `item.category`/`item.type`:

| Item shape | Title | Instruction template |
|---|---|---|
| `intent` (e.g. `intent-answer-early`, uncovered) | "Answer the main question in the intro" | "Rewrite the first paragraph so it directly answers **{keyword}**${reason ? ` — currently: ${reason}` : ''}." |
| `paa`/`fact` uncovered, has `missing[]` | "Cover: {label}" | "Add a section answering **{label}**. Include: {missing.join(', ')}." |
| `paa`/`fact` covered but shallow (`needsExpansion`) | "Expand: {label}" | "Deepen the existing coverage of **{label}**${reason ? ` — ${reason}` : ''}. Still missing: {missing.join(', ')}." |
| `entity` uncovered | "Use the term: {label}" | "Work the term **{label}** into the copy naturally where relevant." |
| `readability` unmet | "{label}" | "{reason || missing.join('. ')}." (the sidecar rubric already phrases these) |
| `authority` (E) | "Add {label}" | "Cite {label} (statistic / source / example) to strengthen credibility." |

- `{keyword}` / brand-voice / custom-rules substitutions come from `context` (B) when provided; absent → the template omits them (sparse, never throws).
- The template map is data-driven (a `Record<CoverageType, TemplateFn>` with a category fallback), so E's new item types slot in without touching the engine.

### GuidelineGroup mapping

`CoverageCategory` → `GuidelineGroupKey` (Surfer's named groups):
- `intent` → `intent` ("Intent Alignment")
- `knowledge` → `knowledge` ("Knowledge Coverage")
- `authority` → `authority` ("Authority") — empty until E
- `quality` → `quality` ("Content Quality") for `readability`; `structure` for `structure`-typed items ("Structure")

Each group's `score` is the matching bucket score already computed in the snapshot (`snapshot.buckets`). So the UI shows "Intent Alignment 95% · Knowledge Coverage 60% · Authority —" with the actionable rows beneath each.

### `scoreContribution` (projected lift — the "+N")

```ts
// lib/coverage/derived/scoreContribution.ts
export function scoreContribution(item: CoverageItem, snapshot: CoverageSnapshot): number;
```
- Pure. Computes the marginal `overall` delta if `item` went from its current state to fully covered (`covered:true, quality:5`), holding all other items fixed.
- Implementation: `computeCoverageScores(itemsWithThisItemMaxed, early).overall - snapshot.overall`, where `computeCoverageScores` is A's exported scorer (works on graded items + a boolean — this is exactly why the 4th review confined it to graded items, so C can call it with a hypothetical array, no judge round-trip). `early` is `snapshot.answersMainQuestionEarly`, except for the `intent-answer-early` item, where the hypothetical also flips `early` to true.
- Result is the `projectedLift` shown on each recommendation and used to sort recommendations within a group.

### `AIProfile`

`AIProfile = { groups: GuidelineGroup[]; overall: number }` — literally the `GuidelineGroup[]` view + `snapshot.overall`. It's the data the "AI Search Guidelines" panel binds to. Not a new model, just the named assembly (`buildRecommendations` + `groupRecommendations` + snapshot scores).

## Data flow

```
editor load / after analysis ─► parseSnapshot(articles.ai_info_to_cover) ─► CoverageSnapshot
        (optional) buildArticleContext(articleId) ─► ArticleContext  (brand voice / custom rules / keyword)
                              │
        buildRecommendations(snapshot, context?) ─► Recommendation[]   (pure, NO LLM)
                              │  groupRecommendations(recs, snapshot)
                              ▼
                    GuidelineGroup[]  (+ per-group bucket score + projectedLift per rec)
                              │
        WriteOptimizePanel renders the "AI Search Guidelines" (named groups, actionable rows, +N lift)
                              │
        (D will consume Recommendation[] — the planner picks the subset to send to Auto-Optimize)
```

## Error handling / edge cases

- Empty/absent snapshot → `[]` recommendations, empty groups (the panel falls back to A's raw view / legacy — the fallback already shipped in cubic #2/#3).
- An item with no `missing`/`reason` (e.g. entity) → a generic template (still actionable), never a blank instruction.
- `context` absent (older article, or caller doesn't pass it) → instructions omit brand/keyword substitutions gracefully.
- `scoreContribution` never divides by zero (reuses A's bucket math, which guards empty buckets).

## Testing

- `buildInstruction` — pure: each category/type template produces the expected title+instruction from a fixture item; missing `reason`/`missing`/`context` → graceful omission; unknown type → category fallback.
- `scoreContribution` — a critical uncovered item yields a larger lift than an optional one; a fully-covered item yields 0; the `intent-answer-early` special-case flips `early`.
- `buildRecommendations` — only NOT-fully-covered items produce recs; `covered && quality>=4` items are excluded; stable `rec-${id}` ids.
- `groupRecommendations` — maps categories → the 5 group keys with the right labels; per-group `score` = the matching bucket; recs sorted by `projectedLift desc` then `importance`.
- UI: `WriteOptimizePanel` renders groups with scores + actionable rows + `+N`; empty snapshot → graceful (legacy fallback).
- Regression: full suite green; `tsc` clean; `npm run build` OK.

## Files

**Create:**
- `lib/recommendationEngine.ts` — `Recommendation`/`GuidelineGroup` types, `buildInstruction`, `buildRecommendations`, `groupRecommendations`.
- `lib/coverage/derived/scoreContribution.ts` — the derived helper.
- `__tests__/lib/recommendationEngine.test.ts`, `__tests__/lib/scoreContribution.test.ts`.

**Modify:**
- `components/articles/WriteOptimizePanel.tsx` — render `GuidelineGroup[]` (the AI Search Guidelines) from `coverageItems` + `coverageBuckets` (already threaded in A Task 12/13) via `buildRecommendations`/`groupRecommendations`. Keep the legacy fallback (cubic #3) for NULL-snapshot articles.
- (optional cleanup, from B's follow-up) `pages/api/articles/ai-visibility.ts` — replace the over-fetching `buildArticleContext` call with the already-loaded `article.target_keyword` (or a narrow `getArticleKeyword`), now that C is the real full-context consumer.

**Untouched:** A's model/scoring core, B's `buildArticleContext`, the judge, the editor gauge.

## Effort

~1–1.5 weeks (audit estimate) — but it's pure/derived logic + one UI surface, no LLM, no DB, so subagent execution is fast. The riskiest piece is the UI (GuidelineGroup rendering per design.md) and `scoreContribution` correctness.

## Open questions for the execute decision

1. **Persistence of `status` (applied/dismissed):** C ships it as transient UI state. Do we want dismissed-recommendation memory across sessions now, or defer? (Defer recommended — needs a store + UX; not required for the AI Search Guidelines panel.)
2. **UI scope:** does C fully replace A's raw per-item cards in `WriteOptimizePanel`, or add the grouped view alongside? (Recommend replace — the grouped actionable view IS the Surfer target; A's raw cards were the interim.)
3. **Include the ai-visibility over-fetch cleanup in C** (a cheap win the B review flagged), or leave as a standalone follow-up?
