/**
 * Audit tool runner. Small counterpart to lib/aiVisibilityScan.ts:
 *   enqueueAudit(domainId, url, keyword) — write one `queued` audit_runs row, return its id
 *   processQueuedForDomain(domainId, budgetMs) — drain queued/running rows for a domain,
 *      running computeAudit per row, until none remain or the time budget is spent.
 * The API run.ts route is the client-driven worker that calls processQueuedForDomain.
 */
import db from '../database/database';
import { queryOne, AuditRunRow } from './db/query';
import { computeAudit } from './auditCompute';
import { getErrorMessage } from './errors';

export async function enqueueAudit(domainId: number, url: string, keyword: string): Promise<number> {
   // Insert-then-get-id idiom (mirrors enqueueAiVisScan): Postgres supports RETURNING id;
   // the sqlite fallback re-reads the newest row for this (domain, url, keyword).
   const isPg = !!process.env.DATABASE_URL;
   if (isPg) {
      const created = await queryOne<{ id: number }>(
         "INSERT INTO audit_runs (domain_id, url, keyword, status, progress_done, progress_total) VALUES (?, ?, ?, 'queued', 0, 1) RETURNING id",
         [domainId, url, keyword],
      );
      if (!created) throw new Error('Failed to enqueue audit');
      return created.id;
   }
   await db.query(
      "INSERT INTO audit_runs (domain_id, url, keyword, status, progress_done, progress_total) VALUES (?, ?, ?, 'queued', 0, 1)",
      { replacements: [domainId, url, keyword] },
   );
   const created = await queryOne<{ id: number }>(
      'SELECT id FROM audit_runs WHERE domain_id = ? AND url = ? AND keyword = ? ORDER BY id DESC LIMIT 1',
      [domainId, url, keyword],
   );
   if (!created) throw new Error('Failed to enqueue audit');
   return created.id;
}

export async function processQueuedForDomain(domainId: number, budgetMs = 45000): Promise<number> {
   const deadline = Date.now() + budgetMs;
   let processed = 0;
   // Bounded backstop mirrors kickAiVisScan; the deadline is the real loop guard.
   for (let i = 0; i < 100000; i += 1) {
      if (Date.now() >= deadline) break;
      const run = await queryOne<AuditRunRow>(
         "SELECT * FROM audit_runs WHERE domain_id = ? AND status IN ('queued','running') ORDER BY id ASC LIMIT 1",
         [domainId],
      );
      if (!run) break;

      await db.query(
         "UPDATE audit_runs SET status = 'running', started_at = CURRENT_TIMESTAMP, progress_done = 0, progress_total = 1 WHERE id = ?",
         { replacements: [run.id] },
      );

      // One bad audit must not abort the batch — record the failure and move on.
      try {
         const result = await computeAudit(run.url, run.keyword);
         await db.query(
            "UPDATE audit_runs SET status = 'completed', result_json = ?, content_score = ?, progress_done = 1, progress_total = 1, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
            { replacements: [JSON.stringify(result), result.contentScore, run.id] },
         );
      } catch (e) {
         await db.query(
            "UPDATE audit_runs SET status = 'failed', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
            { replacements: [getErrorMessage(e), run.id] },
         ).catch(() => { /* best effort */ });
      }
      processed += 1;
   }
   return processed;
}
