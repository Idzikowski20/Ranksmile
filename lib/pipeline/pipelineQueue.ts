import type { QueueName } from './queuePriorities';
import { PIPELINE_VERSION, QUEUE_PRIORITY } from './queuePriorities';
import { buildJobKey } from './jobKey';
import {
  findActiveJobByKey,
  insertPipelineJob,
  moveJobToDlq,
  updatePipelineJob,
} from '../ensurePipelineJobsTables';
import { getWorker } from '../workers/registry';
import { getPipelineStage } from './pipelineStage';

export class PipelineQueueDisabledError extends Error {
  readonly queue: string;
  readonly stage: string;

  constructor(queue: string, stage: string) {
    super(`Queue "${queue}" is not enabled at PIPELINE_STAGE=${stage}`);
    this.name = 'PipelineQueueDisabledError';
    this.queue = queue;
    this.stage = stage;
  }
}

export type EnqueueOpts = {
  workspaceId: string | number;
  keyword: string;
  locale?: string;
  country?: string;
  queue: QueueName;
  payload: Record<string, unknown>;
  estimatedCost?: number;
  /** Skip join-existing (force new). */
  force?: boolean;
};

export type EnqueueResult = {
  accepted: true;
  status: 202;
  jobKey: string;
  jobId: number;
  joinedExisting: boolean;
  queue: QueueName;
};

type MemoryJob = {
  id: number;
  queue: QueueName;
  jobKey: string;
  payload: Record<string, unknown>;
  priority: number;
};

const memoryQ: MemoryJob[] = [];
let memoryRunning = false;
let memoryIdSeq = 1;

