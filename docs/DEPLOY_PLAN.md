# Railway Full Deploy — Final Plan

**Date:** 2026-07-26  
**Status:** Approved for implementation  
**Canonical:** this file (design notes: `docs/superpowers/specs/2026-07-26-railway-full-deploy-design.md`)

Entire runtime on Railway. Neon Auth/Postgres stay on Neon. No hybrid Vercel+Render in prod.

## Topology

| Service | Role | Public | DoD |
|---------|------|--------|-----|
| **app** | Next.js UI + API only | Yes (`ranksmile.pl` / staging domain) | UI + auth + APIs; `/api/health` + `/api/ready` green |
| **cron** | `cron.js` only | No | Schedules fire; crash ≠ app restart |
| **python-sidecar** | FastAPI | No | Token-gated routes; `/health` + `/ready` green |
| **pipeline-workers** | BullMQ (`tsx`) | No | Consume `ranksmile-*`; concurrency=2 |
| **Redis** | Railway Redis | No | `PING` OK for app + workers |

```
Internet → app
            ├─ private → python-sidecar
            ├─ private → Redis ← pipeline-workers
            └─ private → cron → app (internal URL)
```

## Hard rules

1. **Deploy order:** `app` (runs migrations in `entrypoint.sh`) **before** `pipeline-workers`. Workers never migrate; they assume schema is ready.
2. **Cron ≠ app container.** App CMD is `node server.js` only.
3. **Prod Redis is required.** `/api/ready` fails if Redis is down or `REDIS_URL` missing (not a soft warning). On Railway, `/api/ready` also fails without a non-Render `PYTHON_SIDECAR_URL`.
4. **Sidecar auth is global middleware** — every route except the exempt list.
5. **No Render defaults in prod.** Explicit `PYTHON_SIDECAR_URL`; boot log + post-deploy log check for `onrender.com`.
6. **Workers image must ship `tsx`.** `tsx` is a devDependency — Dockerfile must install it explicitly (or promote to dependencies); bare `npm ci` under `NODE_ENV=production` will break `npx tsx`.

## Cron — failure policy

Cron calls app over private URL (`NEXTJS_URL` / `http://app.railway.internal:$PORT`).

**SSOT:** Railway `cron.js` owns the full schedule (daily 08:00, rank-tracking 09:00, retention monthly, plan-reservations */5, stripe-billing-reconcile hourly, starter-nudge 03:00, plus legacy scrape/notify). `vercel.json` crons are empty. Auth: `CRON_SECRET` / `CRON_SECRET_CURRENT` (+ optional `CRON_SECRET_PREVIOUS`).

| App state | Cron behavior |
|-----------|----------------|
| Transient 5xx / network error | **Retry** with exponential backoff (e.g. 1s → 2s → 4s, max 3 attempts per tick), then **log + skip** that tick |
| App still down after retries | Do **not** exit process; wait for next schedule |
| Railway without `NEXTJS_URL` / `APP_BASE_URL` | **Fail startup** (`process.exit(1)`) — never fall back to `127.0.0.1` on Railway |
| Permanent config error (missing `APIKEY`) | Log loudly; process may exit (Railway restarts cron only) |

Implement retry/backoff in `cron.js` fetch paths. `Dockerfile.cron` installs only `croner`, `cryptr`, `dotenv` (matches `cron.js` requires + Node 22 `fetch`/`fs`).

## Sidecar — auth enforcement

| | |
|--|--|
| Header | `x-internal-token: <INTERNAL_PIPELINE_TOKEN>` |
| Where | **Only** `@app.middleware("http")` → `require_internal_token` in `python-sidecar/main.py` |
| Scope | **All routes by default** — new `@app.post/get/...` inherit auth automatically; do **not** add per-route token checks except legacy duplicates to remove later |
| Exempt | `OPTIONS`; `GET /health`; `GET /ready` (only these — update middleware allowlist when adding probes) |
| Prod | Missing/empty token → **fail startup**; bad/missing header → **401** |
| Dev | Empty token → skip check (local only) |
| Rotation | Set same new token on app + sidecar + workers, redeploy together |

