# Railway environment matrix

Maps Ranksmile processes to Railway services. Canonical product rules: [`DEPLOY_PLAN.md`](./DEPLOY_PLAN.md). Implementation: [`superpowers/plans/2026-07-26-railway-full-deploy.md`](./superpowers/plans/2026-07-26-railway-full-deploy.md).

## Services → Dockerfiles

| Railway service | Dockerfile | Notes |
|-----------------|------------|-------|
| **app** | `Dockerfile` (repo root) | `entrypoint.sh` runs migrations; CMD `node server.js` |
| **python-sidecar** | `python-sidecar/Dockerfile` | Root Directory = `python-sidecar` |
| **pipeline-workers** | `Dockerfile.workers` | No migrations; needs `tsx` in image |
| **cron** | `Dockerfile.cron` | Slim image: `cron.js` + croner/cryptr/dotenv |
| **Redis** | Railway Redis plugin | Private only |

## Hard deploy order

1. Redis up  
2. **app** (migrations) until `GET /api/ready` → 200  
3. **python-sidecar** until `GET /ready` → 200  
4. **pipeline-workers**  
5. **cron**  

Workers must not start against an unmigrated schema.

## Reference variables

```
REDIS_URL=${{Redis.REDIS_URL}}
PYTHON_SIDECAR_URL=http://${{python-sidecar.RAILWAY_PRIVATE_DOMAIN}}:${{python-sidecar.PORT}}
NEXTJS_URL=http://${{app.RAILWAY_PRIVATE_DOMAIN}}:${{app.PORT}}
NEXT_PUBLIC_APP_URL=https://ranksmile.pl
INTERNAL_PIPELINE_TOKEN=<shared strong secret>
PIPELINE_STAGE=5
PIPELINE_INLINE_WORKERS=0
```

Staging: use the Railway HTTPS URL for `NEXT_PUBLIC_APP_URL` and add that origin to Neon Auth trusted origins.

Also copy existing secrets from Vercel (Neon Auth, Stripe, DeepSeek, DataForSEO, Ably, Google, `APIKEY`, `SECRET`, etc.).

**Keyword Tracker flags on `app` (optional; SI organic does not need them):**

| Variable | Why |
|----------|-----|
| `ENABLE_RANK_TRACKING_UI=true` | Keyword Tracker APIs under `/api/rank-tracking/*/configs|runs|…`. Search Intelligence `…/organic` is always on (auth + domain only). |
| `ENABLE_RANK_TRACKING_RUNNER=true` | Scheduled/BullMQ rank checks |

**Required on `python-sidecar` (and ideally `app` / `pipeline-workers`):**

| Variable | Why |
|----------|-----|
| `SERPER_API_KEY` | SERP / PAA / plagiarism / AI visibility evidence. Without it sidecar logs `No SERPER_API_KEY - using keyword seed data`. |
| `DEEPSEEK_API_KEY` | LLM stages |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | Paid SEO metrics (optional fallback) |
| `INTERNAL_PIPELINE_TOKEN` | Must match app |

Exact private URL syntax: follow current Railway private networking docs when wiring.

## Healthchecks

| Service | Path |
|---------|------|
| app | `/api/ready` (preferred) or `/api/health` for liveness-only |
| python-sidecar | `/ready` (preferred) or `/health` |

## Post-deploy Render guardrail

1. App ready logs should show `[serviceUrls] sidecarUrl=...` with a Railway host  
2. Scan logs: **zero** `onrender.com`  
3. Grep repo/env for leftover Render defaults before cutover  

## Staging vs production

| | Staging | Production |
|--|---------|------------|
| Redis | own instance | own instance |
| Public URL | `*.up.railway.app` (or staging subdomain) | `ranksmile.pl` |
| Neon Auth trusted origins | staging HTTPS origin | `https://ranksmile.pl` |

No DNS cutover until staging pre-DNS checklist in `DEPLOY_PLAN.md` passes.
