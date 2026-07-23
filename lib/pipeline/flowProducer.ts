/**
 * FlowProducer DAG — Etap 2+ ONLY.
 * Do NOT use for the Etap 0 two-step pipeline (serp → coverage).
 *
 * Correct BullMQ order (children before parent):
 *   deepest: serp runs first
 *   then parallel: fingerprint ∥ tfidf ∥ ner (as children of a fan-in parent)
 *   then coverage (root parent)
 *
 * Structure: coverage ← {fingerprint, tfidf, ner} ← each waits on shared serp via
 * sequential pre-enqueue of serp, then FlowProducer for parallel→coverage.
 * When FlowProducer unavailable: serp enqueue (chains coverage) + parallel force enqueue.
 */
import type { QueueName } from '../pipeline/queuePriorities';
import { QUEUE_PRIORITY, PIPELINE_VERSION } from '../pipeline/queuePriorities';
import { buildJobKey } from '../pipeline/jobKey';
import { enqueueJob } from '../pipeline/pipelineQueue';
import {
  getPipelineStage,
  isFlowProducerAllowed,
} from '../pipeline/pipelineStage';

export class FlowProducerStageError extends Error {
  readonly stage: string;

  constructor(stage: string) {
    super(
      `FlowProducer DAG requires PIPELINE_STAGE>=2 (current=${stage}). Use /api/pipeline/enqueue for Etap 0 serp→coverage.`,
    );
    this.name = 'FlowProducerStageError';
    this.stage = stage;
  }
}

export type AnalyzeDagOpts = {
  workspaceId: string;
  keyword: string;
  language?: string;
  country?: string;
  payload?: Record<string, unknown>;
};

export type AnalyzeDagResult = {
  mode: 'flow' | 'sequential';
  rootJobKey: string;
  children: QueueName[];
};

const PARALLEL: QueueName[] = ['fingerprint', 'tfidf', 'ner'];

/**
 * BullMQ: children complete before parent.
 * Tree: coverage (root) ← parallel branches ← each branch child = serp with SAME jobId (dedupe).
 * Deepest serp runs once (shared jobId), then fp∥tfidf∥ner, then coverage.
 */
async function tryFlowProducer(opts: AnalyzeDagOpts, rootJobKey: string): Promise<boolean> {
  const url = process.env.REDIS_URL || '';
  if (!url) return false;
  try {
    const { FlowProducer } = await import('bullmq');
    const flow = new FlowProducer({ connection: { url } });
    const basePayload = {
      ...(opts.payload || {}),
      workspaceId: opts.workspaceId,
      keyword: opts.keyword,
      language: opts.language || 'pl',
    };
    const serpJobId = `serp-${rootJobKey}`;

    await flow.add({
      name: 'coverage',
      queueName: 'surfy-coverage',
      data: basePayload,
      opts: { priority: QUEUE_PRIORITY.coverage, jobId: `cov-${rootJobKey}` },
      children: PARALLEL.map((q) => ({
        name: q,
        queueName: `surfy-${q}`,
        data: basePayload,
        opts: { priority: QUEUE_PRIORITY[q], jobId: `${q}-${rootJobKey}` },
        children: [
          {
            name: 'serp',
            queueName: 'surfy-serp_crawl',
            data: basePayload,
            opts: {
              priority: QUEUE_PRIORITY.serp_crawl,
              jobId: serpJobId,
            },
          },
        ],
      })),
    });
    await flow.close();
    return true;
  } catch (err: unknown) {
    console.warn('[flowProducer] unavailable, sequential fallback:', err);
    return false;
  }
}

/**
 * Kick analyze pipeline with DAG when possible.
 * Throws FlowProducerStageError if PIPELINE_STAGE < 2.
 */
export async function enqueueAnalyzeDag(opts: AnalyzeDagOpts): Promise<AnalyzeDagResult> {
  if (!isFlowProducerAllowed()) {
    throw new FlowProducerStageError(getPipelineStage());
  }

  const rootJobKey = buildJobKey({
    workspaceId: opts.workspaceId,
    keyword: opts.keyword,
    locale: opts.language,
    country: opts.country,
    jobType: 'analyze_dag',
    pipelineVersion: PIPELINE_VERSION,
  });

  const usedFlow = await tryFlowProducer(opts, rootJobKey);
  if (usedFlow) {
    return { mode: 'flow', rootJobKey, children: PARALLEL };
  }

  // Sequential: serp first (→ coverage via nextQueue); fan-out parallel after enqueue
  await enqueueJob({
    workspaceId: opts.workspaceId,
    keyword: opts.keyword,
    locale: opts.language,
    country: opts.country,
    queue: 'serp_crawl',
    payload: opts.payload || {},
  });

  for (const q of PARALLEL) {
    await enqueueJob({
      workspaceId: opts.workspaceId,
      keyword: opts.keyword,
      locale: opts.language,
      country: opts.country,
      queue: q,
      payload: opts.payload || {},
      force: true,
    });
  }

  return { mode: 'sequential', rootJobKey, children: PARALLEL };
}
