# Shared Context (Sub-project B) — Design

**Date:** 2026-06-30
**Status:** Approved — direction set by the audit + sub-project A's §10 roadmap (after 4 tech-lead reviews). This doc expands the A spec's "Sub-project B preview" into a full design and folds in the follow-ups deferred from A's whole-branch review.
**Depends on:** Sub-project A (Coverage Foundation) — MERGED via PR #9 (branch `feature/coverage-foundation`).
**Audit:** `docs/superpowers/specs/2026-06-30-coverage-engine-audit.md` — §6 (Outline), §10.6 weakness #4 (no shared context builder), §10.7 plug-in points.
**Direction:** `[[surfy-coverage-direction]]` memory entry.

## Goal

Eliminate the audit's weakness #4: **every feature rebuilds article context independently from raw DB rows** (Outline, Auto-Optimize, AI Visibility, the sidecar pipeline each re-pull and re-shape their own slice). Ship **one `buildArticleContext(articleId)` helper** that assembles a single typed `ArticleContext` — keyword + score data + coverage snapshot + PAA + terms + competitors + brand voice + custom rules + content type — read once, consumed by AI Visibility, the Recommendation Engine (C), and the Planner (D).

This sub-project is **read-aggregation + one refactor**, not new product surface. It is the plumbing that makes C and D cheap: they receive a fully-hydrated context instead of each re-querying `articles`, `article_terms`, `domain_voices`, `content_settings`, etc.

It also **discharges the follow-ups deferred from A's whole-branch review** (§ "Deferred-from-A" below) — the coverage pipeline's LLM calls get budget-gated, the judge verdict gets shape-validated, and the ai-readability merge stops silently dropping future item types.

## Why now, before C/D

- C (Recommendation Engine) turns a `CoverageSnapshot` + context into `Recommendation[]`; its `instruction` synthesis wants brand voice + custom rules + content type. Without `buildArticleContext`, C would re-pull all of that itself — re-introducing weakness #4 one layer up.
- D (Planner + Outline) consumes recommendations AND context (per-section, brand voice). Same argument.
- The `ArticleContext` shape must stabilize before C/D depend on it — same "fix the shape before consumers arrive" rule that governed A's `CoverageSnapshot`.

## Non-goals (explicitly deferred)

- **Recommendation Engine** (`Recommendation[]`, `GuidelineGroup[]`, `scoreContribution`, `AIProfile`) → **C**.
- **OptimizationPlanner + Outline refactor** → **D** (Outline consumes the Plan, not raw context — audit §6 / 2nd-review Problem 10).
- **CoverageGraph + Fact/Definition/Authority item sources** → **E**.
- New UI surfaces. B is backend aggregation + the AI-Visibility refactor + a thin client hydration of the context where an existing consumer needs it.

## Architecture

### `ArticleContext` shape

```ts
// lib/articleContext.ts
import type { CoverageSnapshot } from './coverageStore'; // re-exported from aiCoverage
import type { ScoreData, ContentScoreBreakdown } from './contentScore';
import type { ArticleTermRow } from './articleTerms';

export interface CompetitorContext {
  domain: string;
  url?: string;
  title?: string;
  headings?: string[];          // from article_competitors (already extracted)
  termsCount?: number;
}

export interface ArticleContext {
  articleId: number;
  keyword: string;              // articles.target_keyword (or the article's primary keyword)
  language?: string;

  // scoring (from A + existing content scoring)
  scoreData: ScoreData;         // articles.score_data (terms, paa_questions, targets)
  breakdown: ContentScoreBreakdown | null;  // computeContentScoreBreakdown(...) — the per-slot gaps
  coverage: CoverageSnapshot | null;        // articles.ai_info_to_cover (parseSnapshot); null for un-analyzed

  // knowledge inputs
  paa: string[];                // score_data.paa_questions
  terms: ArticleTermRow[];      // article_terms rows (the activated table from A)
  competitors: CompetitorContext[]; // article_competitors

  // brand / authoring inputs (today only generate.ts reads these)
  brandKnowledge?: string;      // content_settings brand knowledge
  voiceTone?: string;           // domain_voices for the article's domain
  customRules?: string;         // content_settings instructions
  contentType?: string;         // articles.content_type / tone

  // provenance
  builtAt: string;              // ISO timestamp
}

export async function buildArticleContext(articleId: number): Promise<ArticleContext>;
```