async function runWorkerJob(opts: {
  dbJobId: number;
  queue: QueueName;
  jobKey: string;
  payload: Record<string, unknown>;
  attempt: number;
}): Promise<void> {
  const worker = getWorker(opts.queue);
  if (!worker) {
    await moveJobToDlq(opts.dbJobId, `no worker for queue ${opts.queue}`);
    return;
  }

  await updatePipelineJob(opts.dbJobId, {
    status: 'running',
    started_at: new Date().toISOString(),
    worker: worker.id,
    worker_version: worker.workerVersion,
    attempt: opts.attempt,
  });

  try {
    const result = await worker.execute({
      jobId: opts.dbJobId,
      jobKey: opts.jobKey,
      payload: opts.payload,
      attempt: opts.attempt,
      pipelineVersion: PIPELINE_VERSION,
      workerVersion: worker.workerVersion,
    });

    if (!result.ok) {
      const max = worker.retryPolicy.maxAttempts;
      if (opts.attempt + 1 < max) {
        await updatePipelineJob(opts.dbJobId, {
          status: 'queued',
          attempt: opts.attempt + 1,
          error: result.error,
        });
        setTimeout(() => {
          void runWorkerJob({
            ...opts,
            attempt: opts.attempt + 1,
          });
        }, worker.retryPolicy.backoffMs * 2 ** opts.attempt);
        return;
      }
      await moveJobToDlq(opts.dbJobId, result.error || 'worker failed');
      return;
    }

    await updatePipelineJob(opts.dbJobId, {
      status: 'done',
      finished_at: new Date().toISOString(),
      actual_cost: result.actualCost ?? null,
      estimated_cost: result.estimatedCost ?? null,
      cache_hit: !!result.cacheHit,
      corpus_version: result.corpusVersion ?? null,
      snapshot_id: result.snapshotId ?? null,
      result: result.result ?? null,
    });

    if (result.nextQueue) {
      try {
        await enqueueJob({
          workspaceId: String(opts.payload.workspaceId || '0'),
          keyword: String(opts.payload.keyword || ''),
          locale: opts.payload.language != null ? String(opts.payload.language) : undefined,
          queue: result.nextQueue,
          payload: result.nextPayload || opts.payload,
          force: true,
        });
      } catch (err: unknown) {
        if (err instanceof PipelineQueueDisabledError) {
          console.warn(
            `[pipelineQueue] skip nextQueue=${err.queue} (disabled at stage ${err.stage})`,
          );
        } else {
          throw err;
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const max = worker.retryPolicy.maxAttempts;
    if (opts.attempt + 1 < max) {
      await updatePipelineJob(opts.dbJobId, {
        status: 'queued',
        attempt: opts.attempt + 1,
        error: msg,
      });
      setTimeout(() => {
        void runWorkerJob({ ...opts, attempt: opts.attempt + 1 });
      }, worker.retryPolicy.backoffMs * 2 ** opts.attempt);
      return;
    }
    await moveJobToDlq(opts.dbJobId, msg);
  }
}

async function pumpMemory(): Promise<void> {
  if (memoryRunning) return;
  memoryRunning = true;
  try {
    while (memoryQ.length) {
      memoryQ.sort((a, b) => b.priority - a.priority);
      const job = memoryQ.shift();
      if (!job) break;
      await runWorkerJob({
        dbJobId: job.id,
        queue: job.queue,
        jobKey: job.jobKey,
        payload: job.payload,
        attempt: 0,
      });
    }
  } finally {
    memoryRunning = false;
  }
}

let bullmqReady: Promise<boolean> | null = null;

async function tryBullmqEnqueue(
  queue: QueueName,
  jobKey: string,
  payload: Record<string, unknown>,
  priority: number,
  dbJobId: number,
): Promise<boolean> {
  const url = process.env.REDIS_URL || '';
  if (!url) return false;
  try {
    const { Queue } = await import('bullmq');
    const q = new Queue(`surfy-${queue}`, { connection: { url } });
    // Unique BullMQ id per DB row — same jobKey + force:true must not collide after Redis wipe
    await q.add(
      queue,
      { jobKey, payload, dbJobId },
      { jobId: `${jobKey}-${dbJobId}`, priority, removeOnComplete: 100, removeOnFail: 50 },
    );
    await q.close();
    return true;
  } catch (err: unknown) {
    console.warn('[pipelineQueue] BullMQ unavailable, using memory:', err);
    return false;
  }
}

/**
 * Enqueue a pipeline job. Returns 202 semantics.
 * Joins existing active job with same job_key unless force.
 * Rejects queues not registered for current PIPELINE_STAGE.
 */
export async function enqueueJob(opts: EnqueueOpts): Promise<EnqueueResult> {
  const worker = getWorker(opts.queue);
  if (!worker) {
    throw new PipelineQueueDisabledError(opts.queue, getPipelineStage());
  }

  const jobKey = buildJobKey({
    workspaceId: opts.workspaceId,
    keyword: opts.keyword,
    locale: opts.locale,
    country: opts.country,
    jobType: opts.queue,
  });

  if (!opts.force) {
    const existing = await findActiveJobByKey(jobKey);
    if (existing?.id && (existing.status === 'queued' || existing.status === 'running')) {
      // Re-drive BullMQ — Redis may have been wiped while DB still says queued
      const payload = {
        ...opts.payload,
        workspaceId: opts.workspaceId,
        keyword: opts.keyword,
      };
      const usedBull = await tryBullmqEnqueue(
        opts.queue,
        jobKey,
        payload,
        QUEUE_PRIORITY[opts.queue] ?? 100,
        existing.id,
      );
      if (!usedBull || process.env.PIPELINE_INLINE_WORKERS !== '0') {
        void runWorkerJob({
          dbJobId: existing.id,
          queue: opts.queue,
          jobKey,
          payload,
          attempt: Number(existing.attempt ?? 0),
        });
      }
      return {
        accepted: true,
        status: 202,
        jobKey,
        jobId: existing.id,
        joinedExisting: true,
        queue: opts.queue,
      };
    }
    if (existing?.id && existing.status === 'done') {
      return {
        accepted: true,
        status: 202,
        jobKey,
        jobId: existing.id,
        joinedExisting: true,
        queue: opts.queue,
      };
    }
  }

  const estimated =
    opts.estimatedCost ?? worker.costEstimate(opts.payload);

  const jobId = await insertPipelineJob({
    job_key: jobKey,
    queue_name: opts.queue,
    pipeline_version: PIPELINE_VERSION,
    worker_version: worker.workerVersion,
    status: 'queued',
    worker: worker.id,
    estimated_cost: estimated,
    payload: opts.payload,
  });

  const priority = QUEUE_PRIORITY[opts.queue] ?? 100;
  const payload = { ...opts.payload, workspaceId: opts.workspaceId, keyword: opts.keyword };

  const usedBull = await tryBullmqEnqueue(opts.queue, jobKey, payload, priority, jobId);
  if (!usedBull) {
    memoryQ.push({ id: jobId, queue: opts.queue, jobKey, payload, priority });
    void pumpMemory();
  } else if (process.env.PIPELINE_INLINE_WORKERS !== '0') {
    void runWorkerJob({
      dbJobId: jobId,
      queue: opts.queue,
      jobKey,
      payload,
      attempt: 0,
    });
  }

  return {
    accepted: true,
    status: 202,
    jobKey,
    jobId,
    joinedExisting: false,
    queue: opts.queue,
  };
}

export async function processJobInline(opts: {
  queue: QueueName;
  jobKey: string;
  payload: Record<string, unknown>;
  dbJobId: number;
}): Promise<void> {
  await runWorkerJob({
    dbJobId: opts.dbJobId,
    queue: opts.queue,
    jobKey: opts.jobKey,
    payload: opts.payload,
    attempt: 0,
  });
}

void bullmqReady;
