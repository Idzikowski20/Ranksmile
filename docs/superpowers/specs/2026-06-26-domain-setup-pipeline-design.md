# P3c — Domain setup pipeline (design)

> After a workspace's domain is created (wizard "Get started"), run a real 5-stage domain-level analysis as an async background job and show its progress on the dashboard. Branch: `feature/tenancy-foundation`. SerpBear (Next.js 12 pages-router) + Python FastAPI sidecar.

## Goal & success criteria
A freshly-created workspace's dashboard shows a 5-stage pipeline loader — **Getting Search Console and site data → Extracting and expanding keywords → Clustering and modeling topics → Analyzing competitors and coverage → Getting and evaluating recommendations** — backed by real work. When it finishes, the dashboard (and the recommendations / topical-map pages) show real materialized data for that domain.

Success:
- "Get started" enqueues a `domain_setup` job; the dashboard polls and renders the live 5-stage loader; on completion it reveals populated data.
- Each stage performs real backend work (no theatre): GSC fetch, keyword expansion, LLM topic clustering, SERP competitor aggregation, LLM recommendations.
- Survives the user navigating away / refreshing (async, polled — not a held request).
- Lean envelope: ~20 keywords, ~10 competitors per top keyword, 1 LLM cluster + 1 LLM recommendations call per domain.

## Settled decisions (from brainstorm)
1. **Execution = async background + polling.** Node enqueues + kicks; the sidecar runs stages 2–5 and pushes progress via the existing `nextjs_url` → `POST /api/articles/job-progress` callback (the sidecar is stateless; Node owns all DB writes). Dashboard polls.
2. **Trigger = finish enqueues + kicks; dashboard has an idempotent guard.** `POST /api/workspaces/[id]/finish` creates the job and fire-and-forgets the runner. The dashboard, if it finds a domain with no job and no analysis, calls `run-setup` as a fallback.
3. **Scope = lean** (~20 keywords / ~10 competitors / 1+1 LLM).
4. **Stage 1 (GSC) runs in Node** (OAuth lives Node-side); stages 2–5 run in the sidecar, seeded with the GSC keywords Node passes in the payload.
5. **Persistence = materialize on `done`** (single point) — the loader runs to completion, then the dashboard reveals the full result. Per-stage incremental reveal is a later iteration.
6. **`recommendations.tsx` + `topical-map.tsx` wiring is IN scope, minimal** — render a list from `domain_recommendations` / `domain_topics`, replacing the current placeholders.
7. **Re-run** is one-shot per domain (idempotent guard); a manual "re-analyze" trigger is out of scope.

## Architecture & data flow
```
"Get started" → POST /api/workspaces/[id]/finish
   ├─ finishWorkspaceSetup (exists): brand_knowledge + status='ready'
   ├─ enqueue: INSERT analysis_jobs (id, domain_id, job_type='domain_setup', status='queued', payload)
   │     (skip if a queued/running/done domain_setup job already exists for this domain)
   └─ void kickDomainSetup(jobId)            ← fire-and-forget; respond 200 {ok, jobId}

kickDomainSetup(jobId)  [Node, long-lived server — same model as deep-analysis]
   ├─ claim job (status='running', locked_at, attempts++) — abort if not claimable
   ├─ STAGE 'gsc' (Node): fetch GSC pages+queries for the domain (OAuth) →
   │     persist domain_gsc_pages; derive seed keywords (top GSC queries) →
   │     emit_progress('gsc', 100)
   ├─ POST sidecar /pipeline/domain-setup { jobId, nextjsUrl, payload:{ domainId, domain,
   │     seedKeywords, brandKnowledge, limits:{ keywords:20, competitorsPerKeyword:10 } } }
   │     (awaited only to detect failure/log; sidecar emits progress for stages 2–5)
   └─ materialization is NOT done here — see job-progress 'done' below (single point).

sidecar /pipeline/domain-setup  [stateless; build_domain_setup_pipeline()]
   stage 'keywords'        → expand seedKeywords via Google Suggest → top ~20 → emit
   stage 'topics'          → 1× LLM clusters the ~20 keywords into topics → emit
   stage 'competitors'     → for top keywords, analyze_serp (reuse) → aggregate competitor
                             domains + coverage gaps (~10 competitors/keyword) → emit
   stage 'recommendations' → 1× LLM over topics + coverage → domain recommendations → emit
   → final 'done' callback to /api/articles/job-progress with the full structured result

Dashboard  [pages/dashboard/index.tsx]
   GET /api/domains/[id]/setup-status (by domainId) → { status, currentStage,
        stages:{gsc,keywords,topics,competitors,recommendations:'pending'|'running'|'done'}, error? }
   if queued|running → render <SetupPipeline> (5 rows, Surfer copy), poll ~2s
   on done → invalidate dashboard queries → normal populated dashboard
   on failed → error state + "Retry" (→ POST run-setup)
   fallback: domain has skeleton articles but NO job → POST /api/domains/[id]/run-setup (idempotent)
```

