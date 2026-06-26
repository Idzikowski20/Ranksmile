# P3c — Domain Setup Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a workspace's domain is created, run a real 5-stage domain-level analysis (GSC → keyword expansion → topic clustering → competitor/coverage → recommendations) as an async background job, with live progress on the dashboard and materialized results.

**Architecture:** Node owns OAuth/GSC/DB/materialization + atomic job orchestration; the Python sidecar owns AI/SERP stages and pushes progress via the existing `job-progress` callback. Results materialize in ONE transaction only on `done`. The dashboard polls a `setup-status` endpoint and renders a 5-row loader.

**Tech Stack:** Next.js 12 pages-router + TypeScript, Sequelize (Postgres/SQLite), Python FastAPI sidecar, react-query, jest.

**Spec:** `docs/superpowers/specs/2026-06-26-domain-setup-pipeline-design.md`. Branch: `feature/tenancy-foundation`.

**Global conventions (every task):**
- Bash cwd RESETS each call — ALWAYS prefix `cd /c/Users/patry/Desktop/serpbear && <cmd>`.
- TDD; tests mock the DB (`jest.mock('../../database/database')`); if sequelize is imported, LOCAL `jest.mock('sequelize', () => ({ QueryTypes: { SELECT:'SELECT', INSERT:'INSERT' }, Op:{ in:'Op.in' } }))` per file — NEVER a root `__mocks__/sequelize.ts`.
- `db.query(sql,{replacements})` → `[rows, meta]`; with `{type: QueryTypes.SELECT}` → rows only. NEVER `ON CONFLICT`; dialect-agnostic select-then-insert / delete-then-insert.
- `isPostgres = !!process.env.DATABASE_URL`; JSON column type `${isPostgres ? 'JSONB' : 'TEXT'}`.
- Commit ONLY the listed files. Trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. NEVER `git add -A`.

## File structure
- `lib/ensurePipelineTables.ts` (new) — schema bootstrap: 5 domain tables + `analysis_jobs` ALTERs.
- `lib/domainPipeline.ts` (new) — orchestration: enqueue, atomic claim, GSC stage + seed fallback, kick, transactional materialize, status derivation.
- `pages/api/domains/[id]/setup-status.ts` (new) — GET status by domainId.
- `pages/api/domains/[id]/run-setup.ts` (new) — idempotent kick/recovery.
- `pages/api/domains/[id]/recommendations.ts`, `pages/api/domains/[id]/topics.ts` (new) — list endpoints for T4.
- `pages/api/articles/job-progress.ts` (modify) — accept `status`+`result`; on `domain_setup` done → materialize.
- `pages/api/workspaces/[id]/finish.ts` (modify) — enqueue + kick after finishWorkspaceSetup.
- `python-sidecar/pipeline/stages/domain/{keywords,topics,competitors,recommendations}.py` (new) — 4 stages.
- `python-sidecar/pipeline/domain_runner.py` (new) — builds the domain pipeline + ctx; `mark_done` final callback.
- `python-sidecar/main.py` (modify) — `POST /pipeline/domain-setup`.
- `components/dashboard/SetupPipeline.tsx` (new) — 5-row loader.
- `services/domainPipeline.tsx` (new) — `useSetupStatus` (adaptive poll) + `useRunSetup`.
- `pages/dashboard/index.tsx` (modify) — poll + render loader + fallback kick.
- `pages/sites/[domain]/recommendations.tsx`, `topical-map.tsx` (modify) — minimal list from new tables.

---

## Task 1 — Schema (`lib/ensurePipelineTables.ts`)

**Files:** Create `lib/ensurePipelineTables.ts`; Test `__tests__/lib/ensurePipelineTables.test.ts`.

- [ ] **Step 1 — failing test** (`__tests__/lib/ensurePipelineTables.test.ts`):
```ts
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn().mockResolvedValue([[], {}]) } }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
import db from '../../database/database';
import { ensurePipelineTables } from '../../lib/ensurePipelineTables';
const mockQuery = db.query as jest.Mock;

describe('ensurePipelineTables', () => {
  beforeEach(() => mockQuery.mockClear());
  it('creates the five domain tables and alters analysis_jobs', async () => {
    await ensurePipelineTables();
    const sql = mockQuery.mock.calls.map((c: any[]) => String(c[0])).join('\n');
    for (const t of ['domain_gsc_pages', 'domain_keywords', 'domain_topics', 'domain_competitors', 'domain_recommendations']) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
    }
    expect(sql).toContain('ALTER TABLE analysis_jobs ADD COLUMN domain_id');
    expect(sql).toContain('ALTER TABLE analysis_jobs ADD COLUMN metadata');
  });
});
```

- [ ] **Step 2 — run, expect fail:** `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/ensurePipelineTables.test.ts --ci` → FAIL (module not found).

