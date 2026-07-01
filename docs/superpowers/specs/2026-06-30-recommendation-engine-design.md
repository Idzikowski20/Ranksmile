# Recommendation Engine (Sub-project C) — Design

**Date:** 2026-06-30
**Status:** Draft v2 — plan-review incorporated (integer lift, importance-first sort, checklist instructions, `Recommendation`→`Guideline` rename, deterministic `effort` + `easyWin`, Priority-first UI). Awaiting decision to execute. Direction: audit + A §10 roadmap + `[[surfy-coverage-direction]]`.
**Depends on:** A (Coverage Foundation, merged #9) + B (Shared Context, PR #10). Reuses `CoverageSnapshot`/`CoverageItem`/`computeCoverageScores` (A) and `buildArticleContext`/`ArticleContext` (B).
**Foundation preview:** `docs/superpowers/specs/2026-06-30-coverage-foundation-design.md` §10.

## Goal

Insert the **Recommendation Engine** — the 2nd-review "heart" of the system: it turns a raw `CoverageSnapshot` into a list of **Guidelines** (actionable, user-facing) grouped into **GuidelineGroups** (Surfer's "AI Search Guidelines"). Every downstream consumer (the editor UI now; Auto-Optimize + Outline in D) reads ONE shared guideline source instead of re-interpreting coverage on its own.

`Coverage (A) "what is" → Recommendation Engine (C) "what to do" → Planner (D) "where" → Optimize "how".`

**Defining constraint: NO new LLM call.** C is a pure transformation. A already captured `reason` + `missing[]` on the judge pass (for exactly this). C templates those into an actionable `instruction` — deterministic, cheap, instant. This is why `reason` was pulled into A.

> **Naming (plan-review):** the primary object the UI shows is a **`Guideline`** (Surfer's product term), grouped in a **`GuidelineGroup`**. The sub-project keeps the name "Recommendation Engine" (it's the engine that produces guidelines). "Guideline in GuidelineGroup" reads coherently; the old "Recommendation in GuidelineGroup" did not.

## What C ships

1. `lib/recommendationEngine.ts` — `buildGuidelines(snapshot, context?)` → `Guideline[]`, `groupGuidelines(guidelines, snapshot)` → `GuidelineGroup[]`, plus the pure `buildInstruction` template and derived `effort`/`easyWin`.
2. `lib/coverage/derived/scoreContribution.ts` — the pure projected-lift helper.
3. The **AI Search Guidelines** UI in `WriteOptimizePanel`: a **Priority** strip (highest-lift across all groups) then value-ordered groups, each with per-group score + actionable rows (title, `+N` lift, effort label, "Easy win" badge, instruction).

## Non-goals (deferred)

- **`OptimizationPlanner`** (picks the subset to send to the Auto-Optimize LLM; per-section routing; cost-aware) → **D**. C produces the guideline *catalogue*; D decides which to *act on*.
- **Outline** from the Plan → **D**. **Auto-Optimize per-step prompts** consuming `Guideline.instruction` → **D**.
- **CoverageGraph / Fact / Authority item sources** → **E**. C handles whatever item types the snapshot carries + is forward-compatible.
- No new LLM calls, no new DB columns (guidelines are derived on read).

## Architecture

### Model

```ts
// lib/recommendationEngine.ts
export type GuidelineGroupKey = 'intent' | 'knowledge' | 'authority' | 'quality' | 'structure';
export type GuidelineEffort = 'Easy' | 'Medium' | 'Large';

export interface Guideline {
  id: string;                    // stable: `guideline-${coverageItemId}` (coverageItemId already unique + typed)
  coverageItemId: string;        // provenance → the CoverageItem it derives from
  group: GuidelineGroupKey;      // first-class field (NOT duplicated into the id)
  title: string;                 // short imperative, e.g. "Cover: What is X?"
  instruction: string;           // the applyPrompt Auto-Optimize (D) will consume — synthesized, no LLM
  importance: Importance;        // from the CoverageItem (critical | recommended | optional)
  status: 'open' | 'applied' | 'dismissed';  // 'open' derived; applied/dismissed are TRANSIENT UI state (not persisted)
  projectedLift: number;         // INTEGER — Math.round(scoreContribution(item, snapshot))
  effort: GuidelineEffort;       // deterministic (missing count / needsExpansion) — see below
  easyWin: boolean;              // projectedLift >= 8 && (missing?.length ?? 0) <= 2
  sectionId?: string;            // from the CoverageItem, when the judge localized it
}

export interface GuidelineGroup {
  key: GuidelineGroupKey;
  label: string;                 // 'Intent Alignment' | 'Knowledge Coverage' | 'Authority' | 'Content Quality' | 'Structure'
  score: number;                 // the matching bucket's score (0..100) from the snapshot
  guidelines: Guideline[];       // open guidelines in this group, sorted (see below)
  covered: number;               // covered items in the group
  total: number;                 // total items in the group
}
```

Design notes:
- **Guidelines are DERIVED, not stored.** `buildGuidelines(snapshot)` runs on read. The snapshot already persists `covered`/`quality`/`missing`/`reason`/`sectionId`. No table, no migration. `status: applied/dismissed` is transient UI state (plan-review: do NOT persist).
- **One guideline per NOT-fully-covered CoverageItem.** `covered && quality >= 4` → no guideline (nothing to do). `!covered` / `needsExpansion` / `quality < 4` → a guideline.
- **`projectedLift` is an integer** (plan-review): `Math.round(scoreContribution(...))`. `computeCoverageScores` already rounds `overall`, but the round is made explicit so the UI never sees a float.
- **`instruction` is synthesized deterministically** from `(type, category, label, missing[], reason)`. NO LLM. Optional `context` (B) flavors it with keyword/brand when present.

### `effort` (deterministic, plan-review)

```
needsExpansion (covered-but-shallow → rewrite a section)   → 'Large'
!covered && missing.length > 5                             → 'Large'
!covered && missing.length in 3..5                         → 'Medium'
!covered && missing.length <= 2  (incl. entities, 0 missing) → 'Easy'
```
`easyWin = projectedLift >= 8 && (missing?.length ?? 0) <= 2` — a high-impact, low-work guideline the user can do in a minute (Surfer-style badge).

### Instruction synthesis (LLM-free, checklist style)

`buildInstruction(item, context?)` is pure. `missing[]` renders as a **checklist**, not a comma list (plan-review):

| Item shape | Title | Instruction |
|---|---|---|
| `intent` uncovered (e.g. `intent-answer-early`) | "Answer the main question early" | "Rewrite the first paragraph to directly answer **{keyword}**${reason ? ` — currently: ${reason}` : ''}." |
| `paa`/`fact` uncovered, has `missing[]` | "Cover: {label}" | "Add a section covering **{label}**. Include:\n" + missing.map(m => `• ${m}`).join('\n') |
| `paa`/`fact` `needsExpansion` | "Expand: {label}" | "Deepen **{label}**${reason ? ` — ${reason}` : ''}." + (missing ? " Still missing:\n" + bullets : '') |
| `entity` uncovered | "Use the term: {label}" | "Work the term **{label}** into the copy naturally where relevant." |
| `readability` unmet | "{label}" | "{reason || missing bullets}" (the sidecar rubric already phrases these) |
| `authority` (E) | "Add {label}" | "Cite {label} (statistic / source / example) to strengthen credibility." |

- `{keyword}` / brand come from `context` (B) when provided; absent → omitted (sparse, never throws).
- Data-driven `Record<CoverageType, TemplateFn>` with a category fallback, so E's new types slot in.
- Never blank: even a no-missing/no-reason item gets a non-empty instruction from the fallback.

### GuidelineGroup mapping + sort

`CoverageCategory` → `GuidelineGroupKey`: `intent→intent` ("Intent Alignment"), `knowledge→knowledge` ("Knowledge Coverage"), `authority→authority` ("Authority", empty until E), `quality→quality` ("Content Quality", readability) / `structure` for `type==='structure'` ("Structure"). Each group's `score` = the matching `snapshot.buckets` score.

**Sort within a group (plan-review — importance FIRST):**
```
1. importance   (critical > recommended > optional)   ← critical always shown first
2. projectedLift desc
3. quality asc  (weaker coverage first)
4. title (stable tiebreak)
```
Rationale: the user should always see critical items first, even if a recommended item has a slightly higher lift.

### `scoreContribution` (projected lift — the "+N")

```ts
// lib/coverage/derived/scoreContribution.ts
export function scoreContribution(item: CoverageItem, snapshot: CoverageSnapshot): number;
```
- Pure. Marginal `overall` delta if `item` went to fully covered (`covered:true, quality:5`), all else fixed: `computeCoverageScores(itemsWithThisItemMaxed, early).overall - snapshot.overall`. `computeCoverageScores` (A) works on graded items + a boolean — no judge round-trip.
- `intent-answer-early`'s hypothetical also flips `early` to true (it drives the +15 bonus).
- Callers (buildGuidelines) `Math.round` the result for `projectedLift`.

### `AIProfile`

`AIProfile = { groups: GuidelineGroup[]; overall: number }` — the named assembly of `groupGuidelines(buildGuidelines(snapshot, ctx), snapshot)` + `snapshot.overall`. The data the "AI Search Guidelines" panel binds to. Not a new model.

## Data flow

```
editor load / after analysis ─► parseSnapshot(articles.ai_info_to_cover) ─► CoverageSnapshot
        (optional) buildArticleContext(articleId) ─► ArticleContext (keyword / brand / voice)
                              │
        buildGuidelines(snapshot, context?) ─► Guideline[]   (pure, NO LLM; projectedLift, effort, easyWin)
                              │  groupGuidelines(guidelines, snapshot)
                              ▼
                    GuidelineGroup[]  (+ per-group bucket score)
                              │
        WriteOptimizePanel: [Priority strip] then value-ordered groups (score, rows: title +N effort easy-win instruction)
                              │
        (D consumes Guideline[] — the planner picks the subset to send to Auto-Optimize)
```

## UI (WriteOptimizePanel — plan-review shape)

- **Priority strip on top:** the top ~3–5 guidelines by `projectedLift` across ALL groups (the "do these first"), each with its `+N` and "Easy win" badge where applicable. This is what the user acts on first.
- **Then groups, ordered by value** (weakest bucket score first, or by total open-lift) — NOT five fixed equal sections. Each group: header (label + `score%` pill + `covered/total`), then its sorted guideline rows.
- **Row:** covered/uncovered dot · title · `+{projectedLift}` (success green) · `effort` chip (Easy/Medium/Large) · "Easy win" badge when `easyWin` · instruction as sub-text.
- **Legacy fallback:** NULL-snapshot article → keep the cubic #3 `aiSummary.citations` list (do not show empty groups for un-analyzed articles).
- Reuse `design.md` tokens (status `#1AB25E`, pills `borderRadius:9999`, card `#F4F4F5`); no invented tokens. Ref `[[content-score-gauge-look]]`.

## Error handling / edge cases

- Empty/absent snapshot → `[]` guidelines, empty groups (panel falls back to legacy — already shipped in cubic #2/#3).
- Item with no `missing`/`reason` → generic template (still actionable), never blank.
- `context` absent → instructions omit keyword/brand gracefully.
- `scoreContribution` reuses A's bucket math (guards empty buckets — no div-by-zero).

## Testing

- `scoreContribution` — fully-covered → 0; critical > optional; `intent-answer-early` flips `early`; result an integer after round.
- `buildInstruction` — each type's title+instruction; missing → checklist bullets; missing `reason`/`context` → graceful; unknown type → fallback; never blank.
- `effort`/`easyWin` — the deterministic thresholds (0-2/3-5/>5 missing, needsExpansion→Large; easyWin gate).
- `buildGuidelines` — only NOT-fully-covered items; stable `guideline-${id}`; integer `projectedLift`.
- `groupGuidelines` — categories → 5 named groups; per-group `score` = matching bucket; sort **importance-first** then lift/quality/title.
- UI — Priority strip + value-ordered groups + rows (+N, effort, easy-win); empty snapshot → legacy fallback.
- Regression: full suite green; `tsc` clean; `npm run build` OK.

## Files

**Create:** `lib/coverage/derived/scoreContribution.ts`; `lib/recommendationEngine.ts`; `__tests__/lib/scoreContribution.test.ts`, `__tests__/lib/recommendationEngine.test.ts`.
**Modify:** `components/articles/WriteOptimizePanel.tsx` (AI Search Guidelines UI); `pages/api/articles/ai-visibility.ts` (over-fetch cleanup, B follow-up).
**Untouched:** A's model/scoring core, B's `buildArticleContext`, the judge, the editor gauge.

## Effort

~1–1.5 weeks (audit) — pure/derived logic + one UI surface, no LLM, no DB → fast under subagent execution. Riskiest: the UI (Priority strip + groups per design.md) and `scoreContribution` correctness.

## Resolved plan-review decisions

- `projectedLift` → integer (`Math.round`). ✓
- Sort importance-first, then projectedLift, then quality, then title. ✓
- `buildInstruction` renders `missing[]` as a checklist. ✓
- `Recommendation` → `Guideline` (coherent with `GuidelineGroup`; Surfer's term); sub-project name unchanged. ✓
- Deterministic `effort` (Easy/Medium/Large) + `easyWin` badge. ✓
- UI: Priority strip + value-ordered groups (not 5 equal sections). ✓
- Push-back: `id` stays `guideline-${coverageItemId}` — `group` is a first-class field, not duplicated into the id.
- `status` transient (not persisted) — agreed.
