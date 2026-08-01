import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import db from '../database/database';
import { assertCronSecret } from './cronAuth';

export type CronRunStatus = 'ok' | 'error';

let cronLogChecked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';

async function ensureCronRunLogTable(): Promise<void> {
  if (cronLogChecked) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS cron_run_log (
      id ${PK},
      job_name TEXT NOT NULL,
      started_at ${isPostgres ? 'TIMESTAMPTZ' : 'TEXT'} NOT NULL,
      finished_at ${isPostgres ? 'TIMESTAMPTZ' : 'TEXT'},
      duration_ms INTEGER,
      status TEXT NOT NULL,
      error_message TEXT
    )
  `);
  try {
    await db.query(`
      CREATE INDEX IF NOT EXISTS cron_run_log_job_started_idx
        ON cron_run_log (job_name, started_at DESC)
    `);
  } catch {
    /* sqlite may not like DESC in index — ignore */
  }
  cronLogChecked = true;
}

async function recordRun(row: {
  jobName: string;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  status: CronRunStatus;
  errorMessage: string | null;
}): Promise<void> {
  try {
    await ensureCronRunLogTable();
    await db.query(
      `INSERT INTO cron_run_log (job_name, started_at, finished_at, duration_ms, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          row.jobName,
          row.startedAt.toISOString(),
          row.finishedAt.toISOString(),
          row.durationMs,
          row.status,
          row.errorMessage,
        ],
      },
    );
  } catch (e) {
    console.error('[cronWatchdog] failed to persist run', row.jobName, e);
  }
}

/**
 * Wraps a cron handler: CRON_SECRET gate + started/finished/duration/status logging.
 * Inner handler must not re-check the secret.
 */
export function withCronWatchdog(jobName: string, handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (!assertCronSecret(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const startedAt = new Date();
    const t0 = Date.now();

    try {
      await handler(req, res);
      const code = res.statusCode || 200;
      await recordRun({
        jobName,
        startedAt,
        finishedAt: new Date(),
        durationMs: Date.now() - t0,
        status: code >= 400 ? 'error' : 'ok',
        errorMessage: code >= 400 ? `HTTP ${code}` : null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await recordRun({
        jobName,
        startedAt,
        finishedAt: new Date(),
        durationMs: Date.now() - t0,
        status: 'error',
        errorMessage: msg,
      });
      if (!res.headersSent) {
        return res.status(500).json({ error: msg });
      }
    }
  };
}

export type CronHealthRow = {
  job_name: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  status: string;
  error_message: string | null;
};

export async function latestCronRuns(): Promise<CronHealthRow[]> {
  await ensureCronRunLogTable();
  if (process.env.DATABASE_URL) {
    const [rows] = await db.query(`
      SELECT DISTINCT ON (job_name)
        job_name, started_at, finished_at, duration_ms, status, error_message
      FROM cron_run_log
      ORDER BY job_name, started_at DESC
    `) as [CronHealthRow[], unknown];
    return rows;
  }
  const [rows] = await db.query(`
    SELECT job_name, started_at, finished_at, duration_ms, status, error_message
    FROM cron_run_log
    WHERE id IN (SELECT MAX(id) FROM cron_run_log GROUP BY job_name)
  `) as [CronHealthRow[], unknown];
  return rows;
}