- [ ] **Step 3 — implement** `lib/ensurePipelineTables.ts`:
```ts
import db from '../database/database';
import { ensureArticlesTables } from './ensureArticlesTables';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const JSON_T = isPostgres ? 'JSONB' : 'TEXT';
const NOW = 'CURRENT_TIMESTAMP';

/** Domain-pipeline tables + analysis_jobs columns for domain-level jobs. */
export async function ensurePipelineTables(): Promise<void> {
   if (checked) return;
   await ensureArticlesTables(); // analysis_jobs must already exist

   // analysis_jobs is now a shared job table — nullable article_id, generic domain_id + metadata.
   try { await db.query('ALTER TABLE analysis_jobs ADD COLUMN domain_id INTEGER'); } catch { /* exists */ }
   try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN metadata ${JSON_T}`); } catch { /* exists */ }
   // article_id was NOT NULL; new domain jobs leave it null. SQLite can't drop NOT NULL in place,
   // but INSERTs that omit it fail only if a NOT NULL constraint is enforced — domain INSERTs supply
   // article_id = NULL explicitly; on Postgres drop the constraint, on SQLite it's tolerated for new rows
   // created via our code path (we always pass NULL). Best-effort drop on Postgres:
   if (isPostgres) { try { await db.query('ALTER TABLE analysis_jobs ALTER COLUMN article_id DROP NOT NULL'); } catch { /* ok */ } }

   await db.query(`CREATE TABLE IF NOT EXISTS domain_gsc_pages (
      id ${PK}, domain_id INTEGER NOT NULL, url TEXT NOT NULL,
      clicks INTEGER DEFAULT 0, impressions INTEGER DEFAULT 0, position REAL,
      captured_at TIMESTAMP DEFAULT ${NOW})`);
   await db.query(`CREATE TABLE IF NOT EXISTS domain_keywords (
      id ${PK}, domain_id INTEGER NOT NULL, keyword TEXT NOT NULL, source TEXT,
      volume INTEGER, position REAL, topic_id INTEGER, created_at TIMESTAMP DEFAULT ${NOW})`);
   await db.query(`CREATE TABLE IF NOT EXISTS domain_topics (
      id ${PK}, domain_id INTEGER NOT NULL, title TEXT NOT NULL, summary TEXT,
      created_at TIMESTAMP DEFAULT ${NOW})`);
   await db.query(`CREATE TABLE IF NOT EXISTS domain_competitors (
      id ${PK}, domain_id INTEGER NOT NULL, competitor_domain TEXT NOT NULL,
      appearances INTEGER DEFAULT 0, avg_position REAL, created_at TIMESTAMP DEFAULT ${NOW})`);
   await db.query(`CREATE TABLE IF NOT EXISTS domain_recommendations (
      id ${PK}, domain_id INTEGER NOT NULL, topic_id INTEGER, title TEXT NOT NULL,
      rationale TEXT, priority TEXT, type TEXT, created_at TIMESTAMP DEFAULT ${NOW})`);

   for (const t of ['domain_gsc_pages','domain_keywords','domain_topics','domain_competitors','domain_recommendations']) {
      try { await db.query(`CREATE INDEX IF NOT EXISTS idx_${t}_domain ON ${t}(domain_id)`); } catch { /* ok */ }
   }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_jobs_domain_type ON analysis_jobs(domain_id, job_type)'); } catch { /* ok */ }

   checked = true;
}
```

- [ ] **Step 4 — run, expect pass:** `npx jest __tests__/lib/ensurePipelineTables.test.ts --ci` → PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5 — commit:**
```bash
cd /c/Users/patry/Desktop/serpbear && git add lib/ensurePipelineTables.ts __tests__/lib/ensurePipelineTables.test.ts && git commit -m "feat(pipeline): domain pipeline schema + analysis_jobs columns" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 — Node orchestration (`lib/domainPipeline.ts` + endpoints)

**Files:** Create `lib/domainPipeline.ts`, `pages/api/domains/[id]/setup-status.ts`, `pages/api/domains/[id]/run-setup.ts`; Modify `pages/api/articles/job-progress.ts`, `pages/api/workspaces/[id]/finish.ts`; Tests `__tests__/lib/domainPipeline.test.ts`, `__tests__/api/setup-status.test.ts`.

### 2A — `lib/domainPipeline.ts` core logic

