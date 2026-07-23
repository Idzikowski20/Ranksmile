import db from '../database/database';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const JSON_T = isPostgres ? 'JSONB' : 'TEXT';
const NOW = 'CURRENT_TIMESTAMP';

function ignoreExisting(label: string, e: unknown): void {
  const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
  if (!/exist|duplicate|already/i.test(m)) console.warn(`[pipeline-jobs] ${label} failed:`, m);
}

/** Durable job registry for BullMQ / in-memory queue (v7 Platform Foundation). */
export async function ensurePipelineJobsTables(): Promise<void> {
  if (checked) return;

  await db
    .query(
      `CREATE TABLE IF NOT EXISTS pipeline_jobs (
      id ${PK},
      job_key TEXT NOT NULL,
      queue_name TEXT NOT NULL,
      pipeline_version TEXT NOT NULL,
      worker_version TEXT,
      attempt INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      started_at TIMESTAMP,
      finished_at TIMESTAMP,
      worker TEXT,
      estimated_cost REAL,
      actual_cost REAL,
      cache_hit INTEGER DEFAULT 0,
      corpus_version INTEGER,
      snapshot_id TEXT,
      payload ${JSON_T},
      result ${JSON_T},
      error TEXT,
      dlq_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT ${NOW}
    )`,
    )
    .catch((e) => ignoreExisting('pipeline_jobs', e));

  await db
    .query(`CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_key ON pipeline_jobs (job_key, status)`)
    .catch((e) => ignoreExisting('idx_pipeline_jobs_key', e));

  await db
    .query(`CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_status ON pipeline_jobs (status, created_at)`)
    .catch((e) => ignoreExisting('idx_pipeline_jobs_status', e));

  await db
    .query(
      `CREATE TABLE IF NOT EXISTS pipeline_cost_events (
      id ${PK},
      job_key TEXT,
      workspace_id TEXT,
      keyword TEXT,
      job_type TEXT,
      provider TEXT,
      estimated_cost REAL,
      actual_cost REAL,
      cache_hit INTEGER DEFAULT 0,
      duration_ms INTEGER,
      meta ${JSON_T},
      created_at TIMESTAMP DEFAULT ${NOW}
    )`,
    )
    .catch((e) => ignoreExisting('pipeline_cost_events', e));

  checked = true;
}

export type PipelineJobRow = {
  id?: number;
  job_key: string;
  queue_name: string;
  pipeline_version: string;
  worker_version?: string | null;
  attempt?: number;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  worker?: string | null;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  cache_hit?: boolean;
  corpus_version?: number | null;
  snapshot_id?: string | null;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: string | null;
  dlq_at?: string | null;
};

