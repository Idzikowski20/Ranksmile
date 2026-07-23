import type { QueueName } from '../pipeline/queuePriorities';

/**
 * Pipeline worker contract.
 * LLM calls MUST go through `lib/llmGateway` — never OpenAI/Anthropic/DeepSeek directly.
 */

export type WorkerRetryPolicy = {
  maxAttempts: number;
  backoffMs: number;
};

export type WorkerContext = {
  jobId: number;
  jobKey: string;
  payload: Record<string, unknown>;
  attempt: number;
  pipelineVersion: string;
  workerVersion: string;
};

export type WorkerResult = {
  ok: boolean;
  cacheHit?: boolean;
  actualCost?: number;
  estimatedCost?: number;
  corpusVersion?: number;
  snapshotId?: string;
  result?: Record<string, unknown>;
  error?: string;
  /** Next queue to enqueue (linear Etap 0 chain). */
  nextQueue?: QueueName;
  nextPayload?: Record<string, unknown>;
};

export type PipelineWorker = {
  id: string;
  queue: QueueName;
  workerVersion: string;
  retryPolicy: WorkerRetryPolicy;
  costEstimate: (payload: Record<string, unknown>) => number;
  produces: string[];
  consumes: string[];
  execute: (ctx: WorkerContext) => Promise<WorkerResult>;
};