- [ ] **Step 1 — failing test** (`__tests__/lib/domainPipeline.test.ts`) covering the four pure-logic invariants:
```ts
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), transaction: jest.fn() } }));
jest.mock('../../lib/ensurePipelineTables', () => ({ ensurePipelineTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT', UPDATE: 'UPDATE' } }));
import db from '../../database/database';
import { deriveStages, enqueueDomainSetup, claimJob, materializeDomainSetup } from '../../lib/domainPipeline';
const mockQuery = db.query as jest.Mock;
const sel = (r: unknown[]) => r;            // SELECT returns rows directly
beforeEach(() => { mockQuery.mockReset(); });

describe('deriveStages', () => {
  it('marks stages before current=done, current=running, after=pending', () => {
    expect(deriveStages('running', 'topics', 40)).toEqual({
      stages: { gsc: 'done', keywords: 'done', topics: 'running', competitors: 'pending', recommendations: 'pending' },
      stagePercent: 40,
    });
  });
  it('all done when status=done', () => {
    expect(deriveStages('done', 'recommendations', 100).stages.recommendations).toBe('done');
    expect(deriveStages('done', null, 0).stages.gsc).toBe('done');
  });
});

describe('enqueueDomainSetup', () => {
  it('does not create a second job when one already exists', async () => {
    mockQuery.mockResolvedValueOnce(sel([{ id: 'job_x', status: 'running' }])); // existing lookup
    const id = await enqueueDomainSetup(99);
    expect(id).toBe('job_x');
    // only the lookup ran — no INSERT
    expect(mockQuery.mock.calls.every((c: any[]) => !String(c[0]).includes('INSERT INTO analysis_jobs'))).toBe(true);
  });
  it('inserts a queued job when none exists', async () => {
    mockQuery.mockResolvedValueOnce(sel([]));   // lookup → none
    mockQuery.mockResolvedValueOnce([[], {}]);  // INSERT
    const id = await enqueueDomainSetup(99);
    expect(id).toMatch(/^dsetup_99_/);
    expect(String(mockQuery.mock.calls[1][0])).toContain('INSERT INTO analysis_jobs');
  });
});

describe('claimJob', () => {
  it('aborts when SELECT-back shows another locker', async () => {
    mockQuery.mockResolvedValueOnce([[], {}]);                              // UPDATE claim
    mockQuery.mockResolvedValueOnce(sel([{ status: 'running', locked_by: 'other' }])); // SELECT-back
    expect(await claimJob('job_x', 'me')).toBe(false);
  });
  it('succeeds when SELECT-back shows our token', async () => {
    mockQuery.mockResolvedValueOnce([[], {}]);
    mockQuery.mockResolvedValueOnce(sel([{ status: 'running', locked_by: 'me' }]));
    expect(await claimJob('job_x', 'me')).toBe(true);
  });
});

describe('materializeDomainSetup', () => {
  it('deletes existing rows before inserting, inside a transaction', async () => {
    const tx = {};
    (db.transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx));
    mockQuery.mockResolvedValue([[], {}]);
    await materializeDomainSetup(99, { keywords: [{ keyword: 'k', source: 'gsc' }], topics: [], competitors: [], recommendations: [] });
    const sqls = mockQuery.mock.calls.map((c: any[]) => String(c[0]));
    const firstInsertIdx = sqls.findIndex((s) => s.includes('INSERT INTO domain_keywords'));
    const deleteIdx = sqls.findIndex((s) => s.includes('DELETE FROM domain_keywords'));
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(deleteIdx).toBeLessThan(firstInsertIdx); // delete before insert
    expect((db.transaction as jest.Mock)).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 — run, expect fail.**

- [ ] **Step 3 — implement** `lib/domainPipeline.ts`. (GSC fetch + sidecar call live here; mirror `pages/api/gsc/pages.ts` for the GSC client and `pages/api/articles/deep-analysis.ts` for the sidecar fetch + claim.)
```ts
import { QueryTypes } from 'sequelize';
import db from '../database/database';
import { ensurePipelineTables } from './ensurePipelineTables';

export type StageKey = 'gsc' | 'keywords' | 'topics' | 'competitors' | 'recommendations';
export const STAGE_ORDER: StageKey[] = ['gsc', 'keywords', 'topics', 'competitors', 'recommendations'];
const STALE_MS = 10 * 60 * 1000;

type DomainResult = {
   keywords: { keyword: string; source: string; volume?: number; position?: number }[];
   topics: { title: string; summary?: string }[];
   competitors: { competitor_domain: string; appearances?: number; avg_position?: number }[];
   recommendations: { title: string; rationale?: string; priority?: string; type?: string; topic_index?: number }[];
};

/** Pure: maps job status/current_stage to the 5-row UI map + active stagePercent. */
export function deriveStages(status: string, currentStage: string | null, stagePercent: number) {
   const done = status === 'done';
   const curIdx = currentStage ? STAGE_ORDER.indexOf(currentStage as StageKey) : -1;
   const stages = {} as Record<StageKey, 'pending' | 'running' | 'done'>;
   STAGE_ORDER.forEach((k, i) => {
      if (done) stages[k] = 'done';
      else if (i < curIdx) stages[k] = 'done';
      else if (i === curIdx) stages[k] = 'running';
      else stages[k] = 'pending';
   });
   return { stages, stagePercent: done ? 100 : stagePercent };
}

async function selectRows<T = any>(sql: string, repl: any[]): Promise<T[]> {
   return db.query<T>(sql, { replacements: repl, type: QueryTypes.SELECT });
}