### Why GSC in Node, the rest in the sidecar
The sidecar can't perform Google OAuth (refresh tokens + client live Node-side, in `lib/gscAccounts` / `gscAccount` model). So Node fetches GSC once and passes the seed keywords to the sidecar, which owns the SERP/LLM infrastructure for stages 2–5.

## Data model (new — `lib/ensurePipelineTables.ts`, raw SQL, dialect-agnostic, idempotent)
- `analysis_jobs`: `ALTER` → make `article_id` nullable; add `domain_id INTEGER` (so domain jobs are queryable and not tied to a single article).
- `domain_gsc_pages` (`id`, `domain_id`, `url`, `clicks`, `impressions`, `position`, `captured_at`)
- `domain_keywords` (`id`, `domain_id`, `keyword`, `source` `'gsc'|'suggest'`, `volume`, `position`, `topic_id` nullable, `created_at`)
- `domain_topics` (`id`, `domain_id`, `title`, `summary`, `created_at`)
- `domain_competitors` (`id`, `domain_id`, `competitor_domain`, `appearances`, `avg_position`, `created_at`)
- `domain_recommendations` (`id`, `domain_id`, `topic_id` nullable, `title`, `rationale`, `priority` `'high'|'medium'|'low'`, `type`, `created_at`)

Indices: `(domain_id)` on each child table; `(domain_id, job_type)` on analysis_jobs for the latest-job lookup.

## Endpoints
- **`POST /api/workspaces/[id]/finish`** (extend existing): after `finishWorkspaceSetup`, resolve the workspace's domain, `enqueueDomainSetup(domainId)` (idempotent), `void kickDomainSetup(jobId)`. Still returns `{ ok: true }` (+ `jobId` for convenience).
- **`GET /api/domains/[id]/setup-status`**: look up the latest `domain_setup` job by `domain_id` (workspace-access-checked via `getAccessibleWorkspaceIds`/`verifyDomainOwnership`). Returns `{ status: 'none'|'queued'|'running'|'done'|'failed', currentStage, stages, error? }`. The 5 stage keys are derived from `current_stage` + `status` (stages before current = done, current = running, after = pending; all done when status='done').
- **`POST /api/domains/[id]/run-setup`**: idempotent kick — if no job or a stale/failed one, `enqueueDomainSetup` + `kickDomainSetup`; if already running/done, no-op. Used by the dashboard fallback + "Retry".
- **`POST /api/articles/job-progress`** (extend): the SINGLE materialization point. On a `domain_setup` `done` callback carrying `result`, persist `result` to the job row AND materialize it into the `domain_*` tables (branch on `job_type`). Progress (non-final) updates for `domain_setup` write `current_stage`/`total_progress` as today.
- **sidecar `POST /pipeline/domain-setup`** + `build_domain_setup_pipeline()` with 4 stages (keywords, topics, competitors, recommendations) + 2 new LLM helpers (`cluster_keywords`, `domain_recommendations`). Reuses `analyze_serp` for competitors and the Suggest path for expansion.

