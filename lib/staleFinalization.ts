/**
 * One definition of "this finalization is hung", shared by the job-progress reaper and
 * the generation stream. Two copies of the cutoff and the predicate would drift, and a
 * stream that reaps earlier than the endpoint would kill healthy runs.
 *
 * The comparison stays in SQL on purpose: SQLite's CURRENT_TIMESTAMP has no offset, so
 * parsing it in JS reads it as local time and skews the window by the host's offset.
 */
export const FINALIZING_STALE_SECS = 5 * 60;

export function staleFinalizationSql(column = 'updated_at'): string {
  return process.env.DATABASE_URL
    ? `${column} < NOW() - INTERVAL '${FINALIZING_STALE_SECS} seconds'`
    : `${column} < datetime('now', '-${FINALIZING_STALE_SECS} seconds')`;
}
