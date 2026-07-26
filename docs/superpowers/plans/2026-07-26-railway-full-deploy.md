# Railway Full Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Dockerfiles, health/ready probes, sidecar auth fail-fast, cron isolation + retry, and Render-URL guards so Ranksmile can run as five Railway services per `docs/DEPLOY_PLAN.md`.

**Architecture:** Code changes make each process independently deployable. App stays Next standalone (no cron). Workers and cron get dedicated Node images. Sidecar gets its own Python image. Runtime probes + URL resolution prevent silent Render/Vercel fallbacks on Railway.

**Tech Stack:** Next.js 12 (Pages API), FastAPI, Docker multi-stage, ioredis, BullMQ/`tsx`, croner, Railway private networking.

**Spec:** `docs/DEPLOY_PLAN.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `pages/api/health.ts` | Liveness (no deps) |
| `pages/api/ready.ts` | Neon + Redis readiness |
| `__tests__/api/health-ready.test.ts` | Unit tests for handlers |
| `__tests__/lib/serviceUrls.test.ts` | Sidecar URL / Render guard |
| `lib/serviceUrls.ts` | No Render default on Railway; boot log helper |
| `python-sidecar/main.py` | `/ready`, middleware exempt, fail-fast token |
| `python-sidecar/service_urls.py` | Drop Vercel default; Railway-safe NEXTJS_URL |
| `Dockerfile` | CMD `node server.js` only; drop concurrently/cron from app image |
| `python-sidecar/Dockerfile` | uvicorn on `$PORT` |
| `Dockerfile.workers` | `tsx scripts/pipeline-workers.ts` |
| `Dockerfile.cron` | `node cron.js` |
| `cron.js` | Prefer `NEXTJS_URL`; fetch retry/backoff |
| `docs/railway-env.md` | Env matrix + deploy order checklist |

---

### Task 1: App `/api/health`

**Files:**
- Create: `pages/api/health.ts`
- Create: `__tests__/api/health-ready.test.ts` (health cases first)
- Test: `__tests__/api/health-ready.test.ts`

- [ ] **Step 1: Write failing test for health**

```ts
/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';
import health from '../../pages/api/health';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as NextApiResponse & { statusCode: number; body: unknown };
}

describe('/api/health', () => {
  it('returns 200 { ok: true }', async () => {
    const req = { method: 'GET' } as NextApiRequest;
    const res = mockRes();
    await health(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `npx jest __tests__/api/health-ready.test.ts --ci`

Expected: FAIL — cannot find `pages/api/health`

- [ ] **Step 3: Implement health handler**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ ok: true });
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx jest __tests__/api/health-ready.test.ts --ci`

Expected: PASS

- [ ] **Step 5: Commit** (only if user asked to commit in this session)

```bash
git add pages/api/health.ts __tests__/api/health-ready.test.ts
git commit -m "feat: add /api/health liveness probe"
```

---

### Task 2: App `/api/ready` (Neon + Redis + sidecar URL hard on Railway/prod)

**Files:**
- Create: `pages/api/ready.ts`
- Modify: `__tests__/api/health-ready.test.ts`

**Ready contract (Railway / `NODE_ENV=production`):**
1. Neon `SELECT 1` — else 503  
2. Redis `PING` + `REDIS_URL` present — else 503  
3. On Railway: `PYTHON_SIDECAR_URL` (or `SIDECAR_URL`) present and **not** `onrender.com` — else 503  
4. Only then log resolved sidecar URL and return 200  

Missing sidecar must **never** return 200 on Railway.

- [ ] **Step 1: Extend test file with ready cases**

```ts
jest.mock('../../lib/db/query', () => ({
  queryOne: jest.fn(),
}));

jest.mock('../../lib/serviceUrls', () => ({
  logResolvedSidecarUrl: jest.fn(),
  sidecarUrl: jest.fn(),
}));

const mockPing = jest.fn();
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    ping: mockPing,
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
  })),
}));

import ready from '../../pages/api/ready';
import { queryOne } from '../../lib/db/query';

const mockedQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;

