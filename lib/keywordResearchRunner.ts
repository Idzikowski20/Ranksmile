/**
 * Keyword Research runner — mirrors lib/topicResearchRunner.ts but drains its own
 * keyword_research_runs queue. The heavy keyword-expansion + clustering logic is
 * reused from topicResearchRunner.computeTopicResearch (identical result shape).
 */
import db from '../database/database';
import { queryOne } from './db/query';
import { getErrorMessage } from './errors';
import { isQueueRunnerEnabled } from './featureFlags';
import {
  affectedRows,
  enqueueQueueRun,
  processQueueForDomain,
  type QueueRunnerConfig,
} from './queueRunner';
import { computeTopicResearch } from './topicResearchRunner';

const isPg = !!process.env.DATABASE_URL;
const STALE_SECS = 5 * 60;

const ON_CONFLICT = `ON CONFLICT (domain_id, seed, country) DO UPDATE SET
   status = 'queued', result_json = NULL, stats_json = NULL, error = NULL,
   progress_done = 0, progress_total = 1,
   started_at = NULL, finished_at = NULL, created_at = CURRENT_TIMESTAMP
   WHERE keyword_research_runs.status <> 'running'`;

const KEYWORD_QUEUE: QueueRunnerConfig = {
  table: 'keyword_research_runs',
  onConflict: ON_CONFLICT,
  staleSecs: STALE_SECS,
  runJob: async (row, domainHost) => {
    const { result, stats } = await computeTopicResearch(row.seed, row.country, domainHost);
    return { resultJson: JSON.stringify(result), statsJson: JSON.stringify(stats) };
  },
};

export async function enqueueKeywordResearch(domainId: number, seed: string, country: string): Promise<number> {
   if (isQueueRunnerEnabled()) {
      return enqueueQueueRun(KEYWORD_QUEUE, domainId, seed, country);
   }
   const cols = 'domain_id, seed, country, status, progress_done, progress_total';
   const values = "VALUES (?, ?, ?, 'queued', 0, 1)";
   const repl = [domainId, seed.trim(), country.toUpperCase()];
   if (isPg) {
      const created = await queryOne<{ id: number }>(
         `INSERT INTO keyword_research_runs (${cols}) ${values} ${ON_CONFLICT} RETURNING id`,
         repl,
      );
      if (created) return created.id;
      const existing = await queryOne<{ id: number }>(
         'SELECT id FROM keyword_research_runs WHERE domain_id = ? AND seed = ? AND country = ? LIMIT 1',
         repl,
      );
      if (!existing) throw new Error('Failed to enqueue keyword research');
      return existing.id;
   }
   await db.query(
      `INSERT INTO keyword_research_runs (${cols}) ${values} ${ON_CONFLICT}`,
      { replacements: repl },
   );
   const created = await queryOne<{ id: number }>(
      'SELECT id FROM keyword_research_runs WHERE domain_id = ? AND seed = ? AND country = ? LIMIT 1',
      [domainId, seed.trim(), country.toUpperCase()],
   );
   if (!created) throw new Error('Failed to enqueue keyword research');
   return created.id;
}

export async function processQueuedForDomain(domainId: number, budgetMs = 45000): Promise<number> {
   if (isQueueRunnerEnabled()) {
      const n = await processQueueForDomain(KEYWORD_QUEUE, domainId, budgetMs);
      return Math.max(0, n);
   }

   const deadline = Date.now() + budgetMs;
   let processed = 0;

   await db.query(
      isPg
         ? `UPDATE keyword_research_runs SET status = 'queued', started_at = NULL
             WHERE domain_id = ? AND status = 'running' AND started_at < NOW() - INTERVAL '${STALE_SECS} seconds'`
         : `UPDATE keyword_research_runs SET status = 'queued', started_at = NULL
             WHERE domain_id = ? AND status = 'running' AND started_at < datetime('now', '-${STALE_SECS} seconds')`,
      { replacements: [domainId] },
   ).catch(() => { /* best-effort reclaim */ });

   const domainRow = await queryOne<{ domain: string }>(
      'SELECT domain FROM domain WHERE "ID" = ? LIMIT 1',
      [domainId],
   );
   const domainHost = domainRow?.domain ?? '';

   for (let i = 0; i < 100000; i += 1) {
      if (Date.now() >= deadline) break;
      const candidate = isPg
         ? await queryOne<{ id: number; seed: string; country: string }>(
            `UPDATE keyword_research_runs SET status = 'running', started_at = CURRENT_TIMESTAMP, progress_done = 0, progress_total = 1
             WHERE id = (
               SELECT id FROM keyword_research_runs
               WHERE domain_id = ? AND status = 'queued'
               ORDER BY id ASC LIMIT 1
               FOR UPDATE SKIP LOCKED
             )
             RETURNING id, seed, country`,
            [domainId],
         )
         : await queryOne<{ id: number; seed: string; country: string }>(
            "SELECT id, seed, country FROM keyword_research_runs WHERE domain_id = ? AND status = 'queued' ORDER BY id ASC LIMIT 1",
            [domainId],
         );
      if (!candidate) break;

      if (!isPg) {
         const claim = await db.query(
            "UPDATE keyword_research_runs SET status = 'running', started_at = CURRENT_TIMESTAMP, progress_done = 0, progress_total = 1 WHERE id = ? AND status = 'queued'",
            { replacements: [candidate.id] },
         );
         if (affectedRows(claim) === 0) continue;
      }

      try {
         const { result, stats } = await computeTopicResearch(candidate.seed, candidate.country, domainHost);
         await db.query(
            "UPDATE keyword_research_runs SET status = 'completed', result_json = ?, stats_json = ?, progress_done = 1, progress_total = 1, finished_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'running'",
            { replacements: [JSON.stringify(result), JSON.stringify(stats), candidate.id] },
         );
      } catch (e) {
         await db.query(
            "UPDATE keyword_research_runs SET status = 'failed', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'running'",
            { replacements: [getErrorMessage(e), candidate.id] },
         ).catch(() => { /* best effort */ });
      }
      processed += 1;
   }
   return processed;
}