/** Idempotent: returns the existing live/done job id, else inserts a queued one. */
export async function enqueueDomainSetup(domainId: number): Promise<string> {
   await ensurePipelineTables();
   const existing = await selectRows<{ id: string; status: string }>(
      `SELECT id, status FROM analysis_jobs WHERE domain_id = ? AND job_type = 'domain_setup'
       AND status IN ('queued','running','done') ORDER BY created_at DESC LIMIT 1`, [domainId]);
   if (existing.length) return existing[0].id;
   const jobId = `dsetup_${domainId}_${Date.now()}`;
   await db.query(
      `INSERT INTO analysis_jobs (id, article_id, domain_id, job_type, status, created_at, updated_at)
       VALUES (?, NULL, ?, 'domain_setup', 'queued', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      { replacements: [jobId, domainId] });
   return jobId;
}

/** Atomic claim: conditional UPDATE + dialect-safe SELECT-back. true only if we own it. */
export async function claimJob(jobId: string, token: string): Promise<boolean> {
   const staleCutoffIso = new Date(Date.now() - STALE_MS).toISOString();
   await db.query(
      `UPDATE analysis_jobs
         SET status='running', locked_at=CURRENT_TIMESTAMP, locked_by=?, attempts=attempts+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND attempts < max_attempts
         AND (status IN ('queued','failed') OR (status='running' AND locked_at < ?))`,
      { replacements: [token, jobId, staleCutoffIso] });
   const back = await selectRows<{ status: string; locked_by: string }>(
      `SELECT status, locked_by FROM analysis_jobs WHERE id = ?`, [jobId]);
   return back.length > 0 && back[0].status === 'running' && back[0].locked_by === token;
}

/** Single materialization point — one transaction, delete-first, then insert. */
export async function materializeDomainSetup(domainId: number, result: DomainResult): Promise<void> {
   await db.transaction(async (tx) => {
      const q = (sql: string, repl: any[]) => db.query(sql, { replacements: repl, transaction: tx });
      for (const t of ['domain_keywords', 'domain_topics', 'domain_competitors', 'domain_recommendations']) {
         await q(`DELETE FROM ${t} WHERE domain_id = ?`, [domainId]);
      }
      const topicIds: number[] = [];
      for (const t of result.topics || []) {
         await q(`INSERT INTO domain_topics (domain_id, title, summary, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`, [domainId, t.title, t.summary || '']);
         const back = await db.query<{ id: number }>(`SELECT id FROM domain_topics WHERE domain_id = ? ORDER BY id DESC LIMIT 1`, { replacements: [domainId], type: QueryTypes.SELECT, transaction: tx });
         topicIds.push(back[0]?.id ?? 0);
      }
      for (const k of result.keywords || [])
         await q(`INSERT INTO domain_keywords (domain_id, keyword, source, volume, position, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [domainId, k.keyword, k.source || 'suggest', k.volume ?? null, k.position ?? null]);
      for (const c of result.competitors || [])
         await q(`INSERT INTO domain_competitors (domain_id, competitor_domain, appearances, avg_position, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`, [domainId, c.competitor_domain, c.appearances ?? 0, c.avg_position ?? null]);
      for (const r of result.recommendations || [])
         await q(`INSERT INTO domain_recommendations (domain_id, topic_id, title, rationale, priority, type, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [domainId, r.topic_index != null ? topicIds[r.topic_index] ?? null : null, r.title, r.rationale || '', r.priority || 'medium', r.type || 'content']);
   });
}
```

- [ ] **Step 4 — add the orchestration runner to `lib/domainPipeline.ts`** (GSC stage + seed fallback + kick). This part is integration-heavy; mirror `pages/api/gsc/pages.ts` (GSC client/query) and `deep-analysis.ts` (sidecar fetch). No unit test (live calls) — covered by manual verification.
```ts
import GscAccount from '../database/models/gscAccount';
import { buildOAuthClientFromAccount } from './gscAccounts';
import { searchconsole_v1 } from '@googleapis/searchconsole';

const sidecarBase = () => process.env.PYTHON_SIDECAR_URL || process.env.SIDECAR_URL || 'http://127.0.0.1:8000';
const selfUrl = () => process.env.NEXTJS_URL || 'http://127.0.0.1:3000';

async function emit(jobId: string, stage: StageKey, percent: number, message: string) {
   try {
      await fetch(`${selfUrl()}/api/articles/job-progress`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' },
         body: JSON.stringify({ jobId, currentStage: stage, stageProgress: percent, totalProgress: Math.round((STAGE_ORDER.indexOf(stage) * 100 + percent) / STAGE_ORDER.length), message }),
      });
   } catch { /* progress is best-effort */ }
}

async function failJob(jobId: string, stage: StageKey, message: string) {
   await db.query(`UPDATE analysis_jobs SET status='failed', current_stage=?, error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, { replacements: [stage, message, jobId] });
}

/** Stage 1 (Node): GSC fetch + seed fallback. Returns seed keywords + the domain string. */
async function gscStageAndSeeds(jobId: string, domainId: number): Promise<string[]> {
   await emit(jobId, 'gsc', 10, 'Getting Search Console and site data');
   // Resolve domain + userId from the domain row.
   const drows = await selectRows<{ domain: string; userId: string }>(`SELECT domain, "userId" FROM domain WHERE ID = ? OR id = ? LIMIT 1`, [domainId, domainId]);
   const domainName = drows[0]?.domain || '';
   const userId = drows[0]?.userId || '';
   let seeds: string[] = [];
   try {
      const accounts = (await GscAccount.findAll({ where: { userId } })).map((a) => a.get({ plain: true }));
      for (const acc of accounts) {
         try {
            const client = new searchconsole_v1.Searchconsole({ auth: buildOAuthClientFromAccount(acc) });
            const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30);
            const fmt = (d: Date) => d.toISOString().slice(0, 10);
            // try both URL-prefix and sc-domain property forms
            for (const siteUrl of [`https://${domainName}/`, `sc-domain:${domainName}`]) {
               try {
                  const r = await client.searchanalytics.query({ siteUrl, requestBody: { startDate: fmt(start), endDate: fmt(end), dimensions: ['query'], rowLimit: 50 } });
                  const rows = r.data.rows || [];
                  if (rows.length) {
                     seeds = rows.map((x) => (x.keys || [])[0]).filter(Boolean) as string[];
                     // persist GSC pages too (best-effort, not blocking)
                     break;
                  }
               } catch { /* try next form */ }
            }
            if (seeds.length) break;
         } catch { /* try next account */ }
      }
   } catch { /* GSC optional */ }
   if (!seeds.length) {
      // Fallback: site_context title/description, then brand_knowledge.
      const ctx = await selectRows<{ title: string; description: string }>(`SELECT title, description FROM site_context WHERE domain_id = ? LIMIT 1`, [domainId]);
      const bk = await selectRows<{ brand_knowledge: string }>(`SELECT brand_knowledge FROM domain WHERE ID = ? OR id = ? LIMIT 1`, [domainId, domainId]);
      const text = [ctx[0]?.title, ctx[0]?.description, (bk[0]?.brand_knowledge || '').slice(0, 400)].filter(Boolean).join(' ');
      seeds = text ? [domainName.split('.')[0], ...text.split(/[^a-zA-Z0-9ąćęłńóśźż]+/).filter((w) => w.length > 4)].slice(0, 8) : [domainName.split('.')[0]];
   }
   await emit(jobId, 'gsc', 100, 'Search Console and site data ready');
   return Array.from(new Set(seeds)).slice(0, 30);
}

/** Fire-and-forget runner. Claims, runs GSC, calls sidecar; sidecar finishes via job-progress 'done'. */
export async function kickDomainSetup(jobId: string): Promise<void> {
   const token = `nextjs_${process.pid || 'x'}_${Date.now()}`;
   if (!(await claimJob(jobId, token))) return; // someone else owns it / exhausted
   const jrows = await selectRows<{ domain_id: number; payload: string }>(`SELECT domain_id, payload FROM analysis_jobs WHERE id = ?`, [jobId]);
   const domainId = Number(jrows[0]?.domain_id);
   if (!domainId) { await failJob(jobId, 'gsc', 'missing domain_id'); return; }
   try {
      const seedKeywords = await gscStageAndSeeds(jobId, domainId);
      const drows = await selectRows<{ domain: string; brand_knowledge: string }>(`SELECT domain, brand_knowledge FROM domain WHERE ID = ? OR id = ? LIMIT 1`, [domainId, domainId]);
      const body = { jobId, nextjsUrl: selfUrl(), payload: { domainId, domain: drows[0]?.domain || '', seedKeywords, brandKnowledge: drows[0]?.brand_knowledge || '', limits: { keywords: 20, competitorsPerKeyword: 10 } } };
      const resp = await fetch(`${sidecarBase()}/pipeline/domain-setup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!resp.ok) await failJob(jobId, 'keywords', `sidecar ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
      // On success the sidecar will POST status='done' + result to job-progress, which materializes.
   } catch (e: any) {
      await failJob(jobId, 'gsc', e?.message || 'pipeline error');
   }
}

/** For setup-status: latest domain_setup job + derived stages. */
export async function getSetupStatus(domainId: number) {
   await ensurePipelineTables();
   const rows = await selectRows<{ status: string; current_stage: string | null; stage_progress: number | null; error: string | null }>(
      `SELECT status, current_stage, stage_progress, error FROM analysis_jobs
       WHERE domain_id = ? AND job_type = 'domain_setup' ORDER BY created_at DESC LIMIT 1`, [domainId]);
   if (!rows.length) return { status: 'none' as const, currentStage: null, stagePercent: 0, stages: deriveStages('none', null, 0).stages, error: null };
   const j = rows[0];
   const d = deriveStages(j.status, j.current_stage, j.stage_progress ?? 0);
   return { status: j.status, currentStage: j.current_stage, stagePercent: d.stagePercent, stages: d.stages, error: j.error };
}
```
> NOTE: confirm `db.transaction` exists on the Sequelize instance exported by `database/database`. If `db` is the Sequelize instance, `db.transaction(cb)` is the managed-transaction API. If `database/database` exports something else, adapt (the test mocks `db.transaction`). Verify before implementing and adjust the materialize signature accordingly.

- [ ] **Step 5 — run unit tests, expect pass:** `npx jest __tests__/lib/domainPipeline.test.ts --ci` → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 6 — commit** `lib/domainPipeline.ts __tests__/lib/domainPipeline.test.ts` — `feat(pipeline): domain orchestration (enqueue, atomic claim, GSC seeds, materialize)`.

### 2B — endpoints + job-progress + finish wiring

- [ ] **Step 7 — `pages/api/domains/[id]/setup-status.ts`** (GET):
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../../utils/getUser';
import { getAccessibleWorkspaceIds } from '../../../../lib/tenancy';
import { getSetupStatus } from '../../../../lib/domainPipeline';
import db from '../../../../database/database';
import { QueryTypes } from 'sequelize';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });
   if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
   const domainId = Number(req.query.id);
   if (!Number.isFinite(domainId)) return res.status(400).json({ error: 'Invalid domain id' });
   // access check: the domain's workspace must be accessible to the caller
   const drows = await db.query<{ workspace_id: number }>(`SELECT workspace_id FROM domain WHERE ID = ? OR id = ? LIMIT 1`, { replacements: [domainId, domainId], type: QueryTypes.SELECT });
   const accessible = await getAccessibleWorkspaceIds(userId);
   if (!drows.length || !accessible.includes(Number(drows[0].workspace_id))) return res.status(404).json({ error: 'Not found' });
   return res.status(200).json(await getSetupStatus(domainId));
}
```
(Verify import depth `../../../../` against an existing `pages/api/domains/[id]/*.ts` or `pages/api/articles/[id]/*.ts` route; match it.)

- [ ] **Step 8 — `pages/api/domains/[id]/run-setup.ts`** (POST, idempotent kick/recovery): same auth+access block as Step 7, then:
```ts
   const jobId = await enqueueDomainSetup(domainId);
   void kickDomainSetup(jobId); // fire-and-forget; claim guards double-run
   return res.status(202).json({ jobId });
```
(import `enqueueDomainSetup, kickDomainSetup` from `lib/domainPipeline`.)

- [ ] **Step 9 — extend `pages/api/articles/job-progress.ts`** POST to accept `status` + `result` and materialize on `domain_setup` done. Change the POST body destructure to `{ jobId, currentStage, stageProgress, totalProgress, message, status, result }` and replace the single UPDATE with:
```ts
   if (status === 'done' || status === 'failed') {
      // terminal callback
      const jrows = await db.query<{ job_type: string; domain_id: number | null }>(
         `SELECT job_type, domain_id FROM analysis_jobs WHERE id = ?`, { replacements: [jobId], type: QueryTypes.SELECT });
      const jt = jrows[0]?.job_type; const domainId = jrows[0]?.domain_id;
      if (status === 'done' && jt === 'domain_setup' && domainId) {
         const { materializeDomainSetup } = await import('../../../lib/domainPipeline');
         await materializeDomainSetup(Number(domainId), result || {});
      }
      await db.query(
         `UPDATE analysis_jobs SET status = ?, result = COALESCE(?, result), error = ?, total_progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
         { replacements: [status, result ? JSON.stringify(result) : null, status === 'failed' ? (message || 'failed') : null, status === 'done' ? 100 : null, jobId] });
      return res.status(200).json({ ok: true });
   }
   // ...existing 'running' progress UPDATE unchanged...
