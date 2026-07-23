import { enqueueJob } from '../../lib/pipeline/pipelineQueue';
import { buildJobKey } from '../../lib/pipeline/jobKey';

jest.mock('../../lib/ensurePipelineJobsTables', () => {
  const jobs = new Map<string, { id: number; status: string; finished_at?: string }>();
  let seq = 1;
  return {
    ensurePipelineJobsTables: jest.fn(async () => undefined),
    insertPipelineJob: jest.fn(async (row: { job_key: string; status: string }) => {
      const id = seq++;
      jobs.set(row.job_key, { id, status: row.status });
      return id;
    }),
    findActiveJobByKey: jest.fn(async (jobKey: string) => {
      const j = jobs.get(jobKey);
      if (!j) return null;
      return { id: j.id, job_key: jobKey, queue_name: 'serp_crawl', pipeline_version: 'v7', status: j.status };
    }),
    updatePipelineJob: jest.fn(async (id: number, patch: { status?: string }) => {
      for (const [k, v] of jobs) {
        if (v.id === id) {
          jobs.set(k, { ...v, status: patch.status || v.status, finished_at: new Date().toISOString() });
        }
      }
    }),
    moveJobToDlq: jest.fn(async () => undefined),
  };
});

jest.mock('../../lib/workers/registry', () => ({
  getWorker: jest.fn(() => ({
    id: 'serp',
    queue: 'serp_crawl',
    workerVersion: '1',
    retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    costEstimate: () => 0.01,
    produces: [],
    consumes: [],
    execute: jest.fn(async () => ({
      ok: true,
      actualCost: 0.01,
      estimatedCost: 0.01,
      result: { ok: true },
    })),
  })),
}));

describe('pipelineQueue enqueue', () => {
  it('returns 202 semantics and joins existing job_key', async () => {
    const keyword = 'join-test-keyword';
    const workspaceId = 'ws-1';
    const key = buildJobKey({ workspaceId, keyword, jobType: 'serp_crawl' });

    const first = await enqueueJob({
      workspaceId,
      keyword,
      queue: 'serp_crawl',
      payload: { keyword, workspaceId },
    });
    expect(first.status).toBe(202);
    expect(first.jobKey).toBe(key);
    expect(first.joinedExisting).toBe(false);

    // Mark done quickly via mock map — second enqueue joins
    const second = await enqueueJob({
      workspaceId,
      keyword,
      queue: 'serp_crawl',
      payload: { keyword, workspaceId },
    });
    expect(second.status).toBe(202);
    expect(second.joinedExisting).toBe(true);
    expect(second.jobId).toBe(first.jobId);
  });
});
