# AI Visibility — Cyclic Tracking & Cost Control (design)

**Date:** 2026-07-03
**Branch:** `feature/ai-visibility`
**Status:** approved (v2 — incorporates review refinements), ready for planning
**Implementation plan:** `docs/superpowers/plans/2026-07-03-ai-visibility-cyclic-tracking.md`

### Plan-stage review refinements (v3 — reflected in the plan, authoritative there)

1. Scheduler runs due scans **sequentially** (`await run_scan_loop` per scan), NOT in parallel — a batch of 5 in parallel would fan out to ~1250 concurrent DataForSEO calls. The 6h tick has slack.
2. "Previous" scan for the delta is chosen by **`finished_at`** chronology, not `id` (a retry can have a higher `id` but earlier finish). The "latest" scan query likewise orders by `finished_at`.
3. `due-scans` is wrapped in a **Postgres transaction-scoped advisory lock** (`pg_advisory_xact_lock`) so multiple sidecar instances can't both enqueue the same due config (double scan / double cost). SQLite dev skips it.
4. Scheduler adds a **0–60s startup jitter** so synchronized restarts don't all hit `due-scans` at once; first tick still effectively immediate for fast recovery.
5. Overview data returns **`nextRefreshAt` + `daysUntilRefresh`**; UI shows "next auto refresh in N days" alongside "last updated N days ago".
6. Constants object renamed `AI_VIS` → **`AI_VIS_SETTINGS`**.
7. `/history` keeps a **bounded N+1** (one `buildOverview` per scan, capped at 24) — documented; batch aggregation deferred until history needs hundreds of points.

## Problem

A full AI Visibility scan is 50 prompts × 5 engines = 250 DataForSEO calls ≈ **~$4** and ~10 min (measured live, not estimated). The feature is meant for **tracking visibility over time**, so the real cost metric is spend-over-time, not per-scan. Running the full set frequently is wasteful: AI answers for a given prompt drift over weeks, not hours.

**Goal:** keep all 50 prompts × 5 engines every scan (no reduction in coverage), but bound ongoing cost by scanning on a fixed cadence, and surface what changed between scans.

**Chosen model:** first scan on setup (already built) → automatic full re-scan **every 14 days** → show deltas vs the previous scan. Cost ≈ **$4 / 14 days ≈ ~$8.5/month**.

**Explicitly out of scope (YAGNI — confirmed in review):** per-pair/prompt/model TTL caching, partial/incremental refresh, per-prompt TTL, "smart refresh". At ~$8–9/mo per domain the savings don't justify the complexity. Also out: email/push notifications; cheaper model tiers (deferred, would need a pricing probe first).

## Configuration (single source of truth)

All tunables live in one object in `lib/aiVisibility.ts` so every setting is findable in one place:

```ts
export const AI_VIS = {
   REFRESH_INTERVAL_DAYS: 14,        // auto re-scan cadence (measured from finished_at)
   MANUAL_REFRESH_COOLDOWN_DAYS: 7,  // below this a manual scan asks for confirmation
   SCHEDULER_TICK_HOURS: 6,          // sidecar scheduler tick (mirrored sidecar-side)
   SCHEDULER_BATCH_LIMIT: 5,         // max scans enqueued per due-scans tick (oldest first)
} as const;
```