describe('/api/ready', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
    jest.clearAllMocks();
  });

  it('503 when REDIS_URL missing in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;
    delete process.env.RAILWAY_ENVIRONMENT;
    mockedQueryOne.mockResolvedValue({ ok: 1 });
    const res = mockRes();
    await ready({ method: 'GET' } as NextApiRequest, res);
    expect(res.statusCode).toBe(503);
  });

  it('503 on Railway when PYTHON_SIDECAR_URL missing', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    delete process.env.PYTHON_SIDECAR_URL;
    delete process.env.SIDECAR_URL;
    mockedQueryOne.mockResolvedValue({ ok: 1 });
    mockPing.mockResolvedValue('PONG');
    const res = mockRes();
    await ready({ method: 'GET' } as NextApiRequest, res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ ok: false, sidecar: false });
  });

  it('200 when Neon + Redis + sidecar URL OK', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT = 'production';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.PYTHON_SIDECAR_URL = 'http://sidecar.railway.internal:8001';
    mockedQueryOne.mockResolvedValue({ ok: 1 });
    mockPing.mockResolvedValue('PONG');
    const res = mockRes();
    await ready({ method: 'GET' } as NextApiRequest, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, neon: true, redis: true, sidecar: true });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx jest __tests__/api/health-ready.test.ts --ci`

Expected: FAIL — `pages/api/ready` missing

- [ ] **Step 3: Implement ready handler**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { queryOne } from '../../lib/db/query';
import { logResolvedSidecarUrl } from '../../lib/serviceUrls';

function redisRequired(): boolean {
  return (
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    process.env.NODE_ENV === 'production'
  );
}

function isRailway(): boolean {
  return Boolean(process.env.RAILWAY_ENVIRONMENT);
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    await queryOne<{ ok: number }>('SELECT 1 AS ok');
  } catch {
    return res.status(503).json({ ok: false, neon: false, redis: null, sidecar: null });
  }

  if (redisRequired()) {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      return res.status(503).json({
        ok: false, neon: true, redis: false, sidecar: null, reason: 'REDIS_URL missing',
      });
    }
    try {
      const { default: Redis } = await import('ioredis');
      const client = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
      try {
        const pong = await client.ping();
        if (pong !== 'PONG') throw new Error('unexpected ping');
      } finally {
        client.disconnect();
      }
    } catch {
      return res.status(503).json({ ok: false, neon: true, redis: false, sidecar: null });
    }
  }

  if (isRailway()) {
    const sidecar =
      process.env.PYTHON_SIDECAR_URL?.trim() || process.env.SIDECAR_URL?.trim() || '';
    if (!sidecar) {
      return res.status(503).json({
        ok: false, neon: true, redis: true, sidecar: false, reason: 'PYTHON_SIDECAR_URL missing',
      });
    }
    if (/onrender\.com/i.test(sidecar)) {
      return res.status(503).json({
        ok: false, neon: true, redis: true, sidecar: false, reason: 'Render sidecar URL refused',
      });
    }
  }

  logResolvedSidecarUrl();
  return res.status(200).json({ ok: true, neon: true, redis: true, sidecar: true });
}
```

Match `ioredis` connect style to `lib/pipeline/cacheLayers.ts` if the above API differs.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest __tests__/api/health-ready.test.ts --ci`

Expected: PASS (may fail until Task 4 adds `logResolvedSidecarUrl` — if so, implement Task 4 before finishing this step, or stub the import temporarily then replace)

- [ ] **Step 5: Commit** (if requested)

```bash
git add pages/api/ready.ts __tests__/api/health-ready.test.ts
git commit -m "feat: add /api/ready with Neon and Redis checks"
```

---

### Task 3: Sidecar `/ready` + middleware exempt + prod fail-fast

**Files:**
- Modify: `python-sidecar/main.py`

- [ ] **Step 1: Update middleware allowlist**

```python
_EXEMPT_PATHS = {"/health", "/ready"}

@app.middleware("http")
async def require_internal_token(request: Request, call_next):
    expected = os.getenv("INTERNAL_PIPELINE_TOKEN", "")
    if (
        expected
        and request.method != "OPTIONS"
        and request.url.path not in _EXEMPT_PATHS
    ):
        if request.headers.get("x-internal-token", "") != expected:
            return JSONResponse(status_code=401, content={"detail": "unauthorized"})
    return await call_next(request)
```

- [ ] **Step 2: Add `/ready` and startup fail-fast**

```python
def _is_deployed_host() -> bool:
    return bool(
        os.getenv("RAILWAY_ENVIRONMENT")
        or os.getenv("RENDER")
        or os.getenv("VERCEL")
    )

