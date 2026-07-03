# AI Visibility — implementation plan

Reference: SurferSEO AI Tracker (surferseo.com/ai-tracker) + DataForSEO AI Optimization API (docs.dataforseo.com/v3/ai_optimization). Mock work already started this session: `lib/aiVisibility.ts`, `components/aiVisibility/CrunchingBar.tsx`, `components/aiVisibility/AiVisibilityToolbar.tsx`, `lib/useAiVisibilityGuard.ts`, and updated `AI_VIS_NAV` in `components/common/Sidebar.tsx`. **The mock lib will be replaced by the API-backed hooks below** — nothing that lands after this plan should read `localStorage` for config/results.

---

## 0 · What we're building (recap of the UI target)

Five sub-pages under `/sites/[domain]/ai-visibility/{overview,sources,competitors,prompts,fanout-queries}`, gated by a workspace-level config. First visit to any of them → redirect to `.../ai-visibility/setup` (wizard). After the wizard finishes it POSTs the config, triggers a scan, and drops the user on `/overview` with a skeleton + persistent "Crunching data…" pill (see `CrunchingBar.tsx`) until the first scan completes.

Feature parity target with SurferSEO AI Tracker (fetched from their landing page):

- **Overview**: Visibility Score 0–100, Mention Rate %, Average Position, Direct Citations count, Pages count. Bar chart per LLM model. Topics & Prompts panel (top 5 sorted). Sources panel (top 5 domains).
- **Sources**: every URL any tracked LLM cited + times shown, per model.
- **Competitors**: cross-brand table (our brand vs. up to N competitors) benchmarking visibility per model.
- **Prompts**: every configured prompt × visibility score × per-model presence.
- **Fanout Queries** (Beta): Google AI Overviews/AI Mode secondary queries that fanned out from our tracked prompts.
- **Models tracked**: ChatGPT, Google AI Overviews, Google AI Mode, Perplexity, Gemini, Claude (SurferSEO shows the first five; Claude is available on DFS so include it in the schema but hide behind a flag if UI space is tight).
- **Filters** every page uses: date pill (single day for now), All prompts multi-select, Compare toggle, All models dropdown.

---

## 1 · DataForSEO API surface we'll depend on

