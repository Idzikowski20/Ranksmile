# AI Search Score — Knowledge-Coverage Model (Sub-project #1) — Design

**Date:** 2026-06-30
**Status:** Approved (brainstorming) + plan-review revisions incorporated — ready for writing-plans

## Goal

Make the editor's **AI Search Score** measure **topic coverage**, not just question-answering: how
much of the article's `CoverageItem[]` (People Also Ask + search intents, extensible to Facts /
Entities / Comparisons / Definitions) is actually covered — graded by an LLM judge for *quality*,
not mere mention — plus a bonus for answering the main question early. This replaces the
citation-based score *in the editor gauge*; the citation analysis becomes a separate "AI Tracker".
Mirrors SurferSEO's direction (Facts, fanout/topic coverage, Dec 2025).

**Sub-project #1 of 3** (foundation):
- **#2 Smart Auto-Optimize** — rework `optimize-sections.ts`: when SEO entities are covered, stop
  adding paragraphs; instead fill the coverage gaps surfaced by each item's `missing[]`; short H1;
  1–4 paragraphs/section. Depends on #1.
- **#3 UI** — coverage panel, live AI delta, Undo-after-accept, edited-section look. Depends on #1.
Each gets its own spec → plan. This spec covers **only #1**.

## Decisions (brainstorming + plan-review)

- **Topic coverage, not question coverage.** The model is a general `CoverageItem` with an extensible
  `kind` (`paa | intent | fact | entity | comparison | definition`), so Facts/Entities slot in later
  with no rework. #1 ships `paa` + `intent`; the rest are valid kinds the model already accepts.
- **LLM judge, quality-aware.** One structured-JSON call returns, per item:
  `{ covered, quality: 0–5, confidence: 0–1, missing: string[], sectionId? }`. *Mention ≠ good
  explanation*: a bare "React uses JSX" is `covered:true, quality:1`. `missing[]` is the direct input
  to #2's Auto-Optimize.
- **Score replaces citations in the editor.** `computeAiSearchScore(aiVisibilitySummary)` +
  ai-visibility stay untouched as the separate "AI Tracker".
- **Compute in Node** (alongside `optimize-sections.ts`, deepseek-chat), event-driven — load /
  deep-analysis / after each Auto-Optimize section / manual refresh. Not per-keystroke (LLM cost).
  SEO stays keystroke-live.

## Product direction (Surfer Dec-2025 video) — so #1 doesn't preclude #2/#3

- **One Content Score, split on the same bar** — SEO (left) + AI (right), not two scores. Already
  shipped (ScoreTrio dual-arc SEO|overall|AI). The user optimizes *content*, not "SEO then AI".
