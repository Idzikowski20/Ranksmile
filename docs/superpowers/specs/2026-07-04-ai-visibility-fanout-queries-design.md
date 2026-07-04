# AI Visibility — Fanout Queries (design)

Date: 2026-07-04
Status: approved (build full pipeline + both detail modals)

## Goal
Replace the `ComingSoon` stub at `pages/sites/[domain]/ai-visibility/fanout-queries.tsx`
with a real Fanout Queries page: the follow-up ("fan-out") search queries AI engines
generate while answering a tracked prompt. Grouped by Fanout or by Prompt, with
common-phrase pills, date/prompt/model filters, and a shared detail slide-over.

## Data source (verified via live DataForSEO probe, 2026-07-04)
`llm_responses/live` returns `result[0].fan_out_queries: string[] | null` at the
result level (sibling of `items`):
- **gemini** (`gemini-2.5-flash`): reliably populated when `web_search=true`
  (e.g. `["najlepsze narzędzia…","łatwe w użyciu kreatory…",…]`).
- **chat_gpt** (`gpt-4.1-mini`): populated only when the model actually web-searches
  (`result[0].web_search=true`); otherwise `null`.
- **perplexity** (`sonar`): DFS does not surface fan-out for sonar → always `null`.
- **ai_mode** (Google SERP): no `fan_out_queries`; nearest is `refinement_chips`
  (may be `null`). Captured from the ai_mode item when present.
- **ai_overview**: none.

Consequence: fanout only populates on **new** scans; existing rows stay empty. The
page shows a skeleton-then-empty state until a fresh scan runs.

## Layers (each verified with `tsc --noEmit` + `jest --ci` before the next)

### L1 — Foundation (capture + storage)
- **Migration** (`lib/ensureAiVisibilityTables.ts`): `ALTER TABLE ai_vis_results ADD
  COLUMN fan_out_queries <JSON_T>` guarded by `ignoreExisting`, mirroring `brands`.
- **Parsers** (`lib/dataforseoLlm.ts`): `parseLlmItems`/`parseAiModeItems` also return
  `fanOutQueries: string[]`; `parseLlmItems` reads it from the passed `result[0]`
  (signature extended to accept the result object, not just `items`), `parseAiModeItems`
  from `refinement_chips`. `LlmAnswer` gains `fanOutQueries: string[]`; `runModelPrompt`
  threads it through for every engine (empty array when absent).
- **Writer** (`lib/aiVisibilityScan.ts`): persist `fan_out_queries` (JSON) in the
  results INSERT alongside `answer`/`citations`.
- **Read** (`lib/aiVisibilityRead.ts`): `ResultRow` gains `fanOutQueries: string[]`;
  `loadScanResultRows` selects + parses the column (default `[]`).
- Unit tests for both parsers (populated + null/missing).

### L2 — Aggregation + detail endpoints (`pages/api/ai-visibility/[slug]/data.ts`)
All reuse the existing `filterRows` (date/prompt/model CSV params).
- **`view === 'fanout'`** returns:
  - `groupByFanout`: `[{ query, promptCount, models[], timesShown, prompts:[{id,text,topic,timesShown}] }]`
  - `groupByPrompt`: `[{ id, text, topic, fanoutCount, models[], timesShown, queries:[{query,models[],timesShown}] }]`
  - `commonPhrases`: `[{ phrase, count }]` — n-gram (2–5 word) frequency across all
    fanout strings, deduped, sorted desc, top ~30. Pure helper in
    `lib/aiVisibilityMetrics.ts` (`commonPhrases(rows)`), unit-tested.
  - `timesShown` = number of (scan-latest) rows whose `fanOutQueries` contains the query.
- **`view === 'prompt-detail'`** (`?promptId=`) and **`view === 'fanout-detail'`**
  (`?query=`), each scoped by `?engine=` (the modal's model dropdown) + optional
  `?compare=`: per-engine `{ visibilityScore, mentionRate, avgPosition }` stat cards,
  a per-scan time series for the chart (reuse `snapshotForDomain`/`computeOverview`
  over `loadScanResultRows` per historical scan, bounded like `/history`), the Brands
  list (reuse `brandsForSource`-style aggregation), and the nested fanout list.

### L3 — Frontend page (`pages/sites/[domain]/ai-visibility/fanout-queries.tsx`)
- Reuse `AiVisPageShell` (date + `All prompts` + `All models` toolbar).
- Group-by **Fanout / Prompt** segmented control; **Common phrases** pills (click →
  fills the search box); search input; sortable **Times shown**.
- `react-virtuoso` expandable rows (parent → children) with the gradient times-shown
  bar and per-row model-icon stack, per `design.md` tokens (inline styles, `#F4F4F5`
  card border, `growOut` dropdowns, brand purple accents). Skeletons while fetching;
  never a stale/empty flash (session rule).
- Row click opens the shared detail modal.

### L4 — Shared detail slide-over (`components/aiVisibility/AiVisDetailModal.tsx`)
One component for both prompt- and fanout-detail (mockups are structurally identical):
prev/next nav across the current list, Overview/Responses segmented tabs, Compare +
engine pickers, 3 stat cards, metric-toggle + `TrendLineChart`, Brands table, nested
Fanout Queries table, standard empty states. Data via `useAiVisPromptDetail` /
`useAiVisFanoutDetail`.

### Hooks (`services/aiVisibility.tsx`)
`useAiVisFanout({prompts,models,groupBy})`, `useAiVisPromptDetail({promptId,engine,compare})`,
`useAiVisFanoutDetail({query,engine,compare})` — `URLSearchParams` + `keepPreviousData`,
with the stale-guard lessons from the prior review round (blank stale data while
`isFetching` on identity change).

## Non-goals (v1)
- Backfilling fanout for historical scans (impossible — raw responses not stored).
- Exposing fanout for engines that don't return it (perplexity/ai_overview).

## Verification
Per layer: `npx tsc --noEmit` (the real gate — `eslint.ignoreDuringBuilds`) + `npx jest --ci`.
Lint is non-blocking; match the file's existing inline-style density.
