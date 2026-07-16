# Phase A: AI Search Coverage Harvest

**Date:** 2026-07-16  
**Status:** Approved (approach 2 — harvest stage; architecture OK)  
**Sequence:** B (done) → **A** → C (Surfy highlight)

## Goals

Populate Write & Optimize **AI Search → Info to cover** with:

- **~6–12 semantic topics**, each with **~3–6 questions** (soft floor 6×3, ceil 12×6)
- Questions from **Google AI Overview / AI Mode, ChatGPT, Gemini, Perplexity, Reddit**
- Source attribution as **icons** (existing UI — no text badges)
- Topic titles: **hybrid** — competitor outline H2/H3 as skeleton; LLM fills gaps when outline is thin
- No Claude / Facebook in v1
- Template prompts (`Co to jest {keyword}?`) only as **last resort** when harvest returns below soft floor

## Non-goals

- Surfy live highlight (Phase C)
- Fixing Chromium `render-page` / Wikipedia scrape (helps SERP corpus, separate)
- Changing Content Score gauge formulas beyond feeding richer coverage items

## Current gaps

1. `fetchLlmCoverageQuestions` already targets DFS LLM engines, but deep-analysis often falls through to **sidecar template prompts** when PAA is empty / harvest under-delivers.
2. `buildInfoToCoverTopics` groups by outline overlap only — no LLM topic fill when outlines fail (PDF/social SERP).
3. UI already supports `llmSources` → icons; data pipeline under-fills `llmSources`.

## Architecture

```
deep-analysis (Node)
  → scrape_serp (PAA, related, competitors)
  → competitor outlines cache (H2/H3)
  → harvestAiCoverage({ keyword, country, language, paa, related, outlineTitles })
       1. fetchLlmCoverageQuestions (cached DFS fan-out)
       2. merge PAA + Reddit-tagged rows
       3. clusterIntoTopics(outlineTitles, questions)  // hybrid
       4. enforceBudget({ minTopics: 6, minPerTopic: 3, maxTopics: 12, maxPerTopic: 6 })
  → buildGradedCoverageSnapshot({ paaQuestions, llmQuestions, … })
  → persist ai_info_to_cover
  → UI: buildInfoToCoverTopics (prefer harvested topic titles when present)
```

New module: `lib/harvestAiCoverage.ts` (orchestration + clustering + budget).  
Reuse: `lib/llmCoverageQuestions.ts`, `lib/curateCoverageItems.ts`, `lib/infoToCoverTopics.ts`, `lib/buildCoverageSnapshot.ts`.

## Components

### 1. `harvestAiCoverage`

**Input:** keyword, country, languageCode, paaQuestions[], relatedSearches[], outlineTitles[], optional competitorTitles[]

**Output:**
```ts
{
  topics: Array<{ id: string; title: string; questions: LlmCoverageQuestion[] }>;
  flatQuestions: LlmCoverageQuestion[];  // for buildGradedCoverageSnapshot
  stats: { bySource: Record<LlmCoverageSource, number>; topicCount: number; questionCount: number };
}
```

### 2. Clustering (hybrid)

1. Seed topic buckets from outline H2/H3 (deduped, length 8–80), max 12.
2. Assign each question to best outline topic via token overlap (existing `assignTopic` logic).
3. If topic count &lt; 6 **or** many questions land in `"Information to cover"`:
   - Call DeepSeek (or cheap DFS) once: input = unassigned questions + keyword → return 2–6 topic titles + question→topic map.
4. Prefer outline titles over LLM titles when overlap is strong.

### 3. Budget

| | Min | Max |
|--|-----|-----|
| Topics | 6 | 12 |
| Questions / topic | 3 | 6 |

- If below min topics after clustering: LLM invents topic titles from leftover questions (not keyword templates).
- If below min questions/topic: leave thin topics only if total questions &lt; 18; else merge thin topics.
- Cap: drop lowest-score questions first (`scoreCitationPrompt` / `scorePaaQuestion`).

### 4. Deep-analysis wiring

Replace ad-hoc fallback block in `deep-analysis.ts` coverage section with:

```ts
const harvested = await harvestAiCoverage({ … });
console.log(`[coverage] harvest: ${harvested.stats.topicCount} topics, ${harvested.stats.questionCount} qs`, harvested.stats.bySource);
// pass harvested.flatQuestions as llmQuestions; optional topic metadata in snapshot extension
```

Template fallback **only if** `harvested.questionCount < 6`.

### 5. Snapshot / UI

- Persist questions as coverage items with `llmSources` (icons unchanged).
- Optionally store `topics: [{ title, itemIds }]` on snapshot (new optional field) so `buildInfoToCoverTopics` uses harvested titles instead of re-clustering weakly.
- If snapshot has no topic metadata, keep current outline-based grouping (backward compatible).

### 6. Errors & cost

- Per-engine failures non-fatal (already in `collectFanOutFromModels`).
- Respect org 5h token budget (existing skip).
- Cache `fetchLlmCoverageQuestions` unchanged (TTL.SERP).
- Log harvest stats for debugging empty panels.

## Testing

- Unit: `clusterIntoTopics` assigns PL questions to outline titles; LLM path mocked when &lt; 6 topics.
- Unit: `enforceBudget` respects floor/ceil.
- Unit: harvest skips templates when flatQuestions ≥ 6.
- Integration-ish: deep-analysis coverage path uses harvest output (mock DFS).

## Success criteria

After deep analysis on a PL keyword with DFS configured:

1. Info to cover shows **≥ 6** topic accordions (when signal exists).
2. Each topic typically **3–6** questions; total toward **~30–50** when engines respond.
3. Questions show **icons** for GPT / Gemini / Perplexity / AI Overview / Reddit — not only templates.
4. No `wojna hybry`-style template spam when harvest succeeds.

## Out of scope reminders

- Phase C: Surfy orange highlight + Sentry buttons  
- Claude / Facebook engines  