```
Mark the job `done` ONLY after `materializeDomainSetup` resolves (the await above guarantees order; if it throws, the catch returns 500 and the job stays non-done → Retry re-runs).

- [ ] **Step 10 — extend `pages/api/workspaces/[id]/finish.ts`** to enqueue + kick after `finishWorkspaceSetup`. After the successful `finishWorkspaceSetup(...)` call, before responding:
```ts
   // resolve the workspace's domain, then enqueue + kick the setup pipeline (best-effort)
   try {
      const { default: db } = await import('../../../../database/database');
      const { QueryTypes } = await import('sequelize');
      const drows = await db.query<{ id: number }>(`SELECT ID as id FROM domain WHERE workspace_id = ? LIMIT 1`, { replacements: [wsId], type: QueryTypes.SELECT });
      const domainId = drows[0]?.id;
      if (domainId) {
         const { enqueueDomainSetup, kickDomainSetup } = await import('../../../../lib/domainPipeline');
         const jobId = await enqueueDomainSetup(Number(domainId));
         void kickDomainSetup(jobId);
      }
   } catch { /* pipeline kickoff is best-effort; dashboard fallback covers it */ }
   return res.status(200).json({ ok: true });
```
(Use the `domain` PK column form that matches the codebase — `ID` vs `id`; check `pages/api/domains/configure.ts`. The `SELECT ID as id` aliases it.)

- [ ] **Step 11 — endpoint test** (`__tests__/api/setup-status.test.ts`): mock `getCurrentUserId`→'u1', `getAccessibleWorkspaceIds`→[5], `db.query` for the domain row (`workspace_id:5`), and `getSetupStatus`. Assert: 401 unauth; 404 when domain's workspace not accessible; 200 returns the status object for an accessible domain. Mock `lib/domainPipeline`'s `getSetupStatus`.

- [ ] **Step 12 — verify + commit:** `npx jest __tests__/api/setup-status.test.ts --ci` PASS; `npx tsc --noEmit` clean. Commit `pages/api/domains/[id]/setup-status.ts pages/api/domains/[id]/run-setup.ts pages/api/articles/job-progress.ts pages/api/workspaces/[id]/finish.ts __tests__/api/setup-status.test.ts` — `feat(pipeline): setup-status + run-setup endpoints, job-progress materialize, finish kickoff`.

---

## Task 3 — Sidecar pipeline (`/pipeline/domain-setup` + 4 stages)

**Files:** Create `python-sidecar/pipeline/stages/domain/__init__.py`, `keywords.py`, `topics.py`, `competitors.py`, `recommendations.py`, `python-sidecar/pipeline/domain_runner.py`; Modify `python-sidecar/main.py`.

> Read `python-sidecar/pipeline/runner.py`, `pipeline/contracts.py`, `pipeline/stages/scrape_serp.py` (SERP/`analyze_serp` reuse), and an LLM-using analyzer (e.g. `analyzers/ai_visibility.py` or `content_classifier.py`) to mirror the existing LLM call pattern. Match the project's existing LLM client + model usage — do NOT introduce a new LLM SDK.

- [ ] **Step 1 — stage contracts.** Each stage subclasses `AnalysisStage` (name, `progress_weight`, `run`, `can_skip`) and calls `await ctx.emit_progress(self, percent, msg)` at intra-stage milestones. Weights sum to 1.0 across the 4 sidecar stages (GSC is Node-side; the sidecar pipeline = keywords .2, topics .2, competitors .4, recommendations .2). Stage I/O via `ctx.payload` + `ctx.get_state/set_state`:
  - **`KeywordsStage`** (`keywords.py`, weight .2): input `payload['seedKeywords']`; expand each seed via Google Suggest (reuse the existing Suggest helper used by `keyword-suggest`; if none in sidecar, call the public `https://suggestqueries.google.com/complete/search?client=firefox&q=<seed>` with 3× retry/backoff); dedupe → top `limits['keywords']` (20). Emit 10/40/70/100. `set_state('keywords', [{keyword, source:'gsc'|'suggest'}])`.
  - **`TopicsStage`** (`topics.py`, weight .2): 1 LLM call clustering the keyword list into 4–8 topics. Prompt: "Group these keywords into 4–8 SEO topic clusters for the domain {domain}. Return JSON: [{title, summary, keyword_indexes:[..]}]." Parse JSON defensively (retry once on parse failure). Emit 20/100. `set_state('topics', [...])` and attach `topic_index` back onto keywords.
  - **`CompetitorsStage`** (`competitors.py`, weight .4): for the top N keywords (cap to ~8 to respect the lean budget), call the existing `analyze_serp(keyword)` (reuse `analyzers/serp_analyzer.py`), collect competitor domains, aggregate `appearances` + `avg_position` across keywords, keep top by appearances (~10). Emit progress per keyword processed (e.g. `int(i/total*100)`), with 3× retry per SERP call. `set_state('competitors', [...])`.
  - **`RecommendationsStage`** (`recommendations.py`, weight .2): 1 LLM call over topics + competitor coverage + brandKnowledge. Prompt: "Given these topics {topics}, competitors {competitors}, and brand {brandKnowledge}, produce 5–10 prioritized content recommendations. JSON: [{title, rationale, priority:high|medium|low, type, topic_index}]." Parse defensively. Emit 30/100. `set_state('recommendations', [...])`.