export async function insertPipelineJob(row: PipelineJobRow): Promise<number> {
  await ensurePipelineJobsTables();
  const payload = JSON.stringify(row.payload ?? {});
  const [result] = await db.query(
    `INSERT INTO pipeline_jobs
      (job_key, queue_name, pipeline_version, worker_version, attempt, status, worker,
       estimated_cost, cache_hit, corpus_version, snapshot_id, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      replacements: [
        row.job_key,
        row.queue_name,
        row.pipeline_version,
        row.worker_version ?? null,
        row.attempt ?? 0,
        row.status,
        row.worker ?? null,
        row.estimated_cost ?? null,
        row.cache_hit ? 1 : 0,
        row.corpus_version ?? null,
        row.snapshot_id ?? null,
        payload,
      ],
    },
  );
  const insertId = (result as { insertId?: number } | undefined)?.insertId;
  if (typeof insertId === 'number') return insertId;
  const [rows] = await db.query(`SELECT id FROM pipeline_jobs WHERE job_key = ? ORDER BY id DESC LIMIT 1`, {
    replacements: [row.job_key],
  });
  const list = rows as Array<{ id: number }>;
  return list[0]?.id ?? 0;
}

export async function findActiveJobByKey(jobKey: string): Promise<PipelineJobRow | null> {
  await ensurePipelineJobsTables();
  const [rows] = await db.query(
    `SELECT * FROM pipeline_jobs WHERE job_key = ? AND status IN ('queued','running','done')
     ORDER BY id DESC LIMIT 1`,
    { replacements: [jobKey] },
  );
  const list = rows as Array<Record<string, unknown>>;
  if (!list[0]) return null;
  const r = list[0];
  const finished = r.finished_at ? new Date(String(r.finished_at)).getTime() : 0;
  const created = r.created_at ? new Date(String(r.created_at)).getTime() : 0;
  // Join fresh done jobs within 5 minutes
  if (r.status === 'done' && finished && Date.now() - finished > 5 * 60 * 1000) return null;
  // Stale queued/running (Redis wipe / dead worker) — allow a fresh enqueue
  if (
    (r.status === 'queued' || r.status === 'running') &&
    created &&
    Date.now() - created > 2 * 60 * 1000
  ) {
    return null;
  }
  return {
    id: Number(r.id),
    job_key: String(r.job_key),
    queue_name: String(r.queue_name),
    pipeline_version: String(r.pipeline_version),
    worker_version: r.worker_version != null ? String(r.worker_version) : null,
    attempt: Number(r.attempt ?? 0),
    status: String(r.status),
    snapshot_id: r.snapshot_id != null ? String(r.snapshot_id) : null,
    corpus_version: r.corpus_version != null ? Number(r.corpus_version) : null,
    result:
      typeof r.result === 'string'
        ? (JSON.parse(r.result) as Record<string, unknown>)
        : (r.result as Record<string, unknown> | null),
  };
}

/** Queued rows still waiting — used by workers to reclaim after Redis restart. */
export async function listQueuedPipelineJobs(limit = 50): Promise<
  Array<{ id: number; jobKey: string; queue: string; payload: Record<string, unknown> }>
> {
  await ensurePipelineJobsTables();
  // Bind LIMIT as an integer literal — some PG/Sequelize paths mishandle LIMIT ?.
  const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 50)));
  const [rows] = await db.query(
    `SELECT id, job_key, queue_name, payload FROM pipeline_jobs
     WHERE status = 'queued'
     ORDER BY id ASC
     LIMIT ${safeLimit}`,
  );
  return (rows as Array<Record<string, unknown>>).map((r) => {
    let payload: Record<string, unknown> = {};
    if (typeof r.payload === 'string') {
      try {
        payload = JSON.parse(r.payload) as Record<string, unknown>;
      } catch {
        payload = {};
      }
    } else if (r.payload && typeof r.payload === 'object') {
      payload = r.payload as Record<string, unknown>;
    }
    return {
      id: Number(r.id),
      jobKey: String(r.job_key),
      queue: String(r.queue_name),
      payload,
    };
  });
}

/**
 * Orphans after Redis wipe: queued forever with never started_at.
 * Default threshold 2 minutes (matches findActiveJobByKey stale window).
 */
export async function expireStaleQueuedJobs(olderThanMs = 2 * 60 * 1000): Promise<number> {
  await ensurePipelineJobsTables();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const [rows] = await db.query(
    `SELECT id FROM pipeline_jobs
     WHERE status = 'queued'
       AND started_at IS NULL
       AND created_at < ?
     ORDER BY id ASC
     LIMIT 100`,
    { replacements: [cutoff] },
  );
  const ids = (rows as Array<{ id: number }>).map((r) => Number(r.id));
  for (const id of ids) {
    await moveJobToDlq(id, 'stale orphan: never started (Redis wipe / worker miss)');
  }
  return ids.length;
}

export async function updatePipelineJob(
  id: number,
  patch: Partial<PipelineJobRow> & { status?: string },
): Promise<void> {
  await ensurePipelineJobsTables();
  const sets: string[] = [];
  const vals: unknown[] = [];
  const map: Array<[keyof PipelineJobRow, string]> = [
    ['status', 'status'],
    ['attempt', 'attempt'],
    ['started_at', 'started_at'],
    ['finished_at', 'finished_at'],
    ['worker', 'worker'],
    ['actual_cost', 'actual_cost'],
    ['estimated_cost', 'estimated_cost'],
    ['cache_hit', 'cache_hit'],
    ['corpus_version', 'corpus_version'],
    ['snapshot_id', 'snapshot_id'],
    ['error', 'error'],
    ['dlq_at', 'dlq_at'],
    ['worker_version', 'worker_version'],
  ];
  for (const [key, col] of map) {
    if (patch[key] === undefined) continue;
    sets.push(`${col} = ?`);
    if (key === 'cache_hit') vals.push(patch.cache_hit ? 1 : 0);
    else vals.push(patch[key]);
  }
  if (patch.result !== undefined) {
    sets.push('result = ?');
    vals.push(JSON.stringify(patch.result));
  }
  if (!sets.length) return;
  vals.push(id);
  await db.query(`UPDATE pipeline_jobs SET ${sets.join(', ')} WHERE id = ?`, { replacements: vals });
}

export async function moveJobToDlq(id: number, error: string): Promise<void> {
  await updatePipelineJob(id, {
    status: 'dlq',
    error,
    dlq_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
  });
}
