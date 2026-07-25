/**
 * BullMQ pipeline consumers — run separately from Next.js.
 *
 * Usage:
 *   npx tsx scripts/pipeline-workers.ts
 *   npm run pipeline:workers
 *
 * Set PIPELINE_INLINE_WORKERS=0 on the Next process so jobs are not double-executed.
 *
 * IMPORTANT: dotenv MUST run before any import that loads database/database.ts.
 * That module reads DATABASE_URL at load time — if it is missing, Sequelize falls
 * back to SQLite while Next.js writes jobs to Neon, so workers "succeed" against
 * the wrong DB and Neon rows stay queued forever (then DLQ as stale orphans).
 */
import net from 'net';
import dotenv from 'dotenv';
import { Worker, Queue } from 'bullmq';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env' });

function parseRedisUrl(raw: string): { host: string; port: number } {
  try {
    const u = new URL(raw);
    return { host: u.hostname || '127.0.0.1', port: u.port ? Number(u.port) : 6379 };
  } catch {
    return { host: '127.0.0.1', port: 6379 };
  }
}

function tcpOpen(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function waitForRedis(url: string, maxMs = 60_000): Promise<void> {
  const { host, port } = parseRedisUrl(url);
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (await tcpOpen(host, port)) {
      console.log(`[pipeline-workers] Redis ready at ${host}:${port}`);
      return;
    }
    console.log(`[pipeline-workers] waiting for Redis ${host}:${port}…`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Redis not reachable at ${host}:${port} within ${maxMs}ms`);
}

/** After Redis wipe, DB may still have queued rows — push them back onto BullMQ. */
async function reclaimQueuedJobs(url: string): Promise<void> {
  const { expireStaleQueuedJobs, listQueuedPipelineJobs } = await import(
    '../lib/ensurePipelineJobsTables'
  );
  const { QUEUE_PRIORITY } = await import('../lib/pipeline/queuePriorities');
  type QueueName = import('../lib/pipeline/queuePriorities').QueueName;

  const expired = await expireStaleQueuedJobs();
  if (expired > 0) {
    console.log(`[pipeline-workers] expired ${expired} stale orphan job(s)`);
  }
  const queued = await listQueuedPipelineJobs(80);
  if (!queued.length) {
    console.log('[pipeline-workers] no queued DB jobs to reclaim');
    return;
  }
  console.log(`[pipeline-workers] reclaiming ${queued.length} queued job(s)…`);
  for (const row of queued) {
    const queue = row.queue as QueueName;
    try {
      const q = new Queue(`ranksmile-${queue}`, { connection: { url } });
      await q.add(
        queue,
        { jobKey: row.jobKey, payload: row.payload, dbJobId: row.id },
        {
          jobId: `${row.jobKey}-${row.id}`,
          priority: QUEUE_PRIORITY[queue] ?? 100,
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
      await q.close();
      console.log(`[pipeline-workers] reclaimed id=${row.id} queue=${queue}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Duplicate job id is fine — already on the queue
      if (!/already exists|JobId/i.test(msg)) {
        console.warn(`[pipeline-workers] reclaim failed id=${row.id}:`, msg);
      }
    }
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      '[pipeline-workers] DATABASE_URL is missing after loading .env — refusing SQLite fallback (would desync from Neon)',
    );
  }

  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  process.env.REDIS_URL = url;
  process.env.PIPELINE_STAGE = process.env.PIPELINE_STAGE || '5';
  process.env.PIPELINE_INLINE_WORKERS = '0';

  console.log(
    `[pipeline-workers] DATABASE_URL=${process.env.DATABASE_URL ? 'set' : 'MISSING'} REDIS_URL=${url}`,
  );

  await waitForRedis(url);

  // Dynamic imports AFTER dotenv so database/database.ts sees DATABASE_URL (Neon), not SQLite.
  const { listWorkers, resetWorkerRegistry } = await import('../lib/workers/registry');
  const { findActiveJobByKey, insertPipelineJob } = await import('../lib/ensurePipelineJobsTables');
  const { processJobInline } = await import('../lib/pipeline/pipelineQueue');
  const { PIPELINE_VERSION } = await import('../lib/pipeline/queuePriorities');
  const { getPipelineStage } = await import('../lib/pipeline/pipelineStage');

  resetWorkerRegistry();
  const workers = listWorkers();
  console.log(
    `[pipeline-workers] stage=${getPipelineStage()} queues=${workers.map((w) => w.queue).join(',')}`,
  );

  await reclaimQueuedJobs(url);

  const handles: Worker[] = [];
  for (const w of workers) {
    const queueName = `ranksmile-${w.queue}`;
    const handle = new Worker(
      queueName,
      async (job) => {
        const data = (job.data || {}) as {
          jobKey?: string;
          payload?: Record<string, unknown>;
          dbJobId?: number;
        };
        const payload = data.payload || (job.data as Record<string, unknown>);
        const jobKey =
          data.jobKey ||
          String(job.id || `${w.queue}-${Date.now()}`);

        let dbJobId = Number(data.dbJobId || 0);
        if (!dbJobId) {
          const dbJob = await findActiveJobByKey(jobKey);
          dbJobId = dbJob?.id ?? 0;
        }
        if (!dbJobId) {
          dbJobId = await insertPipelineJob({
            job_key: jobKey,
            queue_name: w.queue,
            pipeline_version: PIPELINE_VERSION,
            worker_version: w.workerVersion,
            status: 'queued',
            worker: w.id,
            payload,
          });
        }

        console.log(`[pipeline-workers] start ${queueName} dbJobId=${dbJobId} jobKey=${jobKey.slice(0, 8)}…`);
        await processJobInline({
          queue: w.queue,
          jobKey,
          payload,
          dbJobId,
        });
        console.log(`[pipeline-workers] done ${queueName} dbJobId=${dbJobId}`);
      },
      { connection: { url }, concurrency: 2 },
    );
    handle.on('failed', (job, err) => {
      console.error(`[pipeline-workers] ${queueName} job ${job?.id} failed:`, err.message);
    });
    handles.push(handle);
    console.log(`[pipeline-workers] listening on ${queueName}`);
  }

  const shutdown = async () => {
    console.log('[pipeline-workers] shutting down…');
    await Promise.all(handles.map((h) => h.close()));
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main().catch((err: unknown) => {
  console.error('[pipeline-workers] fatal:', err);
  process.exit(1);
});
