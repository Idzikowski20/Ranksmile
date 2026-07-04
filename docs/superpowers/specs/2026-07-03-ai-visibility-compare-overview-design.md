# AI Visibility — SurferSEO-style Compare Overview (design v2)

**Date:** 2026-07-03
**Branch:** implementation branch off `main` AFTER PR #18 merges (depends on `/history`, `computeDelta`, `buildSnapshot`, jsonb citations fix)
**Status:** approved (brainstorming, v2 incorporates architecture review), ready for planning

## Problem

Our Overview shows **per-model bars** (AI Overviews / AI Mode / ChatGPT / Perplexity / Gemini) — visibility of the tracked domain across engines. SurferSEO's Overview is **competitor-centric**: the main chart ranks competitors by visibility, and Compare shows "you vs a competitor" across every metric. For a domain with 0 visibility (idztech.pl) the per-model view is all zeros; SurferSEO still shows who *is* winning the prompts and lets you benchmark.

**Goal:** pivot the Overview to the SurferSEO model — competitor ranking + full Compare — reusing the scan data we already collect, built on **one primitive: a per-domain snapshot.**

## Core principle (from architecture review)

**`snapshotForDomain(rows, domain)` is the single source of truth for the whole module.** Every view — Overview, Compare, Trend, and future Export/PDF/API — reads the same `DomainSnapshot` object. There is exactly one code path that turns scan rows into metrics for a domain; no drift. Consequences baked into this design:

- `computeOverview` / `aggregateSources` become **internal** building blocks of `snapshotForDomain`, not public entry points.
- `buildSnapshot(rows, ownDomain)` becomes a thin alias: `snapshotForDomain(rows, ownDomain)`.
- Endpoints return **whole snapshots**, never hand-picked single metrics — so new UI metrics never force an API change.
- Snapshots for all domains in a scan are computed **once per scan** (`buildSnapshotsForScan`) and reused for ranking, compare, and history.

## Decisions (brainstorming + review)

