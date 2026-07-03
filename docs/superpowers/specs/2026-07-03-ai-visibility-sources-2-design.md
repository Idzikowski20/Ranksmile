# AI Visibility — Sources 2.0 (SurferSEO parity) design

**Date:** 2026-07-03
**Branch:** `feature/ai-visibility-sources` (stacked on PR #21 `feature/ai-visibility-compare-overview`, which shipped the basic Sources page: stats, fill-bar table, group-by-domain, detail modal).
**Status:** approved (brainstorming), ready for planning.

## Problem

The shipped Sources page shows only what the scan already stores (url / domain / timesShown / models). SurferSEO's Sources shows, per source: whether **your brand is mentioned**, which **brands** appear (favicon stack), a **Mention Gap** vs competitors, and a detail modal with a **Times-shown trend** and a **brands table with sentiment**. It also lets you **filter** the whole page by prompts and models.

We collect the AI **answer text** for every `(scan, prompt, model)` (column `ai_vis_results.answer`) but never analyse it. That answer text is the source of truth for brand mentions and sentiment — we do NOT scrape the cited pages.

**Goal:** reach SurferSEO parity by extracting brands + sentiment from the **already-stored AI answers** (one cheap LLM pass), then aggregating that per source, and making the whole page filterable by prompts/models.

## Core decisions (from brainstorming)

1. **Data source = AI answers, not page scraping.** Extract brands/sentiment from `ai_vis_results.answer`. Cost ~$0.05–0.15/scan (deepseek-chat), works retroactively, no bot-blocking. Semantics: "brands the AI names in answers that cite this source", surfaced honestly in tooltips.
2. **Timing = after each scan** (a final chunked pipeline step), plus a one-time **backfill** of the existing scan so data appears without waiting for the next scan.
3. **Storage = `brands` JSONB column on `ai_vis_results`** (mirrors `citations`); aggregations are pure functions in `lib/aiVisibilityMetrics.ts`. No new tables.
4. **Filters are real.** Prompt/model selection re-computes stats, Mention Gap, and the table via new query params on the data endpoint. Prompt picker = multiselect with checkboxes, "Select all", grouped by topic.
5. **Price column is visual-only (always "N/A").** Offer/sponsorship pricing is a different data source — out of scope.

**Depends on:** PR #21 merged (or built on its branch). The basic Sources page, `SourcesTable`, `SourceDetailModal`, `HoverTooltip`, `PromptPicker`, `MetricTrendChart` already exist.

**Out of scope (YAGNI):** scraping source pages ("mentioned *in the source*" literal); real Price data; drag-to-reorder Mention Gap cards (SurferSEO has dnd — we render a static scroll row); brand→canonical-logo mapping beyond `google.com/s2/favicons` + a gray fallback.

---

## Types (metrics layer, `lib/aiVisibilityMetrics.ts`)

```ts
export type BrandMention = {
   brand: string;                 // canonical display name, e.g. "Wix"
   domain: string;                // best-effort domain for favicon ('' if unknown → gray fallback)
   sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
   pos: number;                   // 1-based order of first appearance in the answer
   quotes: string[];              // 0–3 short verbatim snippets
};

// ai_vis_results row, extended.
export type ResultRow = {
   promptId: number; model: string; ownCited: boolean; ownPosition: number | null;
   citations: LlmCitation[]; topic: string; text: string;
   brands: BrandMention[];        // [] when not yet analysed
};

export type SourceBrand = { brand: string; domain: string };   // for the favicon stack
export type SourceRow = {
   url: string; domain: string; timesShown: number; models: string[];
   mentioned: boolean;            // own brand appears in ≥1 answer citing this url
   brands: SourceBrand[];         // distinct brands across those answers, ordered by frequency
};

export type GapCard = { brand: string; gap: number; shared: number; you: number };
export type SourceDetailBrand = { pos: number; brand: string; sentiment: BrandMention['sentiment']; quotes: string[] };
```

## Architecture

### 1. Extraction — `lib/aiVisibilityBrands.ts` (new) + scan hook

- **`buildBrandPrompt(answerText, ownBrand): string`** — pure; asks deepseek-chat for a JSON array of `{brand, domain, sentiment, quotes}` in order of appearance. `pos` is assigned from array index in code (not trusted from the model).
- **`parseBrandResponse(raw: unknown): BrandMention[]`** — pure; tolerant parse (string or already-parsed), coerces fields, clamps `quotes` to 3, drops entries without a `brand`. Exported for unit tests.
- **`extractBrandsForRow(answer, ownBrand)`** — calls deepseek-chat (model `deepseek-chat`, per the [[deepseek-chat-not-reasoning-model]] rule), `response_format` JSON, low max-tokens; returns `BrandMention[]`. On any failure returns `null` (row stays `NULL`, retried next tick).
- **`runBrandChunk(scanId, ownBrand, limit=20): Promise<{done:number, remaining:number}>`** — selects up to `limit` rows where `brands IS NULL AND error IS NULL AND answer IS NOT NULL`, extracts, and `UPDATE ai_vis_results SET brands = ?`. Idempotent, per-row try/catch. Mirrors `runScanChunk`.
- **Scan integration:** after a scan's result rows are all written (`status → completed`), the scan runner loops `runBrandChunk` until `remaining === 0` (same chunked/resumable shape as the scan itself, so a Vercel timeout just resumes). Brand extraction failure never fails the scan — Sources degrades to "no brands yet".
- **Backfill:** `pages/api/ai-visibility/internal/analyze-brands.ts` (internal-token guarded, advisory-locked like `due-scans`) runs `runBrandChunk` for the latest completed scan of every config that still has `brands IS NULL` rows. Invoked once by the sidecar scheduler tick (add a second call after `due-scans`) so existing scans get analysed without a re-scan.

### 2. Aggregations — pure, `lib/aiVisibilityMetrics.ts`

All operate on `ResultRow[]` already filtered by prompt/model at the query layer.

- **`aggregateSources(rows, ownBrand)`** — extend the existing function to also compute per url: `mentioned` (ownBrand present in any answer for a row citing that url) and `brands` (distinct `{brand, domain}` across those answers, ordered by frequency). Domain for a brand: prefer the brand's own `domain` field; else match against `citations` by fuzzy name; else `''` (gray fallback).
- **`mentionGap(rows, brand, ownBrand): GapCard`** — over **answers** (one per `(promptId, model)` row): `gap` = rows where `brand` appears but `ownBrand` doesn't; `shared` = rows where both appear; `you` = rows where only `ownBrand` appears. (SurferSEO labels the third by your brand name.)
- **`gapBrandCandidates(rows, ownBrand): string[]`** — distinct competitor brands by frequency, for the card picker (default top-4).
- **`brandsForSource(rows, url): SourceDetailBrand[]`** — for one url: union of brand mentions across answers citing it, `pos` = min appearance order, `sentiment` = dominant (ties → 'mixed'), `quotes` = first 3 distinct. Sorted by `pos`.
- **`sourceTimesShownHistory(perScanRows): Array<{finishedAt, timesShown}>`** — per completed scan, count citations of the url. (Computed in the endpoint from existing scans; the metrics helper is the pure counter.)

### 3. Endpoints (`pages/api/ai-visibility/[slug]/data.ts` + new `source-detail`)

- **`view=sources`** gains optional `&prompts=<id,id>&models=<m,m>` — filter `loadScanResultRows` output before aggregation (or push into SQL `WHERE`). Response per source now includes `mentioned` and `brands` (top 3 + `moreCount`). Plus top-level `gapCards` (for the current `&gapBrands=` selection, default top-4) and `gapCandidates` (all, for the picker). Prompt/model filters apply to `gapCards` and the stats too.
- **New `view=source-detail&url=<url>`** → `{ history: Array<{finishedAt, timesShown}>, brands: SourceDetailBrand[], brandCount }`. `history` iterates the config's completed scans (bounded by `HISTORY_LIMIT`), counting citations of that url per scan; `brands` uses the **latest** scan's rows. One request, opened lazily by the modal.

### 4. Frontend

- **`SourcesTable` (edit)** — add columns **Mentioned** (Yes/No), **Brands** (favicon stack, `+N`, gray swirl fallback for unknown-domain brands), **Price** (static "N/A"). Header labels get dotted-underline + `HoverTooltip` (copy per column; e.g. Times shown → "Number of times URLs appear in LLM responses"). Row hover: light-purple background + purple gradient fill + an "Open details" icon fading in on the right.
- **`SourceStatCards` tooltips (edit)** — Domains/URLs/References hints: "Unique domains found in LLM responses", "Unique URLs found in LLM responses", "Number of times URLs appear in LLM responses".
- **`MentionGapCards` (new)** — horizontal scroll of 300px cards: brand dropdown (swap), X (remove), trailing "+" (add). Body: `Gap / Shared / {ownBrand}` grid + a hand-rolled **bubble SVG** (competitor circle brand-orange, yours brand-violet, intersection red; radius ∝ √mentions, capped). Selection persisted in `localStorage` per slug; default = `gapCandidates` top-4.
- **`SourceDetailModal` (edit)** — add the Times-shown **trend chart** (reuse `MetricTrendChart` with a single series) fed by `source-detail.history`, and a **brands table** (Pos. / Brand / Sentiment badge — green/gray/yellow/red — with a chevron that expands `quotes`). Keep the existing ↑/↓ + external + close header.
- **`PromptPicker` (edit) → multiselect** — checkboxes, "Select all", options **grouped by topic** (topic header row + indented prompts), search filters within groups. Emits selected prompt ids. "All models" dropdown (already has icons) becomes a real multiselect too. Selection state lives in `sources.tsx`, threaded to the toolbar via the shell (same pattern as Compare), and passed to `useAiVisData` as query params so the whole page re-filters.

### 5. Data flow

```
scan completes ─► runBrandChunk* (deepseek) ─► ai_vis_results.brands JSONB
backfill (sidecar tick) ─► runBrandChunk* over latest scan of each config

Sources page: filters {prompts, models}
  └─► GET data?view=sources&prompts&models&gapBrands
        └─ loadScanResultRows → filter → aggregateSources / mentionGap / gapBrandCandidates
  └─► row click → GET data?view=source-detail&url  (history + brandsForSource)
```

## Components & responsibilities

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `lib/aiVisibilityBrands.ts` (new) | prompt build, parse, per-row + chunked extraction | `lib/ai/deepseek`, `db/query` |
| `internal/analyze-brands.ts` (new) | advisory-locked backfill over latest scans | `runBrandChunk` |
| `aiVisibilityMetrics.ts` (edit) | `BrandMention`/`SourceBrand`; `aggregateSources+brands`; `mentionGap`; `gapBrandCandidates`; `brandsForSource` | — |
| `aiVisibilityRead.ts` (edit) | map `brands` jsonb (both shapes) onto `ResultRow` | `parseBrands` |
| `data.ts` (edit) | sources filter params + `mentioned`/`brands`/`gapCards`; `view=source-detail` | metrics layer |
| `SourcesTable` (edit) | Mentioned/Brands/Price columns, header tooltips, hover polish | favicon, `HoverTooltip` |
| `MentionGapCards` (new) | per-brand gap bubble cards + add/remove/swap | `gapCards`, localStorage |
| `SourceDetailModal` (edit) | trend chart + brands/sentiment table | `MetricTrendChart`, `source-detail` |
| `PromptPicker` (edit) | multiselect grouped by topic + Select all | prompts (topic+text) |
| `sources.tsx` (edit) | filter state, wire Mention Gap, pass filters to shell/toolbar + query | above |

## Error handling

- Brand extraction failure per row → `brands` stays `NULL`; UI treats `NULL`/`[]` as "no brands yet" (empty stack, Mentioned "—"). Chunk retries on the next tick/scan.
- Deepseek returns non-JSON → `parseBrandResponse` yields `[]`; the row is still marked analysed only on success (NULL retained on failure to allow retry).
- `view=source-detail` for an unknown/filtered-out url → `{history:[], brands:[], brandCount:0}` (modal shows the URL + "No brand data yet").
- 0 competitors / all-zero gap → Mention Gap shows an empty hint; picker still lists candidates.
- Filters that exclude everything → stats 0, empty table with "No sources match these filters".

## Testing

- `parseBrandResponse`: string vs array input; missing brand dropped; quotes clamped to 3; sentiment defaulted to 'neutral'.
- `buildBrandPrompt`: contains the answer text + own brand; asks for JSON.
- `aggregateSources` (+brands): `mentioned` true only when own brand present in a citing answer; brand stack ordered by frequency; unknown-domain brand → `domain:''`.
- `mentionGap`: gap/shared/you counted over answers; competitor-only vs both vs you-only fixtures.
- `brandsForSource`: pos = first appearance; dominant sentiment; ties → 'mixed'; quotes deduped/capped.
- `sourceTimesShownHistory`: per-scan counts; url absent in a scan → 0.
- Endpoint shape: `view=sources` with `prompts`/`models` filters changes counts; `view=source-detail` returns history+brands.

## Phasing (plan will expand)

- **A — Extraction + backfill:** `brands` column, `aiVisibilityBrands.ts` (prompt/parse/chunk, tests), scan-runner hook, `internal/analyze-brands.ts` + sidecar tick.
- **B — Read + aggregations + endpoints:** `parseBrands`, `ResultRow.brands`, `aggregateSources+brands`, `mentionGap`, `gapBrandCandidates`, `brandsForSource`; `data.ts` filters + `mentioned`/`brands`/`gapCards`; `view=source-detail`.
- **C — Table parity:** Mentioned/Brands/Price columns, header + stat-card tooltips, row hover + open-details icon.
- **D — Mention Gap:** `MentionGapCards` with bubble SVG, add/remove/swap, localStorage.
- **E — Modal:** trend chart + brands/sentiment table with expandable quotes.
- **F — Filters:** `PromptPicker` multiselect (grouped + Select all), real prompt/model filtering wired page → shell → toolbar → query.