Endpoints (all token-gated except exempt):  
`/generate`, `/generate-image`, `/analyze-site`, `/brand-knowledge`, `/plagiarism`, `/analyze-serp`, `/extract-terms-from-urls`, `/competitor-outlines`, `/ai-visibility`, `/ai-readability`, `/content-effort`, `/apply-ai-readability`, `/social-posts`, `/ai-visibility/run-scan`, `/pipeline/domain-setup`, `/pipeline/generate`, `/pipeline/deep-analysis`, `/ner`, `/score-content`.

## Health / ready

| Endpoint | Checks |
|----------|--------|
| `GET /api/health` (app) | Process up |
| `GET /api/ready` (app) | Neon `SELECT 1` **and** Redis `PING` (required on Railway/prod). On Railway also require `PYTHON_SIDECAR_URL` (non-Render) — missing sidecar → **503**, not log-only |
| `GET /health` (sidecar) | Process up |
| `GET /ready` (sidecar) | `INTERNAL_PIPELINE_TOKEN` set; `NEXTJS_URL` present |

Railway healthchecks: prefer ready endpoints once shipped.

## Workers

- Image: `Dockerfile.workers` (Node + `tsx`, not Next standalone)
- Start only after `waitForRedis()`
- Concurrency: **2** (current)
- Env: `REDIS_URL`, `DATABASE_URL`, `PIPELINE_STAGE=5`, `PIPELINE_INLINE_WORKERS=0`, `PYTHON_SIDECAR_URL`, `INTERNAL_PIPELINE_TOKEN`

## Env (reference)

```
REDIS_URL=${{Redis.REDIS_URL}}
PYTHON_SIDECAR_URL=http://${{python-sidecar.RAILWAY_PRIVATE_DOMAIN}}:${{python-sidecar.PORT}}
NEXTJS_URL=http://${{app.RAILWAY_PRIVATE_DOMAIN}}:${{app.PORT}}
NEXT_PUBLIC_APP_URL=https://ranksmile.pl   # staging: Railway HTTPS URL
INTERNAL_PIPELINE_TOKEN=<shared>
```

Plus existing Neon Auth, Stripe, DeepSeek, DataForSEO, Ably, Google, etc.

## Staging → cutover

**Staging** (own Redis, own public domain, trusted Neon Auth origin) before any DNS change.

### Pre-DNS checklist

1. Auth sign-in / session  
2. Deep-analysis E2E  
3. AO / SSE  
4. Job enqueue → worker consume  
5. Sidecar → app callback  
6. `/api/health` + `/api/ready` + sidecar `/health` + `/ready`  
7. Cron tick in logs  
8. **Render guardrail:** resolved sidecar URL logged at boot; post-deploy log scan shows **zero** `onrender.com`  

### Production cutover

1. Staging green → deploy production env (app first, then workers)  
2. Confirm Neon Auth trusts `https://ranksmile.pl`  
3. DNS → Railway; Vercel idle 1–2 weeks  
4. Re-run checklist + **confirm no `onrender.com` in prod logs**  
5. Disable Render sidecar; remove code defaults  

### Rollback

DNS → Vercel; temporary Render URL only if emergency. No Neon host-specific migrate.

## Implementation order

1. `pages/api/health.ts`, `pages/api/ready.ts`; sidecar `GET /ready`  
2. Sidecar: prod fail-fast without token; middleware exempt list includes `/ready`  
3. App Dockerfile CMD → `node server.js` only  
4. `python-sidecar/Dockerfile`  
5. `Dockerfile.workers`  
6. Cron image (`Dockerfile.cron` or workers image + `node cron.js`) + fetch retry/backoff  
7. `serviceUrls`: guard/remove Render default; boot log of resolved URL  
8. Railway: Redis + 5 services; staging env; reference vars  
9. Staging checklist → DNS → decommission Render  

## Cost

Orientacyjnie ~$20–40/mo (always-on). Not a guarantee — watch Railway usage week 1.

## Start

Implementation plan: [`docs/superpowers/plans/2026-07-26-railway-full-deploy.md`](superpowers/plans/2026-07-26-railway-full-deploy.md)  
Env matrix: [`docs/railway-env.md`](railway-env.md)
