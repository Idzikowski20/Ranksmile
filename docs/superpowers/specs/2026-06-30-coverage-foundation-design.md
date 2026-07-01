# Coverage Foundation (Sub-project A) — Design

**Date:** 2026-06-30
**Status:** Approved (v3 — 2nd tech-lead review: `reason` on the judge call, `authority` bucket, Recommendation Engine layer inserted before the Planner, Outline re-pointed at the Plan. v3.1 — 3rd review: `computeCoverageScores` decomposed into swappable pure helpers. See "Review response" at the end)
**Supersedes:** `docs/superpowers/specs/2026-06-30-ai-search-coverage-model-design.md` (the AI-search-only seed)
**Audit:** `docs/superpowers/specs/2026-06-30-coverage-engine-audit.md` — §10.7 plug-in points, §10.9 sub-project A
**Direction:** `[[surfy-coverage-direction]]` memory entry

## Goal

Ship the **shared coverage foundation** that all subsequent Coverage-Engine features consume. Post-A pipeline (2nd-review structure): `Coverage (A) → Shared Context (B) → Recommendation Engine (C) → Planner (D) → Auto-Optimize → Score Update`, with `CoverageGraph + extended sources (E)` running underneath. Coverage answers **what is**, Recommendation **what to do**, Planner **where**, Optimize **how**. The foundation is one item shape, one snapshot wrapper, one storage column, one LLM judge call site, one read helper, one bucket-scoring function, one UI swap.