@app.on_event("startup")
async def _require_internal_token_on_deploy() -> None:
    if _is_deployed_host() and not os.getenv("INTERNAL_PIPELINE_TOKEN", "").strip():
        raise RuntimeError("INTERNAL_PIPELINE_TOKEN is required on deployed hosts")

@app.get("/ready")
def ready():
    token_ok = bool(os.getenv("INTERNAL_PIPELINE_TOKEN", "").strip())
    nextjs = (os.getenv("NEXTJS_URL") or os.getenv("APP_BASE_URL") or "").strip()
    if _is_deployed_host() and (not token_ok or not nextjs):
        return JSONResponse(
            status_code=503,
            content={"ok": False, "token": token_ok, "nextjs_url": bool(nextjs)},
        )
    return {"ok": True, "token": token_ok, "nextjs_url": bool(nextjs)}
```

Keep existing `_start_ai_vis_scheduler`; add fail-fast as a second `@app.on_event("startup")`.

- [ ] **Step 3: Manual verify**

With `RAILWAY_ENVIRONMENT=1` and empty token, uvicorn must exit on startup.

- [ ] **Step 4: Commit** (if requested)

```bash
git add python-sidecar/main.py
git commit -m "feat(sidecar): /ready probe and require token on deploy"
```

---

### Task 4: `serviceUrls` — no Render fallback on Railway + boot log

**Files:**
- Modify: `lib/serviceUrls.ts`
- Create: `__tests__/lib/serviceUrls.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
/** @jest-environment node */

describe('sidecarUrl', () => {
  const prev = { ...process.env };
  afterEach(() => {
    process.env = { ...prev };
    jest.resetModules();
  });

  it('uses PYTHON_SIDECAR_URL when set', async () => {
    process.env.PYTHON_SIDECAR_URL = 'http://python-sidecar.railway.internal:8001';
    process.env.NODE_ENV = 'production';
    const { sidecarUrl } = await import('../../lib/serviceUrls');
    expect(sidecarUrl()).toBe('http://python-sidecar.railway.internal:8001');
  });

  it('throws on Railway when PYTHON_SIDECAR_URL missing', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';
    process.env.NODE_ENV = 'production';
    delete process.env.PYTHON_SIDECAR_URL;
    delete process.env.SIDECAR_URL;
    const { sidecarUrl } = await import('../../lib/serviceUrls');
    expect(() => sidecarUrl()).toThrow(/PYTHON_SIDECAR_URL/);
  });

  it('does not return onrender.com on Railway', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';
    process.env.PYTHON_SIDECAR_URL = 'http://sidecar.railway.internal:8001';
    const { sidecarUrl } = await import('../../lib/serviceUrls');
    expect(sidecarUrl()).not.toMatch(/onrender\.com/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest __tests__/lib/serviceUrls.test.ts --ci`

- [ ] **Step 3: Implement `lib/serviceUrls.ts`**

```ts
/** Public production hosts — overridden by env when set. */
export const PRODUCTION_APP_URL = 'https://ranksmile.pl';
/** @deprecated Do not use as runtime fallback on Railway. Kept for emergency rollback docs only. */
export const PRODUCTION_SIDECAR_URL = 'https://ranksmile-sidecar.onrender.com';

export const LOCAL_NEXTJS_URL = 'http://127.0.0.1:3000';
export const LOCAL_SIDECAR_URL = 'http://127.0.0.1:8001';

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.RAILWAY_ENVIRONMENT)
  );
}

function isRailway(): boolean {
  return Boolean(process.env.RAILWAY_ENVIRONMENT);
}

function normalizeLocalhost(url: string): string {
  return url.replace('localhost', '127.0.0.1').replace(/\/$/, '');
}

export function nextjsUrl(): string {
  const explicit = process.env.NEXTJS_URL?.trim() || process.env.APP_BASE_URL?.trim();
  if (explicit) return normalizeLocalhost(explicit);

  const publicApp = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (publicApp && isProductionRuntime()) return normalizeLocalhost(publicApp);

  if (isProductionRuntime()) return PRODUCTION_APP_URL;
  return LOCAL_NEXTJS_URL;
}

export function publicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return normalizeLocalhost(explicit);
  if (isProductionRuntime()) return PRODUCTION_APP_URL;
  return 'http://localhost:3000';
}

