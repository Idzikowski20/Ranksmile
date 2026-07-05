/**
 * Audit tool runner. Small counterpart to lib/aiVisibilityScan.ts:
 *   enqueueAudit(domainId, url, keyword) — upsert one `queued` audit_runs row (idempotent
 *      per (domain,url,keyword) via the unique index), return its id.
 *   processQueuedForDomain(domainId, budgetMs) — drain queued rows for a domain, running
 *      computeAudit per row, until none remain or the time budget is spent.
 * The API run.ts route is the client-driven worker that calls processQueuedForDomain.
 */
import db from '../database/database';
import { queryOne } from './db/query';
import { computeAudit } from './auditCompute';
import { enrichAudit } from './auditEnrich';
import { getErrorMessage } from './errors';

const isPg = !!process.env.DATABASE_URL;
// A `running` row older than this is treated as a crashed compute and re-queued.
const STALE_SECS = 5 * 60;

/**
 * Normalise Sequelize's affected-row count across dialects (Postgres returns the pg
 * result object `{ rowCount }`; sqlite/mysql a plain number). Mirrors lib/aiVisibilityScan.
 */
const affectedRows = (out: unknown): number => {
   const meta = Array.isArray(out) ? (out as unknown[])[1] : undefined;
   if (typeof meta === 'number') return meta;
   if (meta && typeof meta === 'object' && 'rowCount' in meta) {
      return Number((meta as { rowCount?: unknown }).rowCount) || 0;
   }
   return 0;
};

// Shared UPSERT body — re-queue an existing (domain,url,keyword) audit instead of
// inserting a duplicate, so retries are idempotent (the unique index is the conflict target).
const ON_CONFLICT = `ON CONFLICT (domain_id, url, keyword) DO UPDATE SET
   status = 'queued', result_json = NULL, content_score = NULL, error = NULL,
   progress_done = 0, progress_total = 1, started_at = NULL, finished_at = NULL,
   created_at = CURRENT_TIMESTAMP`;

export async function enqueueAudit(domainId: number, url: string, keyword: string): Promise<number> {
   const values = "VALUES (?, ?, ?, 'queued', 0, 1)";
   if (isPg) {
      const created = await queryOne<{ id: number }>(
         `INSERT INTO audit_runs (domain_id, url, keyword, status, progress_done, progress_total) ${values} ${ON_CONFLICT} RETURNING id`,
         [domainId, url, keyword],
      );
      if (!created) throw new Error('Failed to enqueue audit');
      return created.id;
   }
   await db.query(
      `INSERT INTO audit_runs (domain_id, url, keyword, status, progress_done, progress_total) ${values} ${ON_CONFLICT}`,
      { replacements: [domainId, url, keyword] },
   );
   const created = await queryOne<{ id: number }>(
      'SELECT id FROM audit_runs WHERE domain_id = ? AND url = ? AND keyword = ? LIMIT 1',
      [domainId, url, keyword],
   );
   if (!created) throw new Error('Failed to enqueue audit');
   return created.id;
}

export async function processQueuedForDomain(domainId: number, budgetMs = 45000): Promise<number> {
   const deadline = Date.now() + budgetMs;
   let processed = 0;

   // Reclaim crashed runs (compute died mid-flight) so they retry instead of hanging
   // in `running` forever. Dialect-specific age math (STALE_SECS is a constant → safe).
   await db.query(
      isPg
         ? `UPDATE audit_runs SET status = 'queued', started_at = NULL
             WHERE domain_id = ? AND status = 'running' AND started_at < NOW() - INTERVAL '${STALE_SECS} seconds'`
         : `UPDATE audit_runs SET status = 'queued', started_at = NULL
             WHERE domain_id = ? AND status = 'running' AND started_at < datetime('now', '-${STALE_SECS} seconds')`,
      { replacements: [domainId] },
   ).catch(() => { /* best-effort reclaim */ });

   // Bounded backstop mirrors kickAiVisScan; the deadline is the real loop guard.
   for (let i = 0; i < 100000; i += 1) {
      if (Date.now() >= deadline) break;
      const candidate = await queryOne<{ id: number; url: string; keyword: string }>(
         "SELECT id, url, keyword FROM audit_runs WHERE domain_id = ? AND status = 'queued' ORDER BY id ASC LIMIT 1",
         [domainId],
      );
      if (!candidate) break;

      // Atomic claim: only the worker whose UPDATE flips queued→running proceeds, so
      // two concurrent workers never compute the same row twice.
      const claim = await db.query(
         "UPDATE audit_runs SET status = 'running', started_at = CURRENT_TIMESTAMP, progress_done = 0, progress_total = 1 WHERE id = ? AND status = 'queued'",
         { replacements: [candidate.id] },
      );
      if (affectedRows(claim) === 0) continue; // lost the race — another worker owns it

      // One bad audit must not abort the batch — record the failure and move on.
      try {
         const result = await computeAudit(
            candidate.url, candidate.keyword,
            (u, k) => enrichAudit(domainId, u, k), // real competitor bars + ranges + terms (phase 2)
         );
         await db.query(
            "UPDATE audit_runs SET status = 'completed', result_json = ?, content_score = ?, progress_done = 1, progress_total = 1, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
            { replacements: [JSON.stringify(result), result.contentScore, candidate.id] },
         );
      } catch (e) {
         await db.query(
            "UPDATE audit_runs SET status = 'failed', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
            { replacements: [getErrorMessage(e), candidate.id] },
         ).catch(() => { /* best effort */ });
      }
      processed += 1;
   }
   return processed;
}
