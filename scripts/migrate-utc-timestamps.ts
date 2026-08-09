/**
 * Convert naive TIMESTAMP columns to TIMESTAMPTZ — see lib/ensureUtcTimestamps.
 *
 * Run as a deployment step, not from a request: each ALTER rewrites its table
 * under an ACCESS EXCLUSIVE lock.
 *
 *   npm run db:utc-timestamps
 *
 * Idempotent — a second run finds nothing left to convert and exits 0.
 */
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env' });

async function main(): Promise<void> {
  // Imported after dotenv so the connection picks up DATABASE_URL.
  const { ensureUtcTimestamps, findNaiveTimestampColumns } = await import('../lib/ensureUtcTimestamps');

  const before = await findNaiveTimestampColumns();
  console.log(`[utc-timestamps] naive columns before: ${before.length}`);
  if (before.length === 0) {
    console.log('[utc-timestamps] nothing to do');
    return;
  }

  await ensureUtcTimestamps();

  const after = await findNaiveTimestampColumns();
  console.log(`[utc-timestamps] naive columns after: ${after.length}`);
  if (after.length > 0) {
    // Expected for partition-key columns, which Postgres cannot retype in place.
    console.log('[utc-timestamps] still naive (see warnings above):');
    for (const c of after) console.log(`  - ${c.table_name}.${c.column_name}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[utc-timestamps] failed:', err);
    process.exit(1);
  });