export function sidecarUrl(): string {
  const explicit = process.env.PYTHON_SIDECAR_URL?.trim() || process.env.SIDECAR_URL?.trim();
  if (explicit) {
    const url = normalizeLocalhost(explicit);
    if (isRailway() && /onrender\.com/i.test(url)) {
      throw new Error(`Refusing Render sidecar URL on Railway: ${url}`);
    }
    return url;
  }
  if (isRailway()) {
    throw new Error('PYTHON_SIDECAR_URL is required on Railway');
  }
  if (isProductionRuntime()) return PRODUCTION_SIDECAR_URL;
  return LOCAL_SIDECAR_URL;
}

export function isLocalServiceUrl(url: string): boolean {
  return /\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(url.replace('localhost', '127.0.0.1'));
}

export function logResolvedSidecarUrl(): void {
  try {
    const url = sidecarUrl();
    console.log(`[serviceUrls] sidecarUrl=${url}`);
    if (/onrender\.com/i.test(url)) {
      console.warn('[serviceUrls] WARNING: sidecar resolves to Render host');
    }
  } catch (err) {
    console.error('[serviceUrls] sidecarUrl resolve failed', err);
  }
}
```

- [ ] **Step 4: Ensure `/api/ready` calls `logResolvedSidecarUrl()` on success (Task 2)**

- [ ] **Step 5: Run tests**

Run: `npx jest __tests__/lib/serviceUrls.test.ts __tests__/api/health-ready.test.ts --ci`

Expected: PASS

- [ ] **Step 6: Commit** (if requested)

```bash
git add lib/serviceUrls.ts pages/api/ready.ts __tests__/lib/serviceUrls.test.ts
git commit -m "fix: require PYTHON_SIDECAR_URL on Railway; log resolved URL"
```

---

### Task 5: Python `service_urls.py` — drop Vercel default

**Files:**
- Modify: `python-sidecar/service_urls.py`

- [ ] **Step 1: Replace file contents**

```python
"""Resolve Next.js URL — production public hosts vs local dev."""
import os

PRODUCTION_APP_URL = "https://ranksmile.pl"
LOCAL_NEXTJS_URL = "http://127.0.0.1:3000"


def _is_deployed() -> bool:
    return bool(os.getenv("RENDER") or os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("VERCEL"))


def _is_local_url(url: str) -> bool:
    normalized = url.replace("localhost", "127.0.0.1").lower()
    return "://127.0.0.1" in normalized or "://[::1]" in normalized


def nextjs_url() -> str:
    explicit = (os.getenv("NEXTJS_URL") or os.getenv("APP_BASE_URL") or "").strip()
    if explicit:
        resolved = explicit.replace("localhost", "127.0.0.1").rstrip("/")
        if _is_deployed() and _is_local_url(resolved):
            public = (os.getenv("NEXT_PUBLIC_APP_URL") or "").strip() or PRODUCTION_APP_URL
            print(
                f"[service_urls] ignoring local NEXTJS_URL={resolved!r} on deployed host — "
                f"using {public}"
            )
            return public.replace("localhost", "127.0.0.1").rstrip("/")
        return resolved

    public = (os.getenv("NEXT_PUBLIC_APP_URL") or "").strip()
    if public and _is_deployed():
        return public.replace("localhost", "127.0.0.1").rstrip("/")

    if os.getenv("RAILWAY_ENVIRONMENT"):
        raise RuntimeError("NEXTJS_URL or NEXT_PUBLIC_APP_URL required on Railway")

    if _is_deployed():
        return PRODUCTION_APP_URL

    return LOCAL_NEXTJS_URL
```

- [ ] **Step 2: Commit** (if requested)

```bash
git add python-sidecar/service_urls.py
git commit -m "fix(sidecar): prefer ranksmile.pl; require URL on Railway"
```

---

### Task 6: App Dockerfile — web only

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Replace runner CMD and drop cron/concurrently**

Use multi-stage as today, but:

- Do **not** `COPY cron.js`
- Do **not** install `concurrently`, `croner`, `cryptr` in app image
- Keep `sequelize-cli`, `@googleapis/searchconsole`, `dotenv`, `@isaacs/ttlcache`
- Prefer `COPY package.json package-lock.json` + `npm ci` in deps if lock is clean; else keep `npm install`
- Final:

```dockerfile
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
```

- [ ] **Step 2: Commit** (if requested)

```bash
git add Dockerfile
git commit -m "build: app image runs server.js only (cron moved out)"
```

---

### Task 7: `python-sidecar/Dockerfile`

**Files:**
- Create: `python-sidecar/Dockerfile`
- Create: `python-sidecar/.dockerignore`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m spacy download pl_core_news_sm \
    && python -m spacy download en_core_web_sm

COPY . .

ENV PORT=8001
EXPOSE 8001

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
```

