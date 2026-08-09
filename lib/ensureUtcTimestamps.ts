import db from '../database/database';

/**
 * Convert every naive `TIMESTAMP` column to `TIMESTAMPTZ`.
 *
 * Why this exists: the app always writes UTC — application code via
 * `Date.toISOString()`, and `DEFAULT CURRENT_TIMESTAMP` because Sequelize issues
 * `SET TIME ZONE INTERVAL '+00:00'` on connect. But a `timestamp without time
 * zone` column stores bare digits, and node-postgres reads them back in the
 * *Node process* timezone. On any runtime that is not UTC the value comes back
 * shifted by the local offset — the sidebar trial countdown ran two hours short
 * on Europe/Warsaw, and would drift by another hour across a DST boundary.
 *
 * Because every stored value is already UTC digits, `AT TIME ZONE 'UTC'` is a
 * lossless reinterpretation, not a shift.
 *
 * Idempotent: once converted the columns no longer match the lookup, so repeat
 * runs do nothing.
 *
 * ponytail: ALTER COLUMN TYPE rewrites the table under an ACCESS EXCLUSIVE
 * lock. Fine at current table sizes; if any table grows past a few million rows,
 * move that one to an add-column/backfill/swap migration instead.
 */

let ready: Promise<number> | null = null;

type NaiveColumn = { table_name: string; column_name: string };

/** Double-quote an identifier from information_schema for safe interpolation. */
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function naiveTimestampAlterSql(table: string, column: string): string {
  const col = quoteIdent(column);
  return `ALTER TABLE ${quoteIdent(table)} ALTER COLUMN ${col} TYPE TIMESTAMPTZ USING ${col} AT TIME ZONE 'UTC'`;
}

export async function findNaiveTimestampColumns(): Promise<NaiveColumn[]> {
  const rows = await db.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type = 'timestamp without time zone'
      ORDER BY table_name, column_name`,
    { type: 'SELECT' as never },
  ) as unknown as NaiveColumn[];
  return Array.isArray(rows) ? rows : [];
}

async function run(): Promise<number> {
  // SQLite has no TIMESTAMPTZ and stores timestamps as text; nothing to do there.
  if (db.getDialect() !== 'postgres') return 0;

  const columns = await findNaiveTimestampColumns();
  if (columns.length === 0) return 0;

  // ALTER COLUMN TYPE takes ACCESS EXCLUSIVE. Without a cap, one long-running
  // reader would make this queue up and stall every request behind it. Fail fast
  // instead — whatever is skipped gets retried by the next process.
  try {
    await db.query("SET lock_timeout = '3s'");
  } catch {
    // Not fatal: worst case the ALTERs wait as they would have anyway.
  }

  let converted = 0;
  for (const { table_name: table, column_name: column } of columns) {
    try {
      await db.query(naiveTimestampAlterSql(table, column));
      converted += 1;
    } catch (e) {
      // One bad column must not block the rest — a view depending on the column,
      // or a permission gap, should be visible but not fatal.
      const message = String((e as { message?: string } | undefined)?.message ?? e ?? '');
      console.warn(`[utc-timestamps] ${table}.${column} failed:`, message);
    }
  }
  // The connection is pooled — leave the session as we found it.
  try {
    await db.query('SET lock_timeout = DEFAULT');
  } catch {
    // Nothing actionable; the setting dies with the connection.
  }

  if (converted > 0) console.log(`[utc-timestamps] converted ${converted} column(s) to TIMESTAMPTZ`);
  return converted;
}

/** Runs once per process; retries on the next call if it threw. */
export function ensureUtcTimestamps(): Promise<number> {
  if (!ready) {
    ready = run().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export default ensureUtcTimestamps;
