import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import {
  ensurePipelineJobsTables,
  expireStaleQueuedJobs,
} from '../../../lib/ensurePipelineJobsTables';
import db from '../../../database/database';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

type JobPublic = {
  id: number;
  jobKey: string;
  queue: string;
  status: string;
  worker: string | null;
  attempt: number;
  cacheHit: boolean;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
};

/**
 * GET /api/pipeline/jobs?articleId=123
 * Recent v7 pipeline jobs for an article (status strip / polling).
 */
async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    res.status(401).json({ error: authorized });
    return;
  }

  const articleId = Number(req.query.articleId);
  if (!articleId || Number.isNaN(articleId)) {
    res.status(400).json({ error: 'articleId required' });
    return;
  }

  await ensurePipelineJobsTables();
  // Drop orphans that never left "queued" (Redis wipe / worker miss) so the strip can clear.
  await expireStaleQueuedJobs();
  const isPostgres = !!process.env.DATABASE_URL;

  // Postgres stores payload as JSONB — LIKE (~~) only works on text.
  // Prefer JSON operators on PG; CAST+LIKE keeps SQLite TEXT working.
  const [rows] = isPostgres
    ? await db.query(
        `SELECT id, job_key, queue_name, status, worker, attempt, cache_hit, error,
                created_at, finished_at, estimated_cost, actual_cost, payload
         FROM pipeline_jobs
         WHERE payload @> ?::jsonb OR payload @> ?::jsonb
            OR (payload->>'articleId') = ?
         ORDER BY id DESC
         LIMIT 20`,
        {
          replacements: [
            JSON.stringify({ articleId }),
            JSON.stringify({ articleId: String(articleId) }),
            String(articleId),
          ],
        },
      )
    : await db.query(
        `SELECT id, job_key, queue_name, status, worker, attempt, cache_hit, error,
                created_at, finished_at, estimated_cost, actual_cost, payload
         FROM pipeline_jobs
         WHERE CAST(payload AS TEXT) LIKE ? OR CAST(payload AS TEXT) LIKE ?
         ORDER BY id DESC
         LIMIT 20`,
        {
          replacements: [`%"articleId":${articleId}%`, `%"articleId":"${articleId}"%`],
        },
      );

  const list: JobPublic[] = (rows as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    jobKey: String(r.job_key),
    queue: String(r.queue_name),
    status: String(r.status),
    worker: r.worker != null ? String(r.worker) : null,
    attempt: Number(r.attempt ?? 0),
    cacheHit: !!r.cache_hit,
    error: r.error != null ? String(r.error) : null,
    createdAt: String(r.created_at),
    finishedAt: r.finished_at != null ? String(r.finished_at) : null,
    estimatedCost: r.estimated_cost != null ? Number(r.estimated_cost) : null,
    actualCost: r.actual_cost != null ? Number(r.actual_cost) : null,
  }));

  const active = list.filter((j) => {
    if (j.status !== 'queued' && j.status !== 'running') return false;
    // Hide stale queued (never started) from the strip even if expire hasn't run yet.
    if (j.status === 'queued' && !j.finishedAt) {
      const age = Date.now() - new Date(j.createdAt).getTime();
      if (age > 2 * 60 * 1000) return false;
    }
    return true;
  });
  const latest = list.find((j) => j.status === 'queued' || j.status === 'running') || list[0] || null;

  res.status(200).json({
    activeCount: active.length,
    latest,
    jobs: list,
  });
}

export default withOrgPaymentAccess(handler);
