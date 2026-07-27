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

/** Start periodic poller (pipeline-workers process). */
export function startEmailOutboxReconciler(intervalMs = 60_000): NodeJS.Timeout {
  const tick = () => {
    void reconcileEmailOutbox().then(
      (r) => {
        if (r.recovered || r.processed) {
          console.log(
            `[email-outbox] poll recovered=${r.recovered} processed=${r.processed}`,
          );
        }
      },
      (err: unknown) => {
        console.warn('[email-outbox] poll failed:', err);
      },
    );
  };
  tick();
  return setInterval(tick, intervalMs);
}