Auth: Basic `Authorization: Basic base64(login:password)`. Env: `DFS_LOGIN`, `DFS_PASSWORD`. **Pricing floor**: $100/month minimum + $0.10 per request + $0.001 per row — the wizard must surface a running "N of LIMIT prompts used" counter (matches SurferSEO's plan gating).

- **Aggregate / Overview**: `POST /v3/ai_optimization/llm_mentions/aggregated_metrics/live/` — Visibility Score, Mention Rate, Average Position, per-model breakdown.
- **Sources tab**: `POST /v3/ai_optimization/llm_mentions/top_pages/live/` and `.../top_domains/live/` — URL + times shown.
- **Competitors tab**: `POST /v3/ai_optimization/llm_mentions/cross_aggregated_metrics/live/` — cross-brand benchmark.
- **Prompts tab**: `POST /v3/ai_optimization/llm_mentions/search/live/` per prompt, or per-provider `.../{chat_gpt|gemini|perplexity|claude}/llm_responses/live/` when we need the raw response text.
- **Fanout Queries (Beta)**: derived from Google AI Overviews organic results — probably `.../gemini/llm_scraper/live/advanced/` or DFS SERP `serp/google/ai_overview/live/`. Leaving flagged until confirmed against DFS docs; ship the sub-page as an empty state first.
- **Keyword seeding for the wizard**: `POST /v3/ai_optimization/ai_keyword_data/keywords_search_volume/live/` — feeds the "Generate prompts" button in the wizard.

---

## 2 · DB schema (Neon)

New tables — one Prisma-style sketch each. Names must match the existing `serpbear_` convention if any; align in Task 3 before migrating.

- `ai_visibility_config` — one row per (workspace_id, domain_id). Columns: `id`, `workspace_id`, `domain_id`, `brand_name`, `prompt_limit`, `plan_tier` (`standard|pro|peace_of_mind`), `refresh_cadence` (`daily|weekly`), `completed_at`, `created_by`, `updated_at`. **No config row ⇒ guard redirects to wizard.**
- `ai_visibility_topic` — `id`, `config_id` (FK), `title`, `order`.
- `ai_visibility_prompt` — `id`, `topic_id` (FK), `text`, `sources` (jsonb: `['google','reddit','quora']`), `selected` (bool), `is_custom` (bool — user-added vs. wizard-generated), `order`.
- `ai_visibility_scan` — one per refresh. `id`, `config_id`, `status` (`queued|running|completed|failed`), `started_at`, `finished_at`, `models_included` (jsonb array), `total_requests`, `total_cost_usd`.
- `ai_visibility_result` — per (scan_id, prompt_id, model). Columns: `id`, `scan_id`, `prompt_id`, `model` (`chat_gpt|gemini|perplexity|claude|ai_overview|ai_mode`), `visibility_score`, `mention_rank` (nullable int), `raw_response` (jsonb — for debugging; can be TTL-purged later).
- `ai_visibility_source` — per (scan_id, url). `id`, `scan_id`, `url`, `domain`, `times_shown`, `models` (jsonb — which models cited it).
- `ai_visibility_competitor` — per (config_id, competitor_domain). `id`, `config_id`, `competitor_domain`, `label`, `added_by`.

Migration plan lives at `migrations/2026xxxx_ai_visibility.sql`. **Ordering rule**: `config → topic → prompt`, then `scan → (result, source)`. No cascade deletes across configs — a workspace can archive but shouldn't lose historical scans.

---

## 3 · Backend layers

### 3.1 · `lib/dataforseo/client.ts` (new)
- Constructor reads `DFS_LOGIN` / `DFS_PASSWORD` — throws at boot if missing (guarded so the app still starts if the API is unconfigured; the AI Visibility routes render an "unconfigured" state instead of 500-ing).
- Single `post<T>(path, body)` helper wrapping `fetch` with Basic auth, JSON body, structured logging (path, status, ms, cost estimate).
- Per-call cost recording: writes to a `ai_visibility_budget` KV in Neon or Upstash so `services/aiVisibility` can surface "you've spent $X.YZ this month" in Settings.

### 3.2 · Scan orchestrator (new)
- On wizard Finish, `POST /api/ai-visibility/config/[slug]` returns the config row and enqueues a scan.
- Because DFS live endpoints return in ≤2s but a full scan is `prompts × models` requests, the wizard's expected p95 is `100 prompts × 5 models × 200ms ≈ 100s` — too long for a single request. Two options, pick one **before** writing code:
  - (a) Vercel background function (long-running) — simplest for now, kick from `/api/ai-visibility/scan/[slug]`, poll status via `/api/ai-visibility/scan/[slug]/status`.
  - (b) python-sidecar job (there's already a sidecar per `serpbear-deploy-topology`) — cleaner separation, matches how article generation works today. **Recommended** because free scans on Vercel Hobby cap at 60s.
- Scan writes rows into `ai_visibility_result`, `ai_visibility_source`. When done, updates `ai_visibility_scan.status='completed'` and unblocks the "Crunching data…" pill.

### 3.3 · API routes (`pages/api/ai-visibility/*`)
- `POST/GET /config/[slug]` — CRUD config + topics + prompts. GET returns null when unconfigured (guard uses this).
- `POST /config/[slug]/generate-prompts` — proxies to DFS keyword data using topic title as seed. Returns 10 candidates with `sources` tags.
- `POST /scan/[slug]` — enqueue scan.
- `GET /scan/[slug]/status` — `{ status, progress, remainingMs }` for the Crunching pill.
- `GET /overview/[slug]?date=YYYY-MM-DD&model=all` — aggregate metrics.
- `GET /sources/[slug]?date&model` — pages + domains.
- `GET /competitors/[slug]?date&model`
- `GET /prompts/[slug]?date&model&topic`
- `GET /fanout/[slug]?date` — flagged behind `AI_VIS_FANOUT_ENABLED`.

### 3.4 · Services layer (`services/aiVisibility.ts`)
- One react-query hook per API route: `useAiVisibilityConfig(slug)`, `useOverview(slug, filters)`, `useSources`, `useCompetitors`, `usePrompts`, `useFanout`, `useScanStatus(slug)` (polls every 3s while status ≠ completed, then stops).

---

## 4 · Frontend

### 4.1 · Sidebar / Guard (already partly done)
- `AI_VIS_NAV` keys & real paths — **done** this session.
- `useAiVisibilityGuard` — **switch from localStorage to** `useAiVisibilityConfig(slug)` in Task 3.4. When `data === null && !isLoading` → `router.replace('.../setup')`.

### 4.2 · Wizard (`pages/sites/[domain]/ai-visibility/setup.tsx`)
- Steps: (1) confirm brand + domain, (2) topic + prompt selection with the exact accordion UI from the screenshots.
- Header: "Select prompts you want to track" + `N of LIMIT prompts used` bar (visual matches: `text-sm text-gray-100` + yellow progress `bg-yellow-60`).
- Each topic accordion: chevron, title, `5 prompts` count, source icons (Google/Reddit/Quora — SVGs are already in the reference HTML, extract them into `components/aiVisibility/icons/`), Remove button on hover.
- Prompt row: checkbox, text, source icon, hover Remove button.
- "Add prompt to {topic}" footer per topic.
- Top-right of card group: "Add topic" + "Add in bulk" buttons.
- New topic collapsed state: title input → "Generate prompts" button → skeleton loader rows → filled prompt list. `Generate prompts` calls `POST /config/[slug]/generate-prompts`.
- Bottom-right: "Uses N prompts from your limit" + `Finish` button (dark). Finish POSTs config, enqueues scan, `router.replace('.../overview')`.

### 4.3 · Shared shell for the 5 sub-pages
- Reuse `DomainSubLayout` for the breadcrumb.
- New `components/aiVisibility/AiVisibilityHeader.tsx`: sticky page header with title + Export (dropdown) + Share (dark button).
- `AiVisibilityToolbar` (already created) — date pill + All prompts + Compare + All models. Wire filter state via URL query params so refreshes and share links are stable.
- `CrunchingBar` (already created) — swap `crunchingRemaining` to read `useScanStatus(slug)` instead of localStorage.

### 4.4 · Overview page (`overview.tsx`)
- Section 1: **Visibility score** card. Header: score number + trend chip. Left action: `View Competitors` link. Body: 5-bar chart (one bar per model) with per-model favicon + score label. Skeleton state = 5 pulsing bars.
- Section 2 (2-col grid): **Topics & Prompts** panel and **Sources** panel. Each: header (title + `#`/`>_` toggle for the Topics panel + "View all" outline button). Body: top 5 rows with visibility score / times shown.
- Section 3 (3-col grid): **Mention rate**, **Average position**, **Direct citations & Pages** — each a 200px chart. First iteration: single-value + sparkline; second iteration: real chart via existing chart lib (whichever the project already uses; check `components/dashboard/BrandPerformance.tsx`).

### 4.5 · Sub-pages
- **Sources** (`sources.tsx`): searchable table of URLs with model chips + times shown; server-paginated via `/api/ai-visibility/sources`.
- **Competitors** (`competitors.tsx`): cross-brand table + "Add competitor" modal (writes to `ai_visibility_competitor`).
- **Prompts** (`prompts.tsx`): full prompt list grouped by topic, per-model score cells, filter by topic + model.
- **Fanout Queries** (`fanout-queries.tsx`, Beta): empty state ("Fanout data will appear after your next scan") until endpoint is wired.

### 4.6 · Sidebar "Get started" checklist
- New component `SidebarGetStarted` shown at the bottom of the sidebar. 5 items with strike-through when done. Tracks: (1) Set up workspace, (2) Connect Google Search Console, (3) Audit existing content, (4) See if AI mentions your brand (⇐ completed on wizard Finish), (5) TBD (Set up first competitor?). Progress ring shows `N of 5`. State stored in `user_onboarding_progress` (extend existing onboarding table if there is one — `Grep OnboardingGuard` first).

---

## 5 · Execution order (proposed sequencing)

Phases can go into separate PRs to keep review sane.

1. **DB + DFS client** — migrations, `lib/dataforseo/client.ts`, no UI. Verifiable by hitting a scratch script.
2. **Wizard + config API** — `setup.tsx` end-to-end, but scan step is a stub that returns fake status. UI reviewable.
3. **Scan orchestrator** — real DFS calls in the sidecar/background function, `useScanStatus` polling, real "Crunching data…" behavior.
4. **Overview page** — full skeleton + wired to real data.
5. **Sources + Prompts** — the two heaviest data pages.
6. **Competitors** — includes the "Add competitor" flow.
7. **Fanout Queries** — depends on confirming which DFS endpoint delivers this.
8. **Sidebar Get started** — polish.

---

## 6 · Open questions to lock before starting Task 1

- **Sidecar vs. Vercel background function** for scan orchestration (§3.2).
- **Fanout Queries endpoint** — confirm which DFS endpoint returns them (§1, §4.5).
- **Plan tiers** — do we mirror SurferSEO's 50/100/custom prompt limits, or map to our billing plans? Affects `ai_visibility_config.prompt_limit` default.
- **Refresh cadence** — daily scans on all workspaces would burn the DFS budget fast. Start with manual "Refresh now" only; add cron once budget model is clear.
- **Credit UI** — where does "$X.YZ spent this month on AI Visibility" surface? Settings > Billing extension, or a small badge in the sidebar?

---

## 7 · What already exists after this session

- `components/common/Sidebar.tsx` — `AI_VIS_NAV` keys wired to real paths; guard redirect via `useAiVisibilityGuard`.
- `lib/aiVisibility.ts` — **mock data + localStorage helpers. Will be deleted / rewritten in Task 2.**
- `lib/useAiVisibilityGuard.ts` — reads from mock. Rewire to `useAiVisibilityConfig` in Task 3.4.
- `components/aiVisibility/CrunchingBar.tsx` — reads mock localStorage timer. Rewire to `useScanStatus` in Task 3.
- `components/aiVisibility/AiVisibilityToolbar.tsx` — no state, reusable as-is once filter query params are wired.
