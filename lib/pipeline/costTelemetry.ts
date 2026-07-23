/**
 * Cost telemetry helpers — estimated_cost before, actual_cost after.
 */
import db from '../../database/database';
import { ensurePipelineJobsTables } from '../ensurePipelineJobsTables';

export async function recordJobCostEstimate(opts: {
  jobKey: string;
  workspaceId?: string;
  keyword?: string;
  jobType: string;
  estimatedCost: number;
}): Promise<void> {
  await ensurePipelineJobsTables();
  await db.query(
    `INSERT INTO pipeline_cost_events
      (job_key, workspace_id, keyword, job_type, provider, estimated_cost, actual_cost, cache_hit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      replacements: [
        opts.jobKey,
        opts.workspaceId ?? null,
        opts.keyword ?? null,
        opts.jobType,
        'estimate',
        opts.estimatedCost,
        null,
        0,
      ],
    },
  );
}

export async function recordJobCostActual(opts: {
  jobKey: string;
  workspaceId?: string;
  keyword?: string;
  jobType: string;
  estimatedCost?: number;
  actualCost: number;
  cacheHit?: boolean;
  durationMs?: number;
}): Promise<void> {
  await ensurePipelineJobsTables();
  await db.query(
    `INSERT INTO pipeline_cost_events
      (job_key, workspace_id, keyword, job_type, provider, estimated_cost, actual_cost, cache_hit, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      replacements: [
        opts.jobKey,
        opts.workspaceId ?? null,
        opts.keyword ?? null,
        opts.jobType,
        'worker',
        opts.estimatedCost ?? null,
        opts.actualCost,
        opts.cacheHit ? 1 : 0,
        opts.durationMs ?? null,
      ],
    },
  );
}

/** Sum actual costs for a workspace (planner cheap-vs-expensive paths). */
export async function sumActualCost(workspaceId: string, sinceIso?: string): Promise<number> {
  await ensurePipelineJobsTables();
  const [rows] = await db.query(
    sinceIso
      ? `SELECT COALESCE(SUM(actual_cost), 0) AS total FROM pipeline_cost_events
         WHERE workspace_id = ? AND created_at >= ?`
      : `SELECT COALESCE(SUM(actual_cost), 0) AS total FROM pipeline_cost_events
         WHERE workspace_id = ?`,
    {
      replacements: sinceIso ? [workspaceId, sinceIso] : [workspaceId],
    },
  );
  const list = rows as Array<{ total: number }>;
  return Number(list[0]?.total ?? 0);
}