- **AI Search Guidelines are a peer of SEO Guidelines** — the panel reads `Content Score → SEO
  Guidelines + AI Search Guidelines` (two equal lists), NOT "SEO / AI / Facts / Tracker" as separate
  tabs. (→ #3 UI; #1 just produces the AI list as `CoverageItem[]` with `missing[]`.)
- **Auto-Optimize improves BOTH in one pass** — a single prompt: *improve SEO terms + fill AI
  coverage gaps (from `missing[]`) + don't over-optimize / don't pad paragraphs*. One engine, not
  two. (→ #2)
- **AI Search = citation *probability*, not citations** — the LLM judges whether the article is
  citable (= our Coverage Judge), not whether a model actually cited it (that's the AI Tracker).
- **Guidelines = "information to add"** — knowledge gaps phrased as tasks ("Explain when to use
  Hooks", "Compare X vs Y"), not bare keywords/entities. `CoverageItem.label` is a knowledge item.

#1 builds the data + score that the above UX/auto-optimize consume.

## Architecture

### CoverageItem model
A **knowledge item** (an "information to add"), not a keyword. The model is intentionally a small
knowledge-graph so Facts/Definitions/Comparisons/etc. slot in later with no rework.
```ts
type CoverageType =
  | 'paa' | 'intent' | 'fact' | 'definition' | 'comparison'
  | 'example' | 'warning' | 'entity' | 'process' | 'statistic' | 'expectation';
type Importance = 'critical' | 'recommended' | 'optional';   // → weight 3 / 2 / 1 in the score

interface CoverageItem {
  id: string;            // STABLE: `${type}-${hash(label)}` — never an array index
  label: string;         // a KNOWLEDGE item ("Explain when to use Hooks"), PAA question, fact …
  type: CoverageType;
  importance: Importance;
  covered: boolean;
  quality: number;       // 0–5 (judged; bare mention = 1, thorough = 5)
  needsExpansion?: boolean;
  missing?: string[];    // specifics still absent — feeds #2's Auto-Optimize prompt
  sectionId?: string;    // STABLE section id (not H2 text)
}
```
- **PAA items** (`type:'paa'`, `importance:'recommended'`): from `lib/seo/keywordData.ts`
  (DataForSEO). `id = paa-${hash(question)}`.
- **Intent items** (`type:'intent'`, 4 fixed): `answer-main-question` (critical), `set-expectations`,
  `who-its-for`, `why-it-matters` (recommended).
- **Other types** (`fact | definition | comparison | example | warning | entity | process |
  statistic | expectation`) are valid kinds the model already accepts; **populating them is a later
  sub-project** — #1 ships PAA + intents only.
- Persisted on the article as JSON column `ai_info_to_cover` (`lib/ensureArticlesTables.ts`).

### Coverage checker — `lib/aiCoverage.ts` (new)
- `checkCoverage(plainText, items, judge): Promise<CoverageResult>` where
  `CoverageResult = { items: CoverageVerdict[]; answersMainQuestionEarly: boolean }` and
  `CoverageVerdict = { id; covered; quality; confidence; needsExpansion?; missing?; sectionId? }`.
- The **judge is injected** as `{ version: string; run(text, items): Promise<CoverageResult> }` so the
  scoring/mapping is unit-testable with a stub. Default = `deepseekJudge` (deepseek-chat, `temperature:0`,
  `seed` if supported, `response_format: json_object`).
- **Cache** keyed by `judge.version | itemIds | hash(text)` — `judge.version` encodes
  `promptVersion|model|temperature`, so changing the prompt/model invalidates the cache.
- Verdicts are filtered to known ids + de-duplicated.

### Score — `computeCoverageScore(items, result)` (pure)
```ts
// weight(importance) × quality, normalized to 85 pts; + 15 pts for answering the main question early.
weight = { critical: 3, recommended: 2, optional: 1 }[item.importance];
const totalW = Σ items.weight (min 1);
const earned  = Σ over covered items of (weight × clamp(quality,0,5)/5);
return round( (earned/totalW) × 85  +  (early ? 15 : 0) );
```
`importance` subsumes Surfer's "facts/critical buckets" — a critical fact just weighs 3×; no separate
score categories needed. Quality means *mention ≠ explanation*: a covered-but-shallow item earns
little (quality 1 → 0.2× its weight).

### Wiring
- deep-analysis builds `CoverageItem[]` (PAA + intents), runs `checkCoverage`, stores the graded
  items + score, and the editor AI gauge reads the stored coverage score.
- `lib/aiSearchScore.ts` untouched (→ AI Tracker). Editor stops feeding the AI gauge from it.

## Data flow
```
load/deep-analysis ─► PAA (keywordData) + intents ─► CoverageItem[]
                              │ checkCoverage (1 LLM call, quality+missing)
                              ▼
            store ai_info_to_cover ─► editor AI gauge = computeCoverageScore()
edit / AO-section-done ─► (event) re-check ─► gauge updates (live delta, #2);  missing[] → #2 prompt
```

## Error handling
- LLM failure/timeout → keep previous result (first run → all `covered:false, quality:0`); never block
  the editor.
- No PAA → items = the 4 intents only; score still computes.
- Malformed JSON → `safeJsonParse` (existing) → treat as "no change".

## Testing
- `computeCoverageScore` — pure: 0 items, all covered q5, all covered q1 (quality matters), weighted
  mix, early on/off.
- `checkCoverage` with a **stub judge** — maps verdict, drops unknown/dup ids, caches by version+hash,
  empty items → no call.
- `paaCoverageItems` — stable hashed ids (reordered input → same ids).
- `ai_info_to_cover` column round-trips.
- `tsc --noEmit` clean; build succeeds.

## Files
- **Create:** `lib/aiCoverage.ts`, `__tests__/lib/aiCoverage.test.ts`.
- **Modify:** `lib/ensureArticlesTables.ts` (`ai_info_to_cover` JSONB) · `lib/seo/keywordData.ts`
  (`paaCoverageItems`) · `pages/api/articles/deep-analysis.ts` (compute+store) ·
  `pages/articles/[id]/index.tsx` + `components/articles/ContentScorePanel.tsx` (AI gauge ← coverage score).
- **Untouched:** `lib/aiSearchScore.ts`.

## Out of scope (#2/#3)
Smart Auto-Optimize (consuming `missing[]`), the coverage UI panel, live-delta gauge wiring,
Undo-after-accept, edited-section appearance, and adding `fact`/`entity` item sources (the model
already accepts those kinds — populating them is a later sub-project).