Design notes:
- **One function, many reads, no writes.** `buildArticleContext` only SELECTs. It never mutates the article or triggers LLM work.
- **Reuses A + existing helpers, does not reimplement:** `parseSnapshot` (dual-dialect, from A) for `coverage`; `readArticleTerms(articleId)` (from A) for `terms`; `readContentSettings()` + `getDomainVoices(domainId)` (existing, currently inlined in `pages/api/articles/[id]/generate.ts`) for brand/voice/rules; `computeContentScoreBreakdown` (existing) for `breakdown`.
- **Graceful partials.** Any missing input is `undefined`/`null`/`[]`, never a throw — a freshly-imported article with no analysis still yields a valid (sparse) context. Consumers already handle sparse data (C/D gate on presence).
- **All reads parameterized** (the `db.query(..., { replacements })` + `getArticleIdSql()` pattern established in A's Tasks 10-11). No id interpolation.
- **Dialect-safe.** `coverage` uses `parseSnapshot` (already handles JSONB object vs SQLite TEXT string). Any other JSON column (`score_data`, `article_competitors.*_json`) uses `safeJsonParse` with the same string-or-object guard.

### Data-source map (what `buildArticleContext` reads)

| Field | Source | Helper |
|---|---|---|
| `keyword`, `language`, `contentType` | `articles` row | direct SELECT |
| `scoreData` | `articles.score_data` (TEXT JSON) | `safeJsonParse` |
| `breakdown` | computed | `computeContentScoreBreakdown(html, scoreData, keyword, coverageItems?)` |
| `coverage` | `articles.ai_info_to_cover` | `parseSnapshot` (dual-dialect) |
| `paa` | `score_data.paa_questions` | from parsed scoreData |
| `terms` | `article_terms` table | `readArticleTerms(articleId)` (A) |
| `competitors` | `article_competitors` | `safeJsonParse` on `terms_json`/`entities_json` |
| `brandKnowledge`, `customRules` | `content_settings` | `readContentSettings()` (existing) |
| `voiceTone` | `domain_voices` (by the article's domain) | `getDomainVoices(domainId)` (existing) |

If a helper doesn't exist in the exact shape (e.g. no single `readContentSettings`), the plan's tasks discover the real accessor and mirror it — same "read the real repo pattern, not a sketch" discipline that A used.

### Consumers refactored in B

1. **AI Visibility** (`pages/api/articles/ai-visibility.ts`) — currently re-pulls the article row + competitor domains itself. Refactor to `const ctx = await buildArticleContext(articleId)` and read `ctx.keyword`/`ctx.competitors`/etc. **This is the one concrete refactor in B** — it proves the helper against a real consumer and removes a duplicate context rebuild.
2. **Exposed to C/D** — `buildArticleContext` is the entry point C's Recommendation Engine and D's Planner will call. B ships it; C/D consume it. (No C/D code in B.)

`deep-analysis.ts` is NOT refactored in B: it builds context incrementally as it scrapes (it's the PRODUCER of `score_data`/`ai_info_to_cover`, not a consumer of a pre-built context). B's budget-gating fix (below) touches it surgically, but not its context assembly.

## Deferred-from-A follow-ups — discharged here

A's whole-branch review (opus, recorded in the A ledger) accepted these as "acceptable follow-ups, file for B/E." B is their home because B owns the coverage-consumption seam. Each is a task in the plan.

1. **Budget-gate the coverage LLM calls (from A final-review triage).**
   `pages/api/articles/deep-analysis.ts` runs 2 new deepseek calls (`analyzeIntroduction` + `checkCoverage`) in the coverage block that sits AFTER the org 5h token-budget gate (`orgBudgetBlocked`, checked upstream). An org that's over budget still incurs them. **Fix:** before the coverage block, check the same org budget the rest of the handler uses; if over budget, skip the coverage compute (leave the previous snapshot / fall back) rather than calling the LLM. Record the coverage calls' token usage against the org budget (mirror how `optimize-sections.ts` records via the existing `aiBudget`/`recordAiTokens` helper — see `[[serpbear-security-audit]]`). Non-blocking semantics preserved.

2. **Shape-validate the judge verdict (from A final-review Minor #3 + Important-adjacent).**
   `deepseekJudge`'s parse (`safeJsonParse`, no per-field validation) lets malformed fields through. A already NaN-guarded `quality` (commit `daa6a68`). Finish the job: coerce/validate the remaining numeric/array fields in the verdict mapping — `confidence` → finite [0,1] (default 0), `covered` → boolean, `missing` → array-of-strings (drop non-strings), `sectionId` → string|undefined. And replace `verdict.items || []` (which silently tolerates a null `items` — masking a judge-contract violation) with an explicit "not an array → treat as empty + warn once" so a broken judge reply is visible in logs, not silent. Add unit tests with malformed verdict inputs.

3. **Stop the ai-readability merge from dropping future item types (from A final-review Minor #4 forward-compat).**
   `pages/api/articles/ai-readability.ts`'s merge re-buckets kept items into only `paa`/`intent`/`entity`(+`fact`); a future producer's `definition`/`comparison`/`example`/`statistic`/… items would silently vanish on a readability-only run. Harmless in A (only `paa` is produced), but a latent data-loss bug once C/E add sources. **Fix:** make the merge preserve ALL non-readability kept items generically (keep everything with `type !== 'readability'`, replace only the readability slice) instead of enumerating a fixed allow-list of buckets. Add a test with a `definition`-typed item surviving a readability merge.

4. **`_empty()` coverage_items consistency (cosmetic, from A Minor).**
   `python-sidecar/analyzers/ai_readability.py::_empty()` omits the `coverage_items` key (the TS side defaults to `[]`, so it's safe today). Add `"coverage_items": []` to `_empty()` for shape consistency, so the sidecar's return shape is uniform across happy/fallback paths. One line + note.

Out of scope for B (stay as filed follow-ups): `coverageCache` cap (already fixed in A `daa6a68`), `usePersist('wo:aiSort')` stale-value validation (pure UI cosmetic, self-healing — leave for a UI polish pass).

## Error handling

- `buildArticleContext` never throws on missing data — sparse context with `null`/`[]`/`undefined`. It MAY throw on a hard DB error (the caller decides); consumers wrap it.
- The budget-gate fix keeps deep-analysis non-fatal: over-budget → skip coverage compute (no LLM), keep prior snapshot; the existing try/catch still guards unexpected errors.
- Verdict validation degrades a malformed field to its safe default (never NaN, never a wrong-typed value reaching the score); a wholly-broken `items` logs a single warning.

## Testing

- `buildArticleContext` — unit test with a **stubbed DB layer** (mirror A's `jest.mock('../../database/database', ...)` LOCAL-mock convention; NEVER touch global jest infra): asserts it assembles every field from its source, and yields a valid sparse context when sources are missing (null coverage, empty terms/competitors, absent brand/voice).
- Verdict validation — malformed inputs (string `quality`/`confidence`, non-array `missing`, null `items`) → safe defaults, no NaN, single warn on null items.
- ai-readability merge forward-compat — a `definition`-typed kept item survives a readability-only merge.
- Budget-gate — over-budget org → coverage block skipped (judge not called), snapshot unchanged; under-budget → runs + records tokens. (Stub the budget check + judge.)
- Regression: full existing suite stays green; `tsc --noEmit` clean; `npm run build` exit 0.

## Files

**Create:**
- `lib/articleContext.ts` — `ArticleContext` type + `buildArticleContext(articleId)`.
- `__tests__/lib/articleContext.test.ts`.
- Tests for the deferred-from-A fixes (verdict validation → `__tests__/lib/aiCoverage.test.ts`; merge forward-compat → an ai-readability-focused test or `coverageStore` test).

**Modify:**
- `pages/api/articles/ai-visibility.ts` — consume `buildArticleContext`.
- `pages/api/articles/deep-analysis.ts` — budget-gate the coverage block + record coverage token usage.
- `lib/aiCoverage.ts` — verdict shape-validation in `deepseekJudge`/the verdict mapping; replace `verdict.items || []`.
- `pages/api/articles/ai-readability.ts` — generic non-readability preservation in the merge.
- `python-sidecar/analyzers/ai_readability.py` — `_empty()` emits `coverage_items: []`.

**Untouched:** the A model/scoring core (`CoverageItem`/`CoverageSnapshot`/`computeCoverageScores`), the editor UI, `collectScoreSlots` dual-read.

## Effort

~2–3 days for `buildArticleContext` + the AI-Visibility refactor; +~1 day for the 4 deferred-from-A fixes. Sequenced so the fixes can land first (they're small, independent, and de-risk the coverage path) then the context builder.

## Sequencing into the roadmap

`A (done) → B (this) → C (Recommendation Engine) → D (Planner + Outline) → E (Graph)`. B unblocks C and D by giving them one `buildArticleContext` instead of each re-querying the DB.