- [ ] **Step 2 — `domain_runner.py`**: mirror `runner.py`'s `PipelineRunner`. Add a builder `build_domain_setup_pipeline()` returning `[KeywordsStage(), TopicsStage(), CompetitorsStage(), RecommendationsStage()]`, and a `build_domain_ctx(jobId, payload, nextjs_url)`. After `runner.run()`, assemble the final `result = { keywords, topics, competitors, recommendations }` from `ctx` state. Add a module-level async `post_terminal(nextjs_url, job_id, status, result=None, error=None)` that POSTs to `/api/articles/job-progress` with `{jobId, status, result, message}` + the `x-internal-token` header (mirror `contracts.emit_progress`'s client/headers).

- [ ] **Step 3 — wrap stages with per-stage timeout.** In the domain runner's loop, run each stage under `asyncio.wait_for(stage.run(ctx), timeout=TIMEOUTS[stage.name])` with `TIMEOUTS = {'keywords':120,'topics':300,'competitors':600,'recommendations':300}`. On `asyncio.TimeoutError` or any exception → `await post_terminal(nextjs_url, job_id, 'failed', error=f'{stage.name} {type(exc).__name__}')` and stop.

- [ ] **Step 4 — `main.py` endpoint**:
```python
class DomainSetupRequest(BaseModel):
    jobId: str
    nextjsUrl: str = ""
    payload: dict

@app.post("/pipeline/domain-setup")
async def pipeline_domain_setup(req: DomainSetupRequest):
    """Async domain pipeline: runs stages, pushes progress + a terminal done/failed
    callback to /api/articles/job-progress. Returns immediately-ish; Node does not
    depend on the response body (it materializes from the terminal callback)."""
    import asyncio
    from pipeline.domain_runner import run_domain_setup
    nextjs_url = req.nextjsUrl or os.getenv("NEXTJS_URL", "http://127.0.0.1:3000")
    asyncio.create_task(run_domain_setup(req.jobId, req.payload, nextjs_url))
    return {"status": "accepted"}
```
where `run_domain_setup(jobId, payload, nextjs_url)` (in `domain_runner.py`) executes the timeout-wrapped pipeline and calls `post_terminal('done', result)` or `post_terminal('failed', error=...)`. (`asyncio.create_task` keeps the work alive after the HTTP response — the sidecar is a long-lived process; matches the async-background decision.)