`.dockerignore`:

```
.venv
__pycache__
*.pyc
.env
```

- [ ] **Step 2: Optional local build**

```bash
docker build -t ranksmile-sidecar ./python-sidecar
```

- [ ] **Step 3: Commit** (if requested)

```bash
git add python-sidecar/Dockerfile python-sidecar/.dockerignore
git commit -m "build: add python-sidecar Dockerfile for Railway"
```

---

### Task 8: `Dockerfile.workers` (tsx must be in the image)

**Files:**
- Create: `Dockerfile.workers`

**Trap:** `tsx` is in `devDependencies` (`package.json`). With `NODE_ENV=production`, `npm ci` **skips** devDependencies — `npx tsx` then fails at runtime.

**Locked approach:** install prod deps, then explicitly add `tsx` (pin same major as package.json `^4.22.4`):

```dockerfile
FROM node:22-alpine
WORKDIR /app
ENV PIPELINE_INLINE_WORKERS=0
ENV PIPELINE_STAGE=5

COPY package.json package-lock.json ./
# Install without NODE_ENV=production first so lockfile resolves; then pin tsx.
RUN npm ci --omit=dev \
 && npm install --no-save tsx@4.22.4 \
 && node -e "require('tsx/package.json')"

ENV NODE_ENV=production
COPY . .
CMD ["npx", "tsx", "scripts/pipeline-workers.ts"]
```

Alternative (also OK): move `tsx` from `devDependencies` → `dependencies` in `package.json` and use plain `npm ci --omit=dev`. Prefer Dockerfile pin for smaller blast radius unless workers need tsx elsewhere.

Do **not** use `entrypoint.sh` (no migrations in workers).

- [ ] **Step 1: Write `Dockerfile.workers` as above**

- [ ] **Step 2: Verify tsx present in image** (if Docker available)

```bash
docker build -t ranksmile-workers -f Dockerfile.workers .
docker run --rm ranksmile-workers npx tsx --version
```

Expected: prints tsx version (not "command not found")

- [ ] **Step 3: Commit** (if requested)

```bash
git add Dockerfile.workers
git commit -m "build: add Dockerfile.workers with explicit tsx install"
```

---

### Task 9: Cron image + retry/backoff + Railway URL guard

**Files:**
- Create: `Dockerfile.cron`
- Modify: `cron.js`

**Deps audit (`cron.js` requires):**

| Require / API | In `Dockerfile.cron`? |
|---------------|------------------------|
| `cryptr` | yes — `cryptr@6.4.0` |
| `croner` | yes — `croner@9.0.0` |
| `dotenv` | yes — `dotenv@16.0.3` |
| `fs` / `fs.promises` | Node built-in |
| global `fetch` | Node 22 built-in |

No other imports — keep the slim image; do **not** copy the full monorepo.

**URL policy:**

- Local / same-container legacy: fallback `http://127.0.0.1:$PORT` OK  
- **Railway:** `NEXTJS_URL` or `APP_BASE_URL` **required** — no localhost fallback (that would hide misconfig and hammer the cron container itself)

- [ ] **Step 1: Update `cron.js` base URL + `fetchWithRetry` + Railway guard**

```js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getInternalBaseURL = () => {
   const explicit = (process.env.NEXTJS_URL || process.env.APP_BASE_URL || '').trim();
   if (explicit) return explicit.replace(/\/$/, '');

   if (process.env.RAILWAY_ENVIRONMENT) {
      console.error(
         '[cron] FATAL: NEXTJS_URL or APP_BASE_URL required on Railway (refusing localhost fallback)',
      );
      process.exit(1);
   }

   const serverPort = process.env.PORT || 3000;
   return `http://127.0.0.1:${serverPort}`;
};

const INTERNAL_BASE_URL = getInternalBaseURL();
console.log(`[cron] INTERNAL_BASE_URL=${INTERNAL_BASE_URL}`);