Concretely, this sub-project:
1. Introduces `lib/aiCoverage.ts` with the `CoverageItem` model, an injected `CoverageJudge`, a `checkCoverage(plainText, items, judge)` runner with versioned cache, **bucket-aware `computeCoverageScores`** returning `{ overall, buckets }`, and the `CoverageSnapshot` wrapper.
2. Adds an `articles.ai_info_to_cover` JSONB column storing a `CoverageSnapshot` (versioned envelope around items + buckets + overall + provenance).
3. Adds an `IntroductionAnalyzer` producing 5 fixed `type:'intent'` items.
4. Reshapes the existing AI Readability rubric to emit `CoverageItem[]` (`type:'readability'`) and merges them into the same snapshot.
5. Swaps the editor's AI gauge + Write/Optimize "info to cover" + Pre-Publish AI Score to read snapshot-shaped data.
6. Activates the `article_terms` table reads in the scoring path (it's shadow data today — written but never read).
7. **Bakes in graph-ready fields** (`parentId?`, `relatedIds?`, `depth?`) on every `CoverageItem` so Sub-project E can add a graph builder without a column migration.

Sub-projects B (`buildArticleContext`), C (`RecommendationEngine` — NEW, from the 2nd review), D (`OptimizationPlanner`), and E (`CoverageGraph` builder + extended sources) are scoped in §10 below. They are NOT in scope here.

## Why one sub-project, not five

The audit (§10.6 weaknesses) shows that the cost of shipping these separately is duplicated wiring: each of A1–A5 touches `pages/articles/[id]/index.tsx`, `ContentScorePanel.tsx`, `WriteOptimizePanel.tsx`, and `pages/api/articles/deep-analysis.ts`. Bundling them lets:
- One PR touch each file once.
- One DB column carry every coverage source.
- The "AI Tracker" split (citations vs. coverage) ship atomically.
- `article_terms` activate behind the same dual-read window as the JSONB column rollout.
- The `CoverageSnapshot` shape stabilize before any consumer depends on it — changing it later means rewriting every consumer.

## Decisions

### Model decisions

- **One TypeScript `CoverageItem` interface, with explicit `category` discriminator.** Knowledge items (`paa | fact | definition | comparison | example | entity | process | statistic | expectation`), quality items (`readability | structure`), intent items (`intent`), and style items (future: `tone | grammar | voice`) all share the SAME shape on storage and the same serialization. The `category: 'knowledge' | 'quality' | 'style' | 'intent'` field is the machine-readable bucket discriminator — scoring iterates buckets (not types), planner reasons over buckets (not types). The flat single-type approach keeps storage + JSON parsing simple; the category field keeps scoring/planner code generic. **Push back on splitting into separate `KnowledgeItem | QualityItem | StyleItem` types**: that fragments consumers (every UI render, every storage parse, every planner step would handle 3+ shapes); category-discriminated single type is the right level of unification for a JSONB store.
- **Graph-ready fields baked in from day one.** Every `CoverageItem` has optional `parentId?: string | null`, `relatedIds?: string[]`, `depth?: number`. Sub-project A populates them as flat (`depth: 0`, `parentId: null`, no `relatedIds`). Sub-project E builds the actual edges. **Push back on shipping full graph in A**: the LLM judge prompt for paa+intent isn't graph-aware today, and making it graph-aware adds variance to the judge output. Better to ship flat + graph-ready, build the graph in a separate pass when extended item sources (facts, definitions) land in E.
- **`source` stays flat; deep metadata moves to `provenance`.** `source: 'serp' | 'competitors' | 'paa' | 'llm' | 'manual'` is a finite trust bucket used everywhere (planner priority, UI label) — keeping it flat is the high-frequency-access argument. The deeper per-judge metadata that WILL grow (which model, when, with which prompt version) moves into `provenance?: { judgedBy?: string; judgedAt?: string; promptVersion?: string }`. This is the right split: trust = flat, audit-trail = nested.
- **`confidence` persisted on `CoverageItem`.** The judge already returns `confidence ∈ [0,1]` on each `CoverageVerdict`. A persists it onto the stored item so the planner can decide to re-judge low-confidence items with a stronger model.
- **`reason` persisted on `CoverageItem` — captured on the judge call A already makes.** WHY an item is uncovered / shallow ("answer hidden mid-section", "fact too vague", "no statistics", "too generic"). The discriminator for putting this in A (vs. deferring): it rides the LLM call the deep-analysis path *already pays for*. Deferring it forces the future Recommendation Engine to re-run the judge on every article — the exact waste the 2nd review flagged. This is different from optional-JSONB fields that A wouldn't populate (those defer for free — see push-backs).
- **`authority` is the 5th bucket, declared now, empty in A.** Surfer's AI Search separates topic Knowledge from Authority (citations / statistics / sources / expert wording). Declared in `CoverageCategory` + `BUCKET_WEIGHT`/`LABEL` now so the taxonomy and the overall-score denominator are final and downstream code (planner focus tokens, UI GuidelineGroups) targets a stable set. No analyzer produces authority items in A → the bucket is empty (weight 0 in the blend, score-neutral) until D adds authority sources. Buckets are derived generically from `category`, so this is three one-liners + zero speculative machinery (YAGNI-safe).
- **What is deliberately NOT on `CoverageItem` (2nd-review push-backs):**
  - **No rename to `Guideline`/`OptimizationItem`.** `CoverageItem` is the *analysis* unit ("this fact is/isn't covered"). A `Recommendation` is the *action* unit ("Add a comparison of X vs Y"). Merging them collapses the Coverage-vs-Recommendation separation the review's own conclusion asks for. They stay distinct types in distinct layers.
  - **No `instruction`/`applyPrompt`/`optimizationPrompt` on the item.** The optimization prompt is a `Recommendation` property, synthesized by the Recommendation Engine from `(label + missing + reason + category + importance)`. Putting it on the coverage item means Coverage decides "how to fix", which is the planner/optimize concern.
  - **No `optimization` metadata (`retryCount`, `alreadyOptimized`, `lastPromptVersion`) yet.** This is optimizer state, owned by the Planner (C). It's an *optional JSONB field* — adding it later is not a migration (old items simply lack it), and A never populates it, so YAGNI says defer. (Contrast `reason`, which A *does* populate for free on the judge call.)
- **`CoverageSnapshot` wraps `items[]` with versioning.** Storage shape is NOT `CoverageItem[]`; it's `CoverageSnapshot { version, model, promptVersion, createdAt, items, buckets, overall }`. The version field carries `judge.version` so we can detect stale snapshots after a prompt/model change. Bucket scores + overall are stored alongside items so the UI doesn't recompute on every render.

### Scoring decisions

- **Bucket scoring, not a single number.** `computeCoverageScores(snapshot)` returns `{ overall, buckets: BucketScore[] }` where each `BucketScore = { key, label, weight, earned, max, items: number, covered: number }`. Surfer shows "Intent 95% / Facts 60% / Entities 88%" because that drives action; a single score doesn't. The `overall` number is a weighted blend of buckets (default weights: intent×3, knowledge×2, quality×2, style×1) plus the +15 early-answer bonus when `answersMainQuestionEarly`. The blend lives in the model; the UI doesn't need to know the formula.
- **Buckets are derived from `category`, not `type`.** Scoring iterates over the 4 categories and computes per-bucket coverage. Adding a new type (`fact`, `tone`) doesn't touch scoring code — it just slots into its category's bucket.
- **`importance × quality / 5` weighting stays inside each bucket.** Each bucket's earned/max is the importance-weighted quality sum (same formula as v1 of the spec, just applied per-bucket instead of globally). Critical items dominate; covered-but-shallow items earn ⅕ of their weight.
- **`computeCoverageScores` is composed of small pure helpers, not one procedure (3rd-review risk).** This is the single load-bearing function — it feeds the AI gauge, recommendation priority (C), the planner (D), `projectedLift`, and Auto-Optimize. To keep weights + algorithm swappable without rebuilding consumers, it decomposes into independently-exported, independently-testable pure functions: `computeBucketScore(category, items, verdicts) → BucketScore`, `blendBuckets(buckets) → number` (the weighted base, capped 85), `earlyAnswerBonus(result) → number` (the +15). `computeCoverageScores` only orchestrates them. Weights live as module constants (`BUCKET_WEIGHT`, `IMPORTANCE_WEIGHT`) — tuning is a one-constant edit, and each helper is unit-tested in isolation so a weighting change can't silently break the blend. **Deliberately NOT done in A (YAGNI):** runtime weight-injection (weights as a parameter / config object). That's an A/B-experimentation concern for D; module constants + swappable helpers are the right level for the foundation. If D later needs live weight experiments, the injection point is a single orchestrator signature change, not a rewrite — because the helpers already isolate the math.
- **`(seo + ai) / 2` stays in `ScoreTrio.tsx:50`.** Only the `ai` argument source changes (from `computeAiSearchScore(aiVisibilitySummary)` to `snapshot.overall`).

### Judge decisions

- **One LLM judge call per deep-analysis run, returning per-id verdicts including confidence AND reason.** The judge accepts a `CoverageItem[]` of mixed types (paa + intent + readability + entity in A; fact + definition + ... later) and returns per-id `{covered, quality, confidence, missing[], reason?, needsExpansion?, sectionId?}` + `answersMainQuestionEarly`. `reason` is captured on this call (not a second pass) precisely so the future Recommendation Engine turns coverage into actionable recommendations without re-invoking the LLM. Cost stays bounded; cache invalidates on prompt/model/temperature change via `judge.version`. Entity rows from `article_terms` are NOT sent to the judge (their `current_count` already grades them deterministically); the judge handles paa + intent (and future fact/definition/comparison/example).
- **`deepseek-chat`, not the reasoning model.** Memory `[[deepseek-chat-not-reasoning-model]]`: the thinking block ate `max_tokens` and produced empty output. `temperature: 0`, `seed: 7`, `response_format: json_object`.
- **`IntroductionAnalyzer` is a separate module with its own judge.** Different prompt (5 fixed yes/no checks against the first ~500 words vs. variable knowledge-item grading against the whole article), different cost profile (smaller input). Sharing the `CoverageJudge` interface keeps it composable later.
- **Compute event-driven in Node.** Triggers: load, deep-analysis, after each Auto-Optimize section (via C), manual refresh. **Not per-keystroke** — LLM cost. SEO scoring stays keystroke-live (deterministic).

### Splitting decisions

- **`lib/aiSearchScore.ts` is untouched** — becomes the **AI Tracker** (separate from the editor gauge). The editor gauge stops reading from it. The split is mechanical: `ContentScorePanel.tsx:583` flips to `snapshot.overall ?? computeAiSearchScore(...)`.
- **AI Readability stays in its own UI surface** (`PrePublishPanel`) and its own analyzer (`python-sidecar/analyzers/ai_readability.py`). Only the *return shape* changes — the 10 criteria become `CoverageItem[]` with `type:'readability'`, `category:'quality'`. Pre-Publish UI keeps reading `ai_readability_json` for backward compat; the snapshot merge is additive.
- **`article_terms` activation = dual-read window**, not big-bang. Writes already happen. Reads prefer `article_terms` when populated; fall back to legacy `score_data.terms`. No backfill — articles get the new path as they're re-analyzed.
- **`article_terms` rows become `CoverageItem`s of `type:'entity'`, `category:'knowledge'`** (or `'fact'` if `term_type='question'`). Mapping at read time in `articleTermsToCoverageItems`.

## Product direction (Surfer Dec-2025) — what A enables vs. defers

**A enables (visible to user):**
- Editor AI gauge driven by coverage with quality grading + bucket drill-down — not citation token-overlap.
- "Information to cover" UI rendered from real per-item data with per-item `missing[]` hints.
- Pre-Publish AI Readability rubric items appear in the gauge math (currently decoupled — comment at `PrePublishPanel.tsx:171-173`).
- 5 intent items (`intent-answer-main` critical, `intent-answer-early` critical, `intent-expectations`/`intent-who`/`intent-why` recommended) with per-item booleans from the LLM, not a single shared `intentCovered`.
- Bucket scores ("Intent 95% / Knowledge 60%") available to UI consumers.
- Snapshot versioning enables stale detection + future history view.

**A defers (later sub-projects):**
- **B (shared context)** — `buildArticleContext(articleId)` consumed by AI Visibility + the Recommendation Engine (C) + the planner (D).
- **C (Recommendation Engine, NEW)** — turns the raw `CoverageSnapshot` into actionable `Recommendation[]` + `GuidelineGroup[]` (the "AI Search Guidelines" UI). Synthesizes each `instruction` from `label + missing + reason + category` — no LLM re-call, because A captured `reason` on the judge pass. `scoreContribution` explainability ("+N") lives here.
- **D (planner + Outline)** — `OptimizationPlanner` between **recommendations (from C)** and the LLM in Auto-Optimize. Reasons over **bucket scores + per-item confidence**: "knowledge bucket 60%, definitions+examples weak → skip entities (88%), focus prompts on definitions+examples." Per-item `confidence < 0.5` triggers re-judge with a stronger model. **Outline generation lives here** — it consumes the ordered Plan, not raw coverage/SERP.
- **E (graph + extended sources)** — Populates `parentId`/`relatedIds`/`depth` via a graph-builder pass. Adds Fact/Definition/Comparison **and Authority** item sources (the latter fill the A-declared, empty `authority` bucket). Enables Auto Expand, Internal Link suggestions, hierarchical Outline. The graph-aware judge prompt (asking the LLM to discover relations) lands here, not in A.
- **Standalone `AiReadabilityPanel` component** — carve-out from `PrePublishPanel.tsx:301-383`. Cosmetic; deferred.
- **`AiSearchPanel` → "AI Tracker" rebrand** — nav + label change only; deferred.

## Architecture

### A1 — CoverageItem model + Snapshot wrapper + bucket scoring + judge

#### Model

```ts
// lib/aiCoverage.ts
export type CoverageType =
  // knowledge
  | 'paa' | 'fact' | 'definition' | 'comparison' | 'example'
  | 'entity' | 'process' | 'statistic' | 'expectation' | 'warning'
  // quality
  | 'readability' | 'structure'
  // intent
  | 'intent';
  // (style: 'tone' | 'grammar' | 'voice' — added in later sub-project, not in this type yet)

export type CoverageCategory = 'knowledge' | 'authority' | 'quality' | 'style' | 'intent';
// 'authority' (citations / statistics / sources / expert wording) is declared now to lock the
// bucket taxonomy + overall-score denominator; it is EMPTY in A (no analyzer produces authority
// items yet) and gets its item sources in D. Empty buckets contribute weight 0, so declaring it
// early is score-neutral until populated — the benefit is a stable set for the planner/UI to target.

export type Importance = 'critical' | 'recommended' | 'optional';

export type CoverageSource = 'serp' | 'competitors' | 'paa' | 'llm' | 'manual';

export interface CoverageProvenance {
  judgedBy?: string;        // e.g. 'deepseek-chat'
  judgedAt?: string;        // ISO timestamp
  promptVersion?: string;   // e.g. 'v1'
}

export interface CoverageItem {
  // identity
  id: string;                       // STABLE: `${type}-${hash(label)}` — never an array index
  label: string;                    // a KNOWLEDGE item ("Explain when to use Hooks") or PAA question
  type: CoverageType;
  category: CoverageCategory;       // discriminator for bucket scoring + planner
  importance: Importance;
  source: CoverageSource;

  // verdict (populated by judge)
  covered: boolean;
  quality: number;                  // 0..5
  confidence?: number;              // 0..1 — judge's confidence in the verdict (planner uses it for re-judge)
  needsExpansion?: boolean;
  missing?: string[];               // specifics still absent → feeds the Recommendation Engine
  reason?: string;                  // WHY covered/uncovered/low-quality ("answer hidden mid-section",
                                    // "fact too vague", "no statistics") — captured on the judge call A
                                    // already makes, so the Recommendation Engine never re-runs the LLM.
                                    // NOTE: the actionable instruction ("Add a comparison of X vs Y") is NOT
                                    // stored here — that is a Recommendation property, synthesized downstream
                                    // from (label + missing + reason + category). Keeps Coverage = "what is",
                                    // Recommendation = "what to do".

  // location
  sectionId?: string;               // stable from lib/articleSections.ts:14-21

  // graph-ready (A ships flat; D populates)
  parentId?: string | null;         // null in A; a CoverageItem.id in D
  relatedIds?: string[];            // empty in A; cross-references in D
  depth?: number;                   // 0 in A; tree depth in D

  // audit trail
  provenance?: CoverageProvenance;
}

export interface CoverageVerdict {
  id: string;
  covered: boolean;
  quality: number;                  // 0..5
  confidence: number;               // 0..1
  needsExpansion?: boolean;
  missing?: string[];
  reason?: string;                  // WHY — same LLM call, feeds the Recommendation Engine (no re-judge)
  sectionId?: string;
}

export interface CoverageResult {
  items: CoverageVerdict[];
  answersMainQuestionEarly: boolean;
}

export interface BucketScore {
  key: CoverageCategory;
  label: string;                    // 'Intent' | 'Knowledge' | 'Authority' | 'Quality' | 'Style'
  weight: number;                   // bucket weight in the overall blend
  items: number;                    // total items in the bucket
  covered: number;                  // covered items in the bucket
  earned: number;                   // weighted earned points (importance × quality/5)
  max: number;                      // weighted max points
  score: number;                    // 0..100 — earned/max
}

export interface CoverageSnapshot {
  version: 1;
  model: string;                    // e.g. 'deepseek-chat'
  promptVersion: string;            // judge.version
  createdAt: string;                // ISO timestamp
  items: CoverageItem[];
  buckets: BucketScore[];
  overall: number;                  // 0..100 — bucket-weighted blend + early-answer bonus
}
```

#### Item sources (this sub-project ships)

- **PAA items** (`type:'paa'`, `category:'knowledge'`, `importance:'recommended'`, `source:'paa'`): from `lib/seo/keywordData.ts` DataForSEO PAA. `id = paa-${hash(question)}`.
- **Intent items** (`type:'intent'`, `category:'intent'`, 5 fixed): from `IntroductionAnalyzer` (A3).
  - `intent-answer-main` (critical)
  - `intent-answer-early` (critical)
  - `intent-expectations` (recommended)
  - `intent-who` (recommended)
  - `intent-why` (recommended)
- **Readability items** (`type:'readability'`, `category:'quality'`, 10 fixed): from `python-sidecar/analyzers/ai_readability.py` reshape (A2). Stable ids `readability-${criterion.key}`.
- **Entity items** (`type:'entity'`, `category:'knowledge'`, `source:'serp'` or `'competitors'`): from `article_terms` table at read time (A5). `quality` derived from `current_count / target_max` ratio; `importance` thresholded from the `importance` column.

Other types (`'fact' | 'definition' | 'comparison' | 'example' | 'process' | 'statistic' | 'expectation' | 'warning' | 'structure'`) are valid in the model but **not populated by this sub-project** — they wait for D.

#### Coverage checker

```ts
export interface CoverageJudge {
  version: string;        // promptVersion|model|temperature — part of cache key
  run: (plainText: string, items: Array<Pick<CoverageItem, 'id' | 'label' | 'type'>>) => Promise<CoverageResult>;
}

export async function checkCoverage(
  plainText: string,
  items: CoverageItem[],
  judge: CoverageJudge,
): Promise<CoverageResult>;
```

- **Injected judge** so `checkCoverage` is unit-testable with a stub.
- **Cache** keyed `${judge.version}|${itemIds.join(',')}|${hashId(plainText)}` — `judge.version` changes invalidate all entries.
- Default judge = `deepseekJudge` (`deepseek-chat`, `temperature:0`, `seed:7`, `response_format: json_object`). Auth pattern mirrors `pages/api/articles/optimize-sections.ts:113-120`.
- Verdicts filtered to known item ids + de-duplicated.
- Entity items are NOT passed to `checkCoverage` (deterministic scoring from `current_count`); readability items are NOT passed (sidecar judges them).

#### Bucket-aware score

```ts
const BUCKET_WEIGHT: Record<CoverageCategory, number> = {
  intent: 3, knowledge: 2, authority: 2, quality: 2, style: 1,
};
const BUCKET_LABEL: Record<CoverageCategory, string> = {
  intent: 'Intent', knowledge: 'Knowledge', authority: 'Authority', quality: 'Quality', style: 'Style',
};
const IMPORTANCE_WEIGHT: Record<Importance, number> = {
  critical: 3, recommended: 2, optional: 1,
};

/** Decomposed into small swappable pure helpers (3rd-review risk mitigation). */
export function computeBucketScore(
  category: CoverageCategory,
  items: CoverageItem[],
  verdicts: Map<string, CoverageVerdict>,
): BucketScore;                                  // importance×quality/5 over covered items in ONE bucket
export function blendBuckets(buckets: BucketScore[]): number;   // Σ(weight×earned)/Σ(weight×max) × 85
export function earlyAnswerBonus(result: CoverageResult): number;  // +15 | 0

/** Orchestrator only — composes the three helpers above. */
export function computeCoverageScores(items: CoverageItem[], result: CoverageResult): {
  overall: number;
  buckets: BucketScore[];
}
```

Implementation outline:
1. For each `CoverageCategory`, collect items where `item.category === category` AND the judge's verdict says covered.
2. Per bucket: `earned = Σ IMPORTANCE_WEIGHT[importance] × clamp(quality,0,5)/5`; `max = Σ IMPORTANCE_WEIGHT[importance]`. `score = round(earned/max × 100)` (empty bucket → score = 0, but contributes 0 to the blend).
3. `overall = round(Σ (BUCKET_WEIGHT[k] × bucket[k].earned) / Σ (BUCKET_WEIGHT[k] × bucket[k].max) × 85 + (early ? 15 : 0))`.
4. Empty buckets (zero items) are returned with `score: 0` but contribute weight 0 to overall (so a paa-only article isn't penalized for empty intent).

### A2 — AI Readability reshape

The Python sidecar's 10-criterion rubric (`python-sidecar/analyzers/ai_readability.py:12-23`) is already CoverageItem-shaped:
- Each criterion: `(key, label, description)` → maps to `id` (`readability-${key}`), `label`, plus description for prompt.
- Each verdict: `met: bool`, `note?: str`, `suggestions?: List[str]` → maps to `covered`, `missing = suggestions`, `needsExpansion = !met && bool(suggestions)`.

Reshape rules:
- `apply_ai_readability` (line 95-136) **untouched** — still applies structure-only suggestions.
- Endpoint `pages/api/articles/ai-readability.ts:42` continues writing `articles.ai_readability_json` for backward compat. Additionally, the deep-analysis pipeline merges the result into the `CoverageSnapshot` as `CoverageItem`s with `type:'readability'`, `category:'quality'`.
- Quality mapping: `met:true → quality:5`; `met:false → quality:0` (rubric is binary today; partial-credit refinement deferred).
- Importance: `'recommended'` for all 10. (Future: mark `early_query` + `search_intent` as `'critical'` to align with intent bucket.)
- `PrePublishPanel.tsx` continues reading from `ai_readability_json` for its UI (no change).

### A3 — IntroductionAnalyzer

```ts
// lib/introductionAnalyzer.ts
export interface IntroVerdict {
  intentConfirmed: boolean;       // → intent-answer-main
  answerStartsEarly: boolean;     // → intent-answer-early AND answersMainQuestionEarly bonus
  audienceMentioned: boolean;     // → intent-who
  goalMentioned: boolean;         // → intent-why
  expectationsSet: boolean;       // → intent-expectations
  detectedMainQuestion?: string;
  notes?: Record<string, string>;
}

export async function analyzeIntroduction(plainText: string, targetKeyword: string, judge: IntroductionJudge): Promise<IntroVerdict>;
export function introCoverageItems(verdict: IntroVerdict): CoverageItem[];
```

- Input: `splitSections(html)[0]` plain-text content (the pre-first-`<h2>` block from `lib/articleSections.ts:62-71`). Falls back to `plainText.slice(0, 2000)` if the article has no H2s.
- Judge: separate from coverage judge (different prompt: 5 fixed yes/no checks against intro only). Same `deepseek-chat` pattern, same versioning + caching rules.
- Output: 5 fixed `CoverageItem`s with `type:'intent'`, `category:'intent'`. `intent-answer-main` and `intent-answer-early` are `critical`; the other three are `recommended`.
- `answersMainQuestionEarly` bonus sourced from `verdict.answerStartsEarly`.
- Replaces literal-JSX intent card at `WriteOptimizePanel.tsx:473-481` and the fake `intentCovered` heuristic at `:272`.

### A4 — UI swap

Three call sites flip from citation-shaped to snapshot-shaped:

```
components/articles/ContentScorePanel.tsx:583   (editor gauge)
components/articles/ContentScorePanel.tsx:525   (WriteOptimizePanel ai prop)
components/articles/ContentScorePanel.tsx:566   (PrePublishPanel aiScore prop)
```

Each becomes:
```tsx
const aiScore = snapshot?.overall ?? (hasAi ? computeAiSearchScore(aiVisibilitySummary) : 0);
```

`components/articles/WriteOptimizePanel.tsx` changes:
- `buildInfoToCover` at `:46-56` is **deleted**.
- Replaced by `coverageItems?: CoverageItem[]` + `buckets?: BucketScore[]` props.
- "Information to cover" card renders `items.filter(i => i.type === 'paa' || i.type === 'fact')`.
- "Upfront Intent Alignment" card renders `items.filter(i => i.type === 'intent')` — per-item `covered` from real data.
- "Critical facts" card (empty placeholder until D's fact source ships) renders `items.filter(i => i.type === 'fact')`.
- Bucket badges ("Intent 95% / Knowledge 60% / Quality 80%") render from `buckets`.
- `intentCovered` at `:272` **deleted**.

`components/articles/PrePublishPanel.tsx`:
- Continues reading `ai_readability_json` for the rubric UI.
- The `aiScore` prop now comes from `snapshot.overall` — the rubric finally counts toward the gauge. The decoupling comment at `:171-173` becomes obsolete and is removed.

### A5 — `article_terms` activation

Today (`lib/ensureArticlesTables.ts:106-118`):
```sql
CREATE TABLE article_terms (
  id SERIAL PRIMARY KEY,
  article_id INT REFERENCES articles(id) ON DELETE CASCADE,
  term TEXT,
  term_type TEXT DEFAULT 'topic',         -- 'keyword'|'topic'|'entity'|'question'
  source TEXT DEFAULT 'serp',
  importance REAL DEFAULT 0,
  target_min INT, target_max INT,
  current_count INT,
  ...
);
```

Writes already happen (`pages/api/articles/deep-analysis.ts:457-465`). Activation:

1. **Read helper** `lib/articleTerms.ts::readArticleTerms(articleId)` returning `ArticleTermRow[]`.
2. **CoverageItem adapter** `lib/articleTerms.ts::articleTermsToCoverageItems(rows)` converting to `type:'entity'` (or `'fact'` if `term_type === 'question'`), `category:'knowledge'`, `importance` thresholded from the `importance` column (`>=0.8 → critical`, `>=0.4 → recommended`, else `optional`).
3. **Read path**: `pages/articles/[id]/index.tsx:611-613` loads `article_terms` rows alongside `score_data`. Prefer `article_terms` when populated; fall back to `score_data.terms`. Pass into `ContentScorePanel`/`WriteOptimizePanel`.
4. **Scoring path**: `lib/contentScore.ts::collectScoreSlots()` (`:302-373`) gains an opt-in `coverageItems` parameter. When present, the `'terms'` slot uses entity items from `coverageItems`. When absent, behavior unchanged.
5. **No backfill.** Re-analyzed articles populate `article_terms` naturally.

## Data flow

```
deep-analysis (or manual refresh) ─┬─ PAA from DataForSEO ─────────────┐
                                    ├─ Intent (IntroductionAnalyzer) ──┤
                                    ├─ Readability (sidecar reshape) ──┼─► CoverageItem[]
                                    └─ Entity (article_terms read) ────┘        │
                                                                                 │
                                            checkCoverage (1 LLM call: paa + intent + future fact/def/etc.)
                                            + Intro LLM call (intent verdicts → answersMainQuestionEarly)
                                            + Readability already graded by sidecar
                                            + Entity graded deterministically from current_count
                                                                                 │
                                                                                 ▼
                                            computeCoverageScores(items, result) → { overall, buckets }
                                                                                 │
                                            wrap into CoverageSnapshot { version, model, promptVersion, createdAt, items, buckets, overall }
                                                                                 │
                                            store in articles.ai_info_to_cover JSONB
                                                                                 │
                                                                                 ▼
load article ─► parseSnapshot(articles.ai_info_to_cover) ─► snapshot state ─► ContentScorePanel + WriteOptimizePanel
                                                                                 │
                                          snapshot.overall ────► ScoreTrio AI gauge
                                          snapshot.buckets ────► bucket badges + UI groupings
                                                                                 │
                                          (C's Recommendation Engine consumes `missing[]` + `reason`; D's planner consumes `confidence` per section)
```

## Storage

New column (`lib/ensureArticlesTables.ts`):
```sql
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_info_to_cover JSONB;
```

Stores: `CoverageSnapshot` (versioned envelope). The `version: 1` field allows future shape migrations without column changes; consumers should check it and fail gracefully on unknown versions.

Existing storage **untouched**:
- `articles.score_data` (TEXT JSON) — still carries `terms` + `paa_questions` for fallback.
- `articles.ai_readability_json` — still carries the rubric for Pre-Publish UI.
- `ai_visibility_runs` / `ai_visibility_citations` — feed the AI Tracker.
- `article_terms` table — activates as a runtime read source.
- `article_keywords` table — out of scope.

## Error handling

- **LLM failure/timeout** → keep previous snapshot. First run → `snapshot.overall` falls back via `?? computeAiSearchScore(aiVisibilitySummary)` at `ContentScorePanel.tsx:583`.
- **No PAA** → snapshot includes intent + readability + entity only; score still computes; PAA bucket has 0 items (`score: 0`, weight: 0).
- **No `article_terms` rows** → entity items omitted; knowledge bucket may be lighter; not a failure.
- **Malformed judge JSON** → `safeJsonParse` (`lib/safeJson.ts`) → treat as "no change", keep prior verdicts.
- **IntroductionAnalyzer LLM failure** → all 5 intent items default to `covered:false, quality:0`; `answersMainQuestionEarly:false`.
- **AI Readability sidecar failure** → readability items omitted from this run; existing `ai_readability_json` (if any) still serves the Pre-Publish UI.
- **Unknown snapshot version on load** → snapshot ignored; gauge falls back; warn-log.

## Testing

- `computeCoverageScores` (pure):
  - empty items → `{overall: 0, buckets: 4 entries × score: 0}`
  - all categories populated, all q5 + early → overall 100; bucket scores 100
  - importance matters: critical covered + optional uncovered → bucket score reflects 3/(3+1) weight
  - quality matters: covered q1 → ⅕ of weight
  - empty bucket contributes 0 weight (paa-only article: intent bucket score 0 but doesn't drag overall)
- `checkCoverage` with stub judge — maps verdict, drops unknown/dup ids, caches by version+hash, empty items → no LLM call.
- `paaCoverageItems` — stable hashed ids, `category:'knowledge'` set.
- `intentItems` — 5 fixed ids, `category:'intent'`, criticals correct.
- `analyzeIntroduction` with stub judge — verdict → `CoverageItem[]` mapping; safe defaults on failure.
- `articleTermsToCoverageItems` — entity mapping, `category:'knowledge'`, importance thresholding, `term_type='question' → type:'fact'`.
- `CoverageSnapshot` serialize/parse round-trip; `version` validation; graceful failure on unknown version.
- `python-sidecar/analyzers/ai_readability.py` reshape returns `coverage_items` field with `category:'quality'` set.
- `collectScoreSlots` — identical SEO score from `article_terms` rows vs. `score_data.terms` legacy on the same input.
- Integration: deep-analysis populates `ai_info_to_cover` snapshot with PAA + intent + readability + entity items; gauge reads `snapshot.overall`; UI cards render real per-item state; bucket badges show the populated buckets (intent / knowledge / quality in A; authority + style are declared but empty until E).
- `tsc --noEmit` clean; `npm run build` succeeds; `graphify update .` runs.

## Files

**Create:**
- `lib/aiCoverage.ts` — model + `CoverageJudge` interface + `checkCoverage` + cache + `deepseekJudge` + `intentItems()` + `hashId()` + `computeCoverageScores` + bucket helpers + `CoverageSnapshot` type + `serializeSnapshot`/`parseSnapshot`.
- `lib/introductionAnalyzer.ts` — `analyzeIntroduction` + `introCoverageItems` + `deepseekIntroJudge`.
- `lib/coverageStore.ts` — `mergeCoverageItems` + `parseSnapshot` (wraps `parseCoverageItems`) + `buildSnapshot(items, judge)` helper.
- `__tests__/lib/aiCoverage.test.ts`, `__tests__/lib/introductionAnalyzer.test.ts`, `__tests__/lib/coverageStore.test.ts`, `__tests__/lib/articleTerms.test.ts`.

**Modify:**
- `lib/ensureArticlesTables.ts` (`:49` area) — add `ai_info_to_cover JSONB` column.
- `lib/seo/keywordData.ts` — add `paaCoverageItems(questions)` builder with stable hashed ids + `category:'knowledge'`.
- `lib/articleTerms.ts` (existing `ArticleTerm` type at `:27-32`) — add `readArticleTerms(articleId)` + `articleTermsToCoverageItems(rows)`.
- `python-sidecar/analyzers/ai_readability.py` (`:91` return shape) — emit additional `coverage_items` field (with `category:'quality'`) alongside existing `score`/`criteria`.
- `pages/api/articles/deep-analysis.ts` (`:467-492` block) — compute all four sources, run judge + intro + readability merge, build `CoverageSnapshot`, persist.
- `pages/api/articles/ai-readability.ts` (`:42` handler) — also merge readability items into snapshot on standalone re-analysis.
- `pages/articles/[id]/index.tsx` (`:614-615` hydration, `:1971` panel prop) — parse snapshot, pass `coverageItems` + `buckets` + `aiCoverageScore` to `ContentScorePanel`.
- `components/articles/ContentScorePanel.tsx` (`:525, 566, 583`) — `snapshot.overall` fallback pattern; pass `coverageItems` + `buckets` through.
- `components/articles/WriteOptimizePanel.tsx` — delete `buildInfoToCover` + `intentCovered`, consume `coverageItems` + `buckets`, render 4 cards (intent / paa+fact / readability / entity) + bucket badges.
- `lib/contentScore.ts` (`collectScoreSlots()` `:302-373`) — accept optional `coverageItems`; entity items override legacy `terms` slot when present.

**Untouched:**
- `lib/aiSearchScore.ts`, `lib/aiVisibilityStore.ts`, `components/articles/AiSearchPanel.tsx` (→ AI Tracker).
- `components/articles/ScoreTrio.tsx:50` (`(seo+ai)/2` blend; only `ai` source flips).
- `python-sidecar/analyzers/ai_readability.py::apply_ai_readability` (apply step unchanged).

## Migration / rollout

- **No big-bang migration.** Column nullable, defaults to NULL.
- **Article hydration**: if `ai_info_to_cover` NULL → snapshot state is null → gauge falls back to `computeAiSearchScore` (existing behavior).
- **First re-analysis** → populates the snapshot → gauge flips to coverage automatically.
- **`article_terms` dual-read**: read helper prefers the table, falls back to `score_data.terms`. No backfill — articles get the new path as they're re-analyzed.
- **Snapshot version**: A ships `version: 1`. Future shape changes bump the version + add a `migrateSnapshot(v1, v2)` helper. Unknown version → ignored snapshot (fallback to legacy gauge).
- **`ai_readability_json` continues to feed Pre-Publish UI**; in parallel, deep-analysis merges readability into the snapshot.

## Out of scope (B, C, D, E and later)

- `buildArticleContext(articleId)` shared builder → **B**.
- `RecommendationEngine` (Coverage snapshot → actionable `Recommendation[]`) + `GuidelineGroup` UI model → **C**.
- `Recommendation.instruction` / `applyPrompt` synthesis (from `label + missing + reason + category`) → **C**.
- `scoreContribution(item, snapshot)` derived helper ("Adding this gives +N") → **C** (where projected-lift is shown).
- `AIProfile` normalized model (Intent / Coverage / Authority / Evidence / Structure / Readability) — richer than A's `buckets` → **C** (buckets = AIProfile v1).
- `OptimizationPlanner` (bucket-aware, confidence-aware; consumes `Recommendation[]`, NOT raw coverage) → **D**.
- `optimization` per-item state (`retryCount`, `alreadyOptimized`, `lastPromptVersion`) — optional JSONB, no migration → **D**.
- Auto-Optimize per-step prompts + per-step token charging → **D**.
- **Outline generator consumes the Plan (Recommendations), NOT raw Coverage** (2nd-review Problem 10) → **D** (needs the planner's ordered recommendations to produce briefs).
- `CoverageGraph` builder + graph traversal helpers + edge population → **E**.
- Fact / Definition / Comparison / Example item sources → **E**.
- **Authority item sources** (citations / statistics / sources / expert-wording detectors) that populate the (A-declared, empty) `authority` bucket → **E**.
- Auto Expand / Internal Link suggestions / hierarchical Outline (graph-dependent) → **E**.
- Style category (`tone`/`grammar`/`voice` types) → **E or later**.
- Standalone `AiReadabilityPanel` component → **deferred polish**.
- `AiSearchPanel` → "AI Tracker" rebrand → **deferred polish**.
- `article_keywords` table absorption → **later, with target-keyword UX**.
- Cross-run coverage memory (`(articleId, normalizedHeading)` mapping) → **D** (planner needs it).
- Snapshot history table (`coverage_snapshots` for rollback / diff) → **later, when UX needs it**.

## Sub-project B preview — Shared context (1 week)

**Goal:** One `buildArticleContext(articleId)` helper consumed by AI Visibility, the Recommendation Engine (C), and the planner (D). Eliminates per-feature context rebuilds (audit §10.6 weakness #4). (The Outline refactor moves to D — Outline consumes the *Plan*, not raw context/coverage, per 2nd-review Problem 10.)

**Shape:**
```ts
interface ArticleContext {
  keyword: string;
  scoreData: ScoreData;
  breakdown: ContentScoreBreakdown;
  coverage: CoverageSnapshot;       // ← from A
  paa: string[];
  terms: ArticleTerm[];
  competitors: CompetitorData[];
  brandKnowledge?: string;
  voiceTone?: string;
  customRules?: string;
  contentType?: string;
}
```

**Touches:** new `lib/articleContext.ts`; refactor `pages/api/articles/ai-visibility.ts` to consume context; expose to client + to C.

**Effort:** 2–3 days.

## Sub-project C preview — Recommendation Engine (NEW, 2nd review) (1–1.5 weeks)

**Goal (the 2nd review's headline change):** turn a raw `CoverageSnapshot` into a list of **actionable, user-facing recommendations** — the layer between Coverage and the Planner. `Coverage (A) → RecommendationEngine (C) → Planner (D)`. Every consumer (Auto-Optimize, Outline, AI Search Guidelines UI, future features) reads ONE shared recommendation source instead of re-interpreting coverage on its own.

**Why it's a distinct layer, not part of A:** it's a transformation *layer*, not a storage-shape change. A's job is to capture the raw signal (`covered/quality/missing/reason/confidence`) cheaply on the judge call. C's job is to phrase it as an instruction. Keeping them separate means the stored coverage shape is stable (A) while the recommendation phrasing/prompts can evolve (C) without re-analysis.

**Shape:**
```ts
interface Recommendation {
  id: string;
  coverageItemId: string;         // provenance back to the CoverageItem
  group: GuidelineGroupKey;       // 'intent' | 'knowledge' | 'authority' | 'quality' | 'structure'
  title: string;                  // "Add a comparison of wooden vs plastic toys"
  instruction: string;            // the applyPrompt Auto-Optimize consumes directly
  importance: Importance;
  status: 'open' | 'applied' | 'dismissed';
  projectedLift?: number;         // from scoreContribution(item, snapshot)
  sectionId?: string;
}

interface GuidelineGroup {         // the UI grouping Surfer shows: "AI Search Guidelines"
  key: GuidelineGroupKey;
  label: string;                  // 'Intent Alignment' | 'Knowledge Coverage' | 'Authority' | ...
  score: number;                  // from the matching bucket
  recommendations: Recommendation[];
}
```

**Also here:** `scoreContribution(item, snapshot)` derived helper (marginal points an item contributes to its bucket → overall), used for `projectedLift`. `AIProfile` = the `GuidelineGroup[]` view (buckets promoted to named groups). No LLM re-call — C reads `reason`/`missing` captured in A and templates the instruction.

**Touches:** new `lib/recommendationEngine.ts`; `WriteOptimizePanel` renders `GuidelineGroup[]` (replaces A's raw per-item cards with grouped, actionable recommendations).

**Effort:** 3–5 days.

## Sub-project D preview — OptimizationPlanner + Outline (2 weeks)

**Goal:** Decision layer between **recommendations** (from C, not raw coverage) and the Auto-Optimize LLM. **Reasons over bucket scores + per-item confidence**, not a single AI score. Picks the subset that will actually move the score, routes per-section, supports cost-aware planning. **Outline generation also lives here** — it consumes the ordered Plan/recommendations to produce Surfer-style briefs (2nd-review Problem 10: Outline ← Planner, not Coverage/SERP).

**Plug-in seam:** `pages/api/articles/optimize-sections.ts:96-106`, between `splitSections()` and the section loop.

**Output:**
```ts
type PlanStep = {
  sectionId: string;
  systemPrompt: string;           // PER-SECTION, built from Recommendation.instruction
  focus: 'definitions' | 'examples' | 'facts' | 'entities' | 'authority' | 'intent' | 'readability' | 'expand' | 'skip';
  budgetTokens: number;
  recommendations: Recommendation[];   // ← from C, already actionable
};
type Plan = { steps: PlanStep[]; estimatedTokens: number; rationale: string };
```

**Decision rules (bucket-aware):**
- Iterate buckets weakest-first by `bucket.score`. Top-weak bucket drives `focus` token.
- Within the weak bucket: skip recommendations whose item is `covered && quality >= 4`; prioritize `!covered` over `needsExpansion`; tie-break by `importance` then `projectedLift`.
- Per-item `confidence < 0.5` → flag for re-judge with a stronger model; don't optimize until re-judged.
- Section-assignment via heading↔label overlap.
- Budget-aware top-N when `getOrgUsage5h().used` near cap.

**Touches:** new `lib/optimizationPlanner.ts`; refactor `pages/api/articles/generate-outline.ts:14-118` to consume the Plan; `optimize-sections.ts:96-106` (insert plan), `:101` (per-step prompt builder), `:150-152` (per-step token accumulator).

**Effort:** 4–6 days. Feature-flagged + A/B against current uniform-prompt behavior.

## Sub-project E preview — CoverageGraph + extended sources (2–3 weeks)

**Goal:** Populate `parentId`/`relatedIds`/`depth` on `CoverageItem`s. Add Fact/Definition/Comparison/Example **and Authority** item sources (the latter fill the A-declared, empty `authority` bucket). Enable graph-dependent features.

**Components:**
- `lib/coverageGraph.ts` — graph builder (post-judge pass; takes `CoverageItem[]` and produces `(parentId, relatedIds, depth)` annotations).
- Graph-aware judge prompt extension (asks the LLM for relations alongside coverage).
- New sidecar analyzers: fact extraction, definition extraction, comparison detection, **authority detection** (citations / statistics / sources / expert wording).
- Graph traversal helpers: `findChildren`, `findRelated`, `walkHierarchy`.
- Graph-dependent features: Auto Expand, Internal Links, hierarchical Outline.
- Auto Expand (suggest sub-topics from uncovered children).
- Internal Link suggestions (cross-article via `relatedIds`).
- Hierarchical outline rendering (depth-aware indentation).

**Effort:** 2–3 weeks. Builds on A's snapshot — no migration needed.

## Review response (v3) — 2nd tech-lead review

The 2nd review's central thesis — insert a **Recommendation Engine** between Coverage and the Planner so every consumer reads one shared source of *actionable recommendations* instead of re-interpreting raw coverage — is **accepted** and restructures the roadmap (`Coverage A → Context B → Recommendation Engine C → Planner D → Optimize`). Individual points were triaged by one rule: **fix the stored shape / score taxonomy now (expensive to change later); defer layers and optional-JSONB fields (cheap to add later).**

| # | Point | Decision | Where |
|---|---|---|---|
| 2 | Recommendation Engine layer | ✅ Accept | New **Sub-project C** |
| 4 | `reason` (WHY uncovered) | ✅ Accept — **into A** | Rides A's existing judge call; deferring wastes a future re-judge pass. Added to `CoverageVerdict` + `CoverageItem` + judge prompt. |
| 9 | `authority` bucket | ✅ Accept — **into A** | Locks the 5-bucket taxonomy + score denominator now. Declared in `CoverageCategory`; empty in A; sources in E. |
| 3 | `GuidelineGroup` (grouped AI Search Guidelines UI) | ✅ Accept | **C** — `GuidelineGroup` model; buckets promote to named groups. |
| 6 | `AIProfile` (Intent/Coverage/Authority/Evidence/…) | ✅ Accept | **C** — A's `buckets` = AIProfile v1; the richer named view is the `GuidelineGroup[]`. |
| 7 | `scoreContribution` explainability ("+N") | ✅ Accept | **C** — pure derived helper feeding `Recommendation.projectedLift`; no storage. |
| 10 | Outline ← Planner, not Coverage/SERP | ✅ Accept | **D** — Outline moved out of B into D, consumes the Plan. |
| 1 | Rename `CoverageItem` → `Guideline` | ❌ Push back | Conflates coverage-observation with recommendation — the split the review's own conclusion wants. `CoverageItem` = analysis unit; `Recommendation` = action unit (C). |
| 5 | `instruction`/`applyPrompt` on the item | ❌ Push back | A `Recommendation` property, synthesized in C from `label + missing + reason + category`. Coverage must not decide "how to fix". |
| 8 | `optimization` metadata (retryCount, …) | ⚠️ Defer to D | Optional JSONB → adding later is not a migration; A never populates it. YAGNI. (Contrast `reason`, which A populates for free.) |

**Net effect on A (this sub-project):** two additive fields (`reason` on verdict + item) and one enum entry (`authority` category + its weight/label) — everything else is roadmap. A's stored `CoverageSnapshot` shape is now final through C/D/E.

### Addendum — 3rd review (v3.1)

The 3rd review approved the design and raised one actionable risk: `computeCoverageScores` is the single load-bearing function (feeds AI gauge + recommendation priority + planner + `projectedLift` + Auto-Optimize), so a monolithic implementation would make weight/algorithm changes costly. **Accepted:** it decomposes into independently-exported, independently-tested pure helpers — `computeBucketScore`, `blendBuckets`, `earlyAnswerBonus` — with weights as module constants; `computeCoverageScores` only orchestrates. **Held the YAGNI line:** no runtime weight-injection / config object in A (that's D's A/B concern); the helper split already makes injection a one-signature change later, not a rewrite. No shape change, no new task — refactor lands inside Task 1.