1. **Pivot** main chart per-model → **competitor ranking**. Per-model leaves the main chart (may return under an "All models" filter later — out of scope).
2. **`snapshotForDomain` is the module's central primitive** (review #1, #10).
3. **Full snapshots over the wire** — competitors carry their `overview`; compare/history carry full/own+competitor snapshots (review #2, #6, #7).
4. **Compute once, reuse** — one `Map<domain, DomainSnapshot>` per scan powers ranking + compare + history; no recompute (review #3, #4).
5. **Chart shows Top 5; picker shows ALL competitors** (review #5).
6. **Compare auto-selects the #1 competitor** by default.
7. **Trend line now**: bar↔line toggle; line = visibility over time (you + selected competitor) via `/history`. Uses existing **`react-chartjs-2`** dep; competitor bars stay hand-rolled SVG (like `VisibilityBars`).
8. **Competitor identity = domain + favicon**; **favicon is built client-side** (`https://www.google.com/s2/favicons?domain=…`), API returns only `domain` (review #9).
9. **Noise blocklist as an array** `COMPETITOR_NOISE` (+ internal `Set`) for testability (review #8); excludes AI grounding/redirect proxies.

**Depends on:** PR #18 merged. Build on a branch cut from `main` after #18.

**Out of scope (YAGNI):** domain→brand-name mapping/logos; per-model as a secondary view; "All prompts"/"All models" filter wiring; Export/PDF (the snapshot model makes them cheap later).

## Types (metrics layer, `lib/aiVisibilityMetrics.ts`)

```ts
// The one concept the whole module operates on.
export type DomainSnapshot = {
   overview: {                       // per-domain metrics
      visibilityScore: number; mentionRate: number; avgPosition: number | null;
      directCitations: number; pages: number;
      perModel: Array<{ model: string; score: number }>;
   };
   sources: Array<{ url: string; domain: string; timesShown: number; models: string[] }>;
   prompts: Array<{ promptId: number; topic: string; text: string; score: number }>;
   topics: Array<{ topic: string; score: number }>;
   citedPromptIds: number[];
};

// Landscape-level, NOT part of a snapshot (a competitor's snapshot must not recurse
// into its own competitors, and shipping that would be huge). Carries the full
// overview so the UI reads any metric without another request.
export type RankedCompetitor = { domain: string; overview: DomainSnapshot['overview'] };
```

## Architecture

### 1. Metrics layer — pure (`lib/aiVisibilityMetrics.ts`)

- **`snapshotForDomain(rows: ResultRow[], domain: string): DomainSnapshot`** — THE primitive. Re-projects each row's cited/position onto `domain` (via existing `ownDomainPosition`), then composes overview + sources + prompts + topics + citedPromptIds. `computeOverview`/`aggregateSources` become private helpers it calls.
- **`buildSnapshot(rows, ownDomain) = snapshotForDomain(rows, ownDomain)`** — alias kept for existing callers.
- **`buildSnapshotsForScan(rows: ResultRow[], ownDomain: string): Map<string, DomainSnapshot>`** — computes snapshots for `ownDomain` + every distinct cited domain (minus noise) **once**. The shared cache behind ranking, compare, and history.
- **`rankCompetitors(byDomain: Map<string, DomainSnapshot>, ownDomain: string): RankedCompetitor[]`** — all competitor domains sorted by `overview.visibilityScore` desc (ALL, not just top 5; the chart slices top 5, the picker uses all).
- **`COMPETITOR_NOISE: string[]`** (+ `const NOISE = new Set(COMPETITOR_NOISE)`): `vertexaisearch.cloud.google.com`, `googleusercontent.com`, `google.com`, `bing.com`, … (AI grounding/redirect proxies, not real competitors).
- **`computeDelta`** (from #18) unchanged; now also usable on any two `DomainSnapshot.overview`s.

### 2. Endpoints (`data.ts` + `history.ts`) — always return whole snapshots

- **`view=overview`** → `{ snapshot: DomainSnapshot /* own */, competitors: RankedCompetitor[] /* all, sorted */, delta, previousScanAt, nextRefreshAt, daysUntilRefresh }`. Built from one `buildSnapshotsForScan` call.
- **`view=overview&competitor=<domain>`** → additionally `compare: { competitorDomain, snapshot: DomainSnapshot }` — the competitor's **full** snapshot (read from the same map; not recomputed). Covers per-topic/per-prompt "vs" now and Compare-sources/citations later with zero endpoint change. Unknown/noise `competitor` → omit `compare`, no 500.
- **`GET /history`** → `{ scans: Array<{ scanId, finishedAt, own: DomainSnapshot['overview'] }> }`.
- **`GET /history?competitor=<domain>`** → each point also carries `competitor: DomainSnapshot['overview']`. Per scan it runs `buildSnapshotsForScan` once and reads own + competitor overviews. (Overview-slice, not the whole snapshot: trends are metric-over-time; per-prompt/source-over-time is not a use case. The full map exists server-side if that ever changes.)

### 3. Frontend (`overview.tsx` + components)

- **Chart panel** with **bar↔line toggle**:
  - **Bar** — top-5 `competitors` as bars (domain + favicon + `overview.visibilityScore`); tracked domain's score in the header. Click a bar → set Compare.
  - **Line** — `react-chartjs-2` trend from `/history`: your line + selected competitor's line; right-side **Top Competitors** clickable list.
- **Compare state** (page-level), default = `competitors[0]`. A "Comparing with {domain}" **picker over ALL competitors** (search + full list). When set, everything shows "vs" from `compare.snapshot`:
  - Header `you vs competitor` (score); stat cards `0% vs 16%`, `— vs 5.6`, citations, pages; Topics & Prompts `0 vs 16` (own `snapshot.prompts` vs `compare.snapshot.prompts`).
- **Sources** — from `snapshot.sources` (already fixed); favicon built client-side.
- New focused components: `CompetitorBarChart`, `TrendLineChart` (chart.js), `CompetitorPicker`, plus Compare-aware stat/topic rendering.

## Data flow

```
scan rows (parseCitations) ─► buildSnapshotsForScan(rows, own) ─► Map<domain, DomainSnapshot>
        │                                                             │
        ├─ map.get(own)              → snapshot (header, stats, sources, prompts, topics)
        ├─ rankCompetitors(map, own) → competitors[] (bars top5, picker all)
        └─ map.get(selected)         → compare.snapshot (default competitors[0])

/history(+competitor) ─► per scan: buildSnapshotsForScan → { own.overview, competitor.overview } ─► TrendLineChart
```

## Components & responsibilities

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `snapshotForDomain` (new, pure) | The one primitive: rows + domain → `DomainSnapshot` | `ownDomainPosition`, private compute/aggregate helpers |
| `buildSnapshotsForScan` (new, pure) | All domains' snapshots for a scan, once | `snapshotForDomain` |
| `rankCompetitors` (new, pure) | Sort competitor snapshots by visibility | the map, `COMPETITOR_NOISE` |
| `data.ts` (edit) | `snapshot` + `competitors` + optional `compare` (whole snapshots) | metrics layer |
| `history.ts` (edit) | own (+ optional competitor) overview per scan | `buildSnapshotsForScan` |
| `CompetitorBarChart` (new) | Top-5 bars, click→compare | favicon (client) |
| `TrendLineChart` (new) | You + competitor over time | `react-chartjs-2`, `/history` |
| `CompetitorPicker` (new) | Select/search over ALL competitors | competitors list |
| Overview page (edit) | Compare state (default #1), wire "vs" | above + services |

## Error handling
- No completed scan → existing `pending` path.
- 0 competitors → bars show only the tracked domain; Compare disabled with a hint.
- `competitor` not in the ranked set → omit `compare` (no 500).
- Trend with <2 scans → single point / flat line, no crash.

## Testing
- `snapshotForDomain`: equals `buildSnapshot` when `domain === ownDomain`; a domain cited @pos1 in one pair → overview.visibilityScore reflects it; uncited → 0; prompts/topics computed for that domain.
- `buildSnapshotsForScan`: one entry per own + cited domain, noise excluded, computed once.
- `rankCompetitors`: excludes own + noise; sorted desc; returns ALL (not truncated).
- `COMPETITOR_NOISE`: array contains the known proxies; `vertexaisearch.cloud.google.com` excluded, a real domain kept.
- Endpoint shape: `overview` returns `snapshot` + `competitors` (with `overview`); `&competitor=` adds `compare.snapshot`; unknown competitor → no `compare`.
- Manual: Compare defaults to #1; picker lists all; stats/topics show "vs"; bar↔line toggle; favicons render.

## Phasing (the plan will expand)
- **A — Data primitive:** `DomainSnapshot`, `snapshotForDomain`, `buildSnapshotsForScan`, `rankCompetitors`, `COMPETITOR_NOISE` (+ tests); make `computeOverview`/`aggregateSources` internal; `buildSnapshot` → alias.
- **B — Endpoints:** `data.ts` (`snapshot` + `competitors` + `compare`), `history.ts` (`competitor`).
- **C — Compare frontend:** competitor bar chart + Compare state (default #1) + picker (all) + "vs" on header/stats/topics.
- **D — Trend:** bar↔line toggle + `TrendLineChart` (you + competitor).