async function fetchWithRetry(url, fetchOpts, { attempts = 3, baseDelayMs = 1000 } = {}) {
   let lastErr;
   for (let i = 0; i < attempts; i++) {
      try {
         const res = await fetch(url, fetchOpts);
         if (res.status >= 500) {
            throw new Error(`HTTP ${res.status}`);
         }
         return res;
      } catch (err) {
         lastErr = err;
         if (i < attempts - 1) await sleep(baseDelayMs * (2 ** i));
      }
   }
   throw lastErr;
}
```

Replace all cron `fetch(...)` calls with `fetchWithRetry(...)`. On final failure after retries: log + skip tick (do not exit). Only exit on missing Railway URL / missing permanent config at startup.

At start of `runAppCronJobs`:

```js
if (!process.env.APIKEY) {
   console.error('[cron] APIKEY missing — cron HTTP calls will fail auth');
}
```

- [ ] **Step 2: Write `Dockerfile.cron`** (deps must match audit above)

```dockerfile
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN mkdir -p /app/data
COPY cron.js ./
RUN npm init -y && npm install --no-package-lock croner@9.0.0 cryptr@6.4.0 dotenv@16.0.3

CMD ["node", "cron.js"]
```

- [ ] **Step 3: Commit** (if requested)

```bash
git add cron.js Dockerfile.cron
git commit -m "feat(cron): separate image, Railway NEXTJS_URL guard, fetch retry"
```

---

### Task 10: Railway env doc

**Files:**
- Create: `docs/railway-env.md`
- Modify: `docs/DEPLOY_PLAN.md` (link this plan)

- [ ] **Step 1: Write `docs/railway-env.md`** covering:

- Service → Dockerfile mapping (app / sidecar / workers / cron / Redis)
- Reference env vars from DEPLOY_PLAN
- Hard rule: **app before workers**
- Healthchecks: `/api/ready`, sidecar `/ready`
- Post-deploy: zero `onrender.com` in logs
- Staging vs prod Neon Auth trusted origins

- [ ] **Step 2: Point DEPLOY_PLAN “Start” at this plan path**

- [ ] **Step 3: Commit** (if requested)

```bash
git add docs/railway-env.md docs/DEPLOY_PLAN.md docs/superpowers/plans/2026-07-26-railway-full-deploy.md
git commit -m "docs: Railway env matrix and implementation plan"
```

---

### Task 11: Local verification gate

- [ ] **Step 1:**

```bash
npx jest __tests__/api/health-ready.test.ts __tests__/lib/serviceUrls.test.ts --ci
```

Expected: PASS

- [ ] **Step 2: Grep Render**

```bash
rg -n "onrender\\.com" -g "!docs/**"
```

Expected: only deprecated `PRODUCTION_SIDECAR_URL` (and maybe comments) — Railway path must throw before using it.

- [ ] **Step 3: Docker builds** (if Docker available)

```bash
docker build -t ranksmile-app .
docker build -t ranksmile-workers -f Dockerfile.workers .
docker build -t ranksmile-cron -f Dockerfile.cron .
docker build -t ranksmile-sidecar ./python-sidecar
```

---

### Task 12: Railway staging + pre-DNS (manual)

- [ ] Create Railway project + `staging` env + Redis  
- [ ] Wire 4 services + reference vars + `INTERNAL_PIPELINE_TOKEN`  
- [ ] Deploy **app** first → `/api/ready` 200  
- [ ] Sidecar → `/ready` 200  
- [ ] Workers → queue subscribe logs  
- [ ] Cron → tick logs, no crash loop  
- [ ] Full pre-DNS checklist in DEPLOY_PLAN including **zero `onrender.com`**  
- [ ] Only then production + DNS  

---

## Spec coverage

| DEPLOY_PLAN item | Task |
|------------------|------|
| health/ready app | 1–2 |
| sidecar ready + token fail-fast + middleware | 3 |
| Redis hard ready | 2 |
| Railway ready requires `PYTHON_SIDECAR_URL` (not log-only) | 2 |
| app before workers | 10, 12 |
| cron separate + retry + no Railway localhost fallback | 6, 9 |
| Dockerfile.cron deps = cron.js requires only | 9 |
| Dockerfiles + workers `tsx` explicit install | 6–8 |
| Render guard + log + checklist | 4, 11, 12 |
| staging before DNS | 12 |
| python NEXTJS_URL | 5 |
