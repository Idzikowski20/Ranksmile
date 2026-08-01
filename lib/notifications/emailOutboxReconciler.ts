import { listDueEmailJobs, recoverStaleEmailJobs } from './emailJobState';
import { processEmailJob } from './emailWorker';
import { EMAIL_STALE_RUNNING_MS } from './emailTypes';

/**
 * Recover stale running jobs, then process due queued/failed rows directly.
 * DB is source of truth — no BullMQ bridge.
 */
export async function reconcileEmailOutbox(): Promise<{
  recovered: number;
  processed: number;
}> {
  const recoveredRows = await recoverStaleEmailJobs(EMAIL_STALE_RUNNING_MS);
  const due = await listDueEmailJobs(100);
  let processed = 0;
  for (const row of due) {
    await processEmailJob(row.id);
    processed += 1;
  }
  return { recovered: recoveredRows.length, processed };
}

function isDbConnectivityError(err: unknown): boolean {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /HostNotFound|ConnectionAcquireTimeout|ConnectionRefused|ConnectionError|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|SequelizeConnection/i.test(
      name,
    )
    || /HostNotFound|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|Operation timeout|ConnectionAcquireTimeout/i.test(msg)
  );
}

/**
 * Start periodic poller (pipeline-workers process).
 * On Neon/DNS blips, skip ticks until backoff elapses so we don't thrash the pool.
 */
export function startEmailOutboxReconciler(intervalMs = 60_000): NodeJS.Timeout {
  let failStreak = 0;
  let pausedUntil = 0;

  const tick = () => {
    if (Date.now() < pausedUntil) return;
    void reconcileEmailOutbox().then(
      (r) => {
        failStreak = 0;
        if (r.recovered || r.processed) {
          console.log(
            `[email-outbox] poll recovered=${r.recovered} processed=${r.processed}`,
          );
        }
      },
      (err: unknown) => {
        failStreak += 1;
        const backoff = Math.min(intervalMs * 2 ** Math.min(failStreak, 4), 15 * 60_000);
        pausedUntil = Date.now() + backoff;
        if (isDbConnectivityError(err)) {
          console.warn(
            `[email-outbox] poll failed (DB connectivity, backoff ${Math.round(backoff / 1000)}s):`,
            err instanceof Error ? `${err.name}: ${err.message}` : err,
          );
        } else {
          console.warn('[email-outbox] poll failed:', err);
        }
      },
    );
  };

  tick();
  return setInterval(tick, intervalMs);
}