The sidecar keeps its own `SCHEDULER_TICK_HOURS` constant (Python can't import TS) documented to mirror `AI_VIS.SCHEDULER_TICK_HOURS`.

## Baseline (already built — do not rebuild)

- Durable worker (step 2): `runScanChunk` (resumable, idempotent per `(prompt,model)` row) + `kickAiVisScan` (loops chunks) in `lib/aiVisibilityScan.ts`; internal `pages/api/ai-visibility/internal/run-chunk.ts`; sidecar `python-sidecar/pipeline/ai_vis_scan.py` (`run_scan_loop`) + `POST /ai-visibility/run-scan`; `/scan` hands off to the sidecar with an inline fallback.
- Tables: `ai_vis_configs`, `ai_vis_prompts`, `ai_vis_scans` (status/progress/**finished_at**), `ai_vis_results` (per prompt×model: answer, citations, own_cited, own_position, cost_micros, error).
- Metrics: `lib/aiVisibilityMetrics.ts` — `computeOverview`, `aggregateSources`, `aggregateCompetitors` (pure, tested).
- Read endpoint: `pages/api/ai-visibility/[slug]/data.ts` (`?view=overview|sources|competitors|prompts|fanout`).
- Frontend: Overview page + `AiVisPageShell` + `CrunchingBar` (polls scan-status).

## Architecture — additions

### ① Scheduler — sidecar-driven (Render, always-on)

The python-sidecar is a long-lived process, so it owns the cadence with no dependency on the Vercel plan.

- **New Next endpoint `POST /api/ai-visibility/internal/due-scans`** (auth: `x-internal-token` only, same as run-chunk).
  - Finds configs that are **due**: the latest **completed** scan for the config has **`finished_at` < now − `REFRESH_INTERVAL_DAYS`** (explicitly `finished_at`, never `created_at`/`started_at` — a scan may run 10 min or 2 h), AND the config currently has no `queued`/`running` scan.
  - Configs that have **never** completed a scan are NOT the scheduler's concern (their first scan is user-driven on setup) — avoids the scheduler endlessly retrying a broken config.
  - **Batched: `ORDER BY finished_at ASC LIMIT AI_VIS.SCHEDULER_BATCH_LIMIT`** (oldest first). Only up to N configs are enqueued per tick; the next tick picks up the rest. This prevents a fleet of due configs (e.g. 400 after 14 days) from flooding the worker with hundreds of `queued` scans at once.
  - For each selected due config: `enqueueAiVisScan(configId)`, collect the scanId.
  - Returns `{ due: [{ configId, scanId }] }`.
  - Dialect-aware date math (Postgres `INTERVAL`, SQLite `datetime(...)`), mirroring the stale-reclaim in `enqueueAiVisScan`.
- **Sidecar startup loop** (`python-sidecar`): on FastAPI startup, launch a detached `asyncio` task `refresh_scheduler_loop()`.
  - Guarded by a module-level **`asyncio.Lock`** so a tick can never overlap itself — protects against a sidecar restart / double-worker spawning two concurrent schedulers hammering `due-scans`. (`enqueue` + `claim` are already idempotent; the lock is belt-and-suspenders and avoids duplicate `due-scans` calls.)
  - Every `SCHEDULER_TICK_HOURS` (6h): acquire lock → POST `due-scans` → for each returned `scanId` launch `run_scan_loop(scanId, nextjs_url)` (existing durable driver) → release lock.
  - Never raises (best-effort); logs each tick. Uses `NEXTJS_URL` + `INTERNAL_PIPELINE_TOKEN` from env.

Failure behaviour: if a scheduled scan fails or the sidecar restarts mid-run, the next tick re-evaluates due configs; the stale-reclaim (`AI_VIS_SCAN_STALE_MS`) frees a stuck `running` scan so it re-enqueues. A config whose scan keeps failing stays due (its last *completed* scan stays >14 d) until one completes.

### ② Change detection — pure computation ($0)

- **`buildOverview(scanId)` helper** (new, in `lib/aiVisibilityScan.ts` or a small read module): loads a scan's result rows and returns its `computeOverview` output (+ source aggregation). One place that turns a scanId into an overview snapshot — keeps `data.ts` from open-coding the load twice and future-proofs if overview gets heavier.
- **`lib/aiVisibilityMetrics.ts`: new pure `computeDelta(current, previous)`** where each argument is a `buildOverview` result. Returns, for each numeric metric, an object carrying **direction**:
  - `visibilityScore`: `{ current, previous, delta, trend: 'up' | 'down' | 'same' }`.
  - `perModel`: per-engine `{ current, previous, delta, trend }`.
  - `sources`: `{ added: string[], removed: string[] }` (domains cited now but not before, and vice-versa).
  - `prompts`: `{ gained: promptId[], lost: promptId[] }` (own-domain citation gained/lost).
  - `previousScanAt`: ISO of the previous completed scan; `null` when there is no prior scan (first scan → `delta: null`).
- **`data.ts` (`view=overview`)**: `overview = buildOverview(latestScanId)`; if a previous completed scan exists, `delta = computeDelta(overview, buildOverview(previousScanId))`, else `delta: null`. Include both in the response.
- Pure and unit-tested; no new DataForSEO calls.

### ③ Manual-refresh cost guard

- **`/scan` route**: before `enqueueAiVisScan`, read the latest completed scan's `finished_at`.
  - If it is **< `MANUAL_REFRESH_COOLDOWN_DAYS` (7)** old AND the request body does not carry `{ force: true }`: respond `409 { needsConfirm: true, lastScanDaysAgo }` and do NOT enqueue.
  - Otherwise proceed as today (enqueue + sidecar hand-off).
  - An already-active scan still short-circuits via `enqueueAiVisScan`'s active-check (returns the running scanId); the first scan (no completed scan yet) is never blocked.
- **Frontend (`useStartAiVisScan` + Overview/setup trigger)**: on `409 needsConfirm`, show a confirm dialog — "Ostatni skan {N} dni temu — odświeżyć mimo to? (~$4)". On confirm, re-call `/scan` with `{ force: true }`.

### ④ Scan history endpoint (enables future trend charts — cheap now)

- **New `GET /api/ai-visibility/[slug]/history`** (normal user auth + ownership, like `data.ts`): returns completed scans newest-first:
  ```
  { scans: [{ scanId, finishedAt, visibilityScore }, ...] }
  ```
  `visibilityScore` via `buildOverview(scanId).visibilityScore` (cap the count, e.g. last 24).
- Not consumed by the UI yet — added now so a later "Historical Trend" chart is essentially free (no new storage, no schema change).

## Data flow

```
setup "Finish" ──► /scan ──► enqueue + sidecar run-scan ──► (durable worker) ──► ai_vis_results
                                                                                     │
sidecar refresh_scheduler_loop (every 6h, asyncio.Lock)                              │
   └─► /internal/due-scans (finished_at >14d, no active, LIMIT 5 oldest-first)       │
        └─► enqueue due configs ─► run_scan_loop(scanId) ─► (same worker) ───────────┤
                                                                                     │
Overview poll ─► data?view=overview ─► buildOverview(latest) + computeDelta(latest, previous)
history        ─► /history ─────────► [{scanId, finishedAt, visibilityScore}]
manual "refresh" ─► /scan ─► (if <7d & !force) 409 needsConfirm ─► confirm dialog ─► force
```

## Components & responsibilities

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `AI_VIS` constants (edit) | Single home for all tunables | — |
| `due-scans` endpoint (new) | Find due configs (finished_at>14d, no active, LIMIT oldest-first), enqueue, return scanIds | `enqueueAiVisScan`, DB |
| `refresh_scheduler_loop` (sidecar, new) | Tick every 6h under `asyncio.Lock`, drive due scans | `due-scans`, `run_scan_loop` |
| `buildOverview(scanId)` (new) | scanId → overview snapshot | `computeOverview`, DB |
| `computeDelta` (new, pure) | Diff current vs previous overview, with `trend` | `buildOverview` outputs |
| `data.ts` overview (edit) | Attach `delta` from previous scan | `buildOverview`, `computeDelta` |
| `history` endpoint (new) | Completed scans + visibilityScore, newest-first | `buildOverview` |
| Overview UI (edit) | "+N since last scan" + trend arrow + "last scan N days ago" | `data` response |
| `/scan` guard (edit) | 409 on <7d unless `force` | latest scan `finished_at` |
| Start-scan hook + dialog (edit) | Confirm-and-force on 409 | `/scan` |

## Error handling

- Scheduler tick errors: logged, swallowed; next tick retries. `asyncio.Lock` prevents overlap.
- `computeDelta` with no previous scan → `delta: null`; UI hides delta badges/arrows.
- Guard: `409` is a normal control-flow signal, not an error toast; only unexpected non-2xx surface as errors.

## Testing

- `computeDelta` (pure): score/per-model `delta`+`trend` (up/down/same), sources added/removed, prompts gained/lost, and the no-previous-scan (`null`) case.
- `buildOverview`: maps a scan's rows to the expected overview snapshot.
- `due-scans` predicate: due = completed scan with `finished_at` >14 d + no active + has ≥1 completed; batching = oldest-first, capped at `SCHEDULER_BATCH_LIMIT`. Unit-test via the injectable-exec pattern used for `claimScan`, or a small integration check.
- Guard: `/scan` returns 409 under cooldown without `force`, proceeds with `force`; first scan (no completed scan) never blocked.
- Manual verification: second scan → `delta`+`trend` appears; simulate a due config → scheduler enqueues exactly one scan per config, capped per tick.

## Required env (unchanged from step 2)

Both Vercel and the Render sidecar: `INTERNAL_PIPELINE_TOKEN`, `NEXTJS_URL` (public app URL for sidecar→Node calls), `PYTHON_SIDECAR_URL`.

## Cost

- First scan: ~$4 (one-time).
- Ongoing: ~$4 / 14 days ≈ **~$8.5/month per domain**.
- Change detection, history, scheduler: **$0** (pure computation / DB reads).