- [ ] **Step 5 — manual verify** (no pytest harness assumed; if `python-sidecar/tests` exists, add stage unit tests mocking LLM/SERP there). Start the sidecar, `curl -X POST localhost:8000/pipeline/domain-setup -d '{"jobId":"t1","nextjsUrl":"","payload":{"domain":"example.com","seedKeywords":["coco coir"],"brandKnowledge":"","limits":{"keywords":20,"competitorsPerKeyword":10}}}' -H 'Content-Type: application/json'` → expect `{"status":"accepted"}` and progress logs for the 4 stages (with `nextjsUrl:""` it prints progress instead of POSTing).

- [ ] **Step 6 — commit** the sidecar files — `feat(sidecar): domain-setup pipeline (keywords, topics, competitors, recommendations)`.

---

## Task 4 — Dashboard loader + pages

**Files:** Create `components/dashboard/SetupPipeline.tsx`, `services/domainPipeline.tsx`; Modify `pages/dashboard/index.tsx`, `pages/sites/[domain]/recommendations.tsx`, `pages/sites/[domain]/topical-map.tsx`; Create `pages/api/domains/[id]/recommendations.ts`, `pages/api/domains/[id]/topics.ts`.

- [ ] **Step 1 — `services/domainPipeline.tsx`** (adaptive polling):
```tsx
import { useMutation, useQuery } from 'react-query';

export type StageState = 'pending' | 'running' | 'done';
export type SetupStatus = {
   status: 'none' | 'queued' | 'running' | 'done' | 'failed';
   currentStage: string | null; stagePercent: number;
   stages: Record<'gsc'|'keywords'|'topics'|'competitors'|'recommendations', StageState>;
   error: string | null;
};

export function useSetupStatus(domainId: number | null | undefined) {
   return useQuery<SetupStatus>(['setup-status', domainId], async () => {
      const r = await fetch(`/api/domains/${domainId}/setup-status`);
      return r.json();
   }, {
      enabled: !!domainId,
      refetchInterval: (data) => (data?.status === 'running' ? 2000 : data?.status === 'queued' ? 5000 : false),
   });
}
export function useRunSetup() {
   return useMutation((domainId: number) => fetch(`/api/domains/${domainId}/run-setup`, { method: 'POST' }).then((r) => r.json()));
}
```

