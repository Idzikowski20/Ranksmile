/**
 * Pipeline stage gate — unlock workers by PIPELINE_STAGE.
 *
 * Env: PIPELINE_STAGE = 0 | 0.5 | 1 | 1.5 | 2 | 2b | 3 | 4 | 5
 * Default: **5** (full mode — all workers registered).
 */

export type PipelineStageId = '0' | '0.5' | '1' | '1.5' | '2' | '2b' | '3' | '4' | '5';

const STAGE_ORDER: PipelineStageId[] = ['0', '0.5', '1', '1.5', '2', '2b', '3', '4', '5'];

/** Numeric rank for comparisons (2 and 2b share rank 2). */
const STAGE_RANK: Record<PipelineStageId, number> = {
  '0': 0,
  '0.5': 0.5,
  '1': 1,
  '1.5': 1.5,
  '2': 2,
  '2b': 2,
  '3': 3,
  '4': 4,
  '5': 5,
};

/** Minimum stage at which a worker id becomes available. */
export const WORKER_MIN_STAGE: Record<string, number> = {
  serp: 0,
  coverage: 0,
  live_score: 0,
  ner: 1.5,
  fingerprint: 2,
  tfidf: 2,
  planner: 2,
  visibility: 2,
  geo: 2,
  diff: 3,
  embeddings: 4,
};

export function parsePipelineStage(raw?: string | null): PipelineStageId {
  const v = (raw ?? process.env.PIPELINE_STAGE ?? '5').trim().toLowerCase();
  if (v === '2b') return '2b';
  if ((STAGE_ORDER as string[]).includes(v)) return v as PipelineStageId;
  const n = Number(v);
  if (!Number.isNaN(n)) {
    if (n >= 5) return '5';
    if (n >= 4) return '4';
    if (n >= 3) return '3';
    if (n >= 2) return '2';
    if (n >= 1.5) return '1.5';
    if (n >= 1) return '1';
    if (n >= 0.5) return '0.5';
  }
  return '5';
}

export function getPipelineStage(): PipelineStageId {
  return parsePipelineStage(process.env.PIPELINE_STAGE);
}

export function getPipelineStageRank(stage?: PipelineStageId): number {
  return STAGE_RANK[stage ?? getPipelineStage()];
}

/** True if current (or given) stage unlocks FlowProducer DAG (≥2). */
export function isFlowProducerAllowed(stage?: PipelineStageId): boolean {
  return getPipelineStageRank(stage) >= 2;
}

export function isWorkerAllowedAtStage(workerId: string, stage?: PipelineStageId): boolean {
  const min = WORKER_MIN_STAGE[workerId];
  if (min === undefined) return false;
  return getPipelineStageRank(stage) >= min;
}