## Components & boundaries
- **`lib/domainPipeline.ts`** (new, Node): `enqueueDomainSetup(domainId)`, `kickDomainSetup(jobId)` (claim + GSC stage + sidecar call), `materializeDomainSetup(domainId, result)`, `getSetupStatus(domainId)`. Single home for the orchestration; keeps endpoints thin.
- **`lib/ensurePipelineTables.ts`** (new): schema bootstrap (called from the same place other ensure* run).
- **sidecar `pipeline/stages/domain/*`** (new): one file per stage + the LLM helpers, mirroring the existing `pipeline/stages/*` + `runner.py` contract (`emit_progress`, `can_skip`, `run`).
- **`components/dashboard/SetupPipeline.tsx`** (new): presentational 5-row loader (pending/running/done per row, Surfer copy + check/spinner icons), driven by the `stages` map.
- **`pages/dashboard/index.tsx`** (extend): poll `setup-status`; render `<SetupPipeline>` while active; reveal normal dashboard on done; fallback kick.
- **`services/domainPipeline.tsx`** (new): `useSetupStatus(domainId)` (react-query polling) + `useRunSetup()`.
- **`pages/.../recommendations.tsx` + `topical-map.tsx`** (extend, minimal): replace placeholders with a list fed by new `GET /api/domains/[id]/recommendations` and `GET /api/domains/[id]/topics`.

## Error handling
- Stage failure → sidecar `mark_failed(stage, message)` → job `status='failed'`, `error`, `current_stage`. Dashboard shows an error row + "Retry".
- Sidecar unreachable / Node stage-1 GSC failure → job `failed` with a clear message; "Retry" re-kicks (attempts/max_attempts guard prevents infinite loops).
- Process restart mid-run → job stuck `running` with an old `locked_at`; `run-setup`/"Retry" reclaims a job whose `locked_at` is older than a staleness window (e.g. 10 min).
- GSC not connected / empty → stage 'gsc' yields no seed keywords; the pipeline still runs on whatever seeds exist (or completes with an empty-but-valid result + a dashboard hint to connect GSC). Never hard-fails the whole setup just because GSC is empty.

## Testing
- **Node unit (jest, mocked DB):** `enqueueDomainSetup` idempotency (no second job when one exists); `getSetupStatus` stage-map derivation from `current_stage`/`status`; `materializeDomainSetup` writes the right rows per table; `job-progress` branches to materialize only on `domain_setup` done. Local `jest.mock('sequelize', ...)` per file; never a global mock.
- **Endpoint (jest):** finish enqueues + returns; setup-status access control (404/empty for non-owned domain); run-setup idempotency (no-op when running).
- **Sidecar (pytest if present, else manual):** each stage returns the contracted shape; the pipeline emits progress for all 4 stages; LLM helpers are mocked. Match the existing sidecar test conventions if any.
- **Manual:** create a workspace end-to-end, watch the 5-stage loader, confirm populated dashboard + recommendations/topics.

## Decomposition (separate implementation plan)
- **T1 — schema:** `lib/ensurePipelineTables.ts` (new tables + analysis_jobs alter) + bootstrap wiring + tests.
- **T2 — Node orchestration:** `lib/domainPipeline.ts` (enqueue/kick/GSC-stage/materialize/status), `setup-status` + `run-setup` endpoints, finish wiring, job-progress materialize branch + tests.
- **T3 — sidecar:** `/pipeline/domain-setup` + 4 stages + 2 LLM helpers, mirroring the runner/contracts pattern.
- **T4 — dashboard + pages:** `SetupPipeline.tsx`, dashboard polling + fallback, `services/domainPipeline.tsx`, minimal recommendations/topical-map wiring + their list endpoints.

T1 → T2/T3 (parallelizable) → T4. Each is its own subagent task under the standard review flow.

## Out of scope
- Per-stage incremental reveal (materialize-on-done only).
- Manual re-analyze trigger / scheduled refresh.
- Rich topical-map visualisation (a simple list now).
- GSC data caching beyond what stage 1 stores for seeding.