- [ ] **Step 2 — `components/dashboard/SetupPipeline.tsx`** — 5-row loader, Surfer copy, inline styles + `var(--font-family-primary)` per CLAUDE.md §6. Rows in `STAGE_ORDER` with labels:
```
gsc: 'Getting Search Console and site data'
keywords: 'Extracting and expanding keywords'
topics: 'Clustering and modeling topics'
competitors: 'Analyzing competitors and coverage'
recommendations: 'Getting and evaluating recommendations'
```
Each row: a leading status glyph — `done` → check (#1AB25E), `running` → spinner (CSS `@keyframes spin`; show `stagePercent`% text), `pending` → hollow circle (#D4D4D8) — and the label (muted #52525C when pending, #18181B otherwise). Props: `{ stages, stagePercent, status, error, onRetry }`. On `status==='failed'` show the `error` + a "Retry" button calling `onRetry`. Card: `border:1px solid #F4F4F5; border-radius:12; background:#fff; padding:24` centered, max-width 520.

- [ ] **Step 3 — wire `pages/dashboard/index.tsx`.** Resolve the active domainId (the dashboard already resolves the active domain — reuse it; map active workspace → its domain). Add:
```tsx
const { data: setup } = useSetupStatus(activeDomainId);
const runSetup = useRunSetup();
React.useEffect(() => {
   // fallback kick: a domain with no job at all
   if (setup && setup.status === 'none' && activeDomainId) runSetup.mutate(activeDomainId);
}, [setup?.status, activeDomainId]);
const pipelineActive = setup && (setup.status === 'queued' || setup.status === 'running' || setup.status === 'failed');
```
When `pipelineActive`, render `<SetupPipeline {...setup} onRetry={() => runSetup.mutate(activeDomainId)} />` INSTEAD of the normal dashboard body (keep the topbar/shell). On transition to `done`, react-query's stop + the normal body renders; invalidate the dashboard data queries (`queryClient.invalidateQueries('dashboardArticles')` etc.) in an effect when `setup.status` becomes `done` so freshly-materialized data loads.

- [ ] **Step 4 — list endpoints.** `pages/api/domains/[id]/recommendations.ts` + `topics.ts` (GET): same auth+access block as setup-status (Task 2 Step 7), then `SELECT * FROM domain_recommendations WHERE domain_id = ? ORDER BY priority, id` (map priority high<medium<low) / `SELECT * FROM domain_topics WHERE domain_id = ? ORDER BY id`. Return `{ recommendations: [...] }` / `{ topics: [...] }`.

- [ ] **Step 5 — minimal wiring of `recommendations.tsx` + `topical-map.tsx`.** Replace the "Coming soon" placeholders: fetch the new list endpoint for the page's domainId and render a simple list (recommendations: title + priority chip + rationale; topics: title + summary). Keep the existing page chrome/layout; only swap the placeholder body. If the list is empty AND a setup job is running, show the same `<SetupPipeline>`-style hint or a skeleton (per the "skeletons not empty states" rule) rather than a blank "nothing here".

- [ ] **Step 6 — verify + commit.** `npx tsc --noEmit` clean. Manual: create a workspace → dashboard shows the 5-row loader advancing → on done shows populated dashboard; recommendations/topical-map list the materialized rows. Commit the T4 files — `feat(dashboard): domain setup pipeline loader + recommendations/topics wiring`.

---

## Final review (after all tasks)
Dispatch a final code-reviewer over the whole P3c diff (opus): focus on (1) the atomic-claim race (can two kicks both proceed?), (2) materialize transaction correctness + delete-first, (3) job-progress terminal handling (done only after materialize), (4) access control on the new domain endpoints, (5) the `domain` PK column form (`ID` vs `id`) used consistently, (6) the sidecar `asyncio.create_task` survives the response and always posts a terminal callback (even on exception). Then run `graphify update .`.

## Self-Review (plan vs spec)
- Async background + polling → T3 `asyncio.create_task` + T4 adaptive `refetchInterval`. ✅
- Finish enqueues + dashboard idempotent guard → T2 Step 10 + T4 Step 3 fallback. ✅
- Atomic claim → T2 `claimJob` (conditional UPDATE + SELECT-back) + test. ✅
- Transactional delete-first materialize → T2 `materializeDomainSetup` + test. ✅
- Queued/stale recovery → `claimJob` stale-running clause + `run-setup` + dashboard poll. ✅
- Seed fallback chain → T2 `gscStageAndSeeds`. ✅
- Per-stage timeouts + per-call 3× retry → T3 Steps 1+3. ✅
- Intra-stage 0–100 progress → T3 `emit_progress` per milestone + `setup-status` `stagePercent` + T4 row %. ✅
- analysis_jobs `domain_id`+`metadata`, nullable article_id → T1. ✅
- Lean envelope (20 kw / ~10 competitors / 2 LLM) → T3 limits. ✅
- Materialize single point on done → T2 Step 9. ✅
- recommendations + topical-map minimal wiring → T4 Steps 4–5. ✅
- Out of scope (per-stage reveal, manual re-analyze, rich topical-map) → not in any task. ✅
