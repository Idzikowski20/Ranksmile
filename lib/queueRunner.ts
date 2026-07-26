import db from '../database/database';
import { queryOne } from './db/query';
import { getErrorMessage } from './errors';
import { isQueueRunnerEnabled } from './featureFlags';

const isPg = !!process.env.DATABASE_URL;
const DEFAULT_STALE_SECS = 5 * 60;

export const affectedRows = (out: unknown): number => {
  const meta = Array.isArray(out) ? (out as unknown[])[1] : undefined;
  if (typeof meta === 'number') return meta;
  if (meta && typeof meta === 'object' && 'rowCount' in meta) {
    return Number((meta as { rowCount?: unknown }).rowCount) || 0;
  }
  return 0;
};

export type QueueRunRow = { id: number; seed: string; country: string };

export type QueueRunnerConfig = {
  table: string;
  onConflict: string;
  staleSecs?: number;
  runJob: (row: QueueRunRow, domainHost: string) => Promise<{ resultJson: string; statsJson: string }>;
};

async function resolveDomainHost(domainId: number): Promise<string> {
  const domainRow = await queryOne<{ domain: string }>(
    'SELECT domain FROM domain WHERE "ID" = ? LIMIT 1',
    [domainId],
  );
  return domainRow?.domain ?? '';
}

export async function enqueueQueueRun(
  config: QueueRunnerConfig,
  domainId: number,
  seed: string,
  country: string,
): Promise<number> {
  const cols = 'domain_id, seed, country, status, progress_done, progress_total';
  const values = "VALUES (?, ?, ?, 'queued', 0, 1)";
  const repl = [domainId, seed.trim(), country.toUpperCase()];
  if (isPg) {
    const created = await queryOne<{ id: number }>(
      `INSERT INTO ${config.table} (${cols}) ${values} ${config.onConflict} RETURNING id`,
      repl,
    );
    if (created) return created.id;
    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM ${config.table} WHERE domain_id = ? AND seed = ? AND country = ? LIMIT 1`,
      repl,
    );
    if (!existing) throw new Error(`Failed to enqueue ${config.table}`);
    return existing.id;
  }
  await db.query(
    `INSERT INTO ${config.table} (${cols}) ${values} ${config.onConflict}`,
    { replacements: repl },
  );
  const created = await queryOne<{ id: number }>(
    `SELECT id FROM ${config.table} WHERE domain_id = ? AND seed = ? AND country = ? LIMIT 1`,
    [domainId, seed.trim(), country.toUpperCase()],
  );
  if (!created) throw new Error(`Failed to enqueue ${config.table}`);
  return created.id;
}

async function claimNextQueued(config: QueueRunnerConfig, domainId: number): Promise<QueueRunRow | null> {
  if (isPg) {
    const claimed = await queryOne<QueueRunRow>(
      `UPDATE ${config.table} SET status = 'running', started_at = CURRENT_TIMESTAMP, progress_done = 0, progress_total = 1
       WHERE id = (
         SELECT id FROM ${config.table}
         WHERE domain_id = ? AND status = 'queued'
         ORDER BY id ASC LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, seed, country`,
      [domainId],
    );
    return claimed ?? null;
  }
  const candidate = await queryOne<QueueRunRow>(
    `SELECT id, seed, country FROM ${config.table} WHERE domain_id = ? AND status = 'queued' ORDER BY id ASC LIMIT 1`,
    [domainId],
  );
  if (!candidate) return null;
  const claim = await db.query(
    `UPDATE ${config.table} SET status = 'running', started_at = CURRENT_TIMESTAMP, progress_done = 0, progress_total = 1 WHERE id = ? AND status = 'queued'`,
    { replacements: [candidate.id] },
  );
  return affectedRows(claim) === 0 ? null : candidate;
}

export async function processQueueForDomain(
  config: QueueRunnerConfig,
  domainId: number,
  budgetMs = 45000,
): Promise<number> {
  if (!isQueueRunnerEnabled()) return -1;

  const staleSecs = config.staleSecs ?? DEFAULT_STALE_SECS;
  const deadline = Date.now() + budgetMs;
  let processed = 0;

  await db.query(
    isPg
      ? `UPDATE ${config.table} SET status = 'queued', started_at = NULL
         WHERE domain_id = ? AND status = 'running' AND started_at < NOW() - INTERVAL '${staleSecs} seconds'`
      : `UPDATE ${config.table} SET status = 'queued', started_at = NULL
         WHERE domain_id = ? AND status = 'running' AND started_at < datetime('now', '-${staleSecs} seconds')`,
    { replacements: [domainId] },
  ).catch(() => { /* best-effort reclaim */ });

  const domainHost = await resolveDomainHost(domainId);

  for (let i = 0; i < 100000; i += 1) {
    if (Date.now() >= deadline) break;
    const candidate = await claimNextQueued(config, domainId);
    if (!candidate) break;

    try {
      const { resultJson, statsJson } = await config.runJob(candidate, domainHost);
      await db.query(
        `UPDATE ${config.table} SET status = 'completed', result_json = ?, stats_json = ?, progress_done = 1, progress_total = 1, finished_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'running'`,
        { replacements: [resultJson, statsJson, candidate.id] },
      );
      if (config.table === 'keyword_research_runs') {
        const { settleKeywordResearchQuota } = await import('./quota/keywordResearch');
        await settleKeywordResearchQuota(domainId, candidate.id, 'commit').catch(() => {});
      }
    } catch (e) {
      await db.query(
        `UPDATE ${config.table} SET status = 'failed', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'running'`,
        { replacements: [getErrorMessage(e), candidate.id] },
      ).catch(() => { /* best effort */ });
      if (config.table === 'keyword_research_runs') {
        const { settleKeywordResearchQuota } = await import('./quota/keywordResearch');
        await settleKeywordResearchQuota(domainId, candidate.id, 'release').catch(() => {});
      }
    }
    processed += 1;
  }
  return processed;
}
