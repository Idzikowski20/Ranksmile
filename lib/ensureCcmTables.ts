/**
 * Ensures CIA CCM snapshot / event tables exist (Postgres or SQLite).
 */
import db from '../database/database';

let tablesChecked = false;

const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const NOW_DEFAULT = 'CURRENT_TIMESTAMP';

export async function ensureCcmTables(): Promise<void> {
  if (tablesChecked) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS cia_ccm_snapshots (
      id                ${PK},
      article_id        TEXT NOT NULL,
      ccm_id            TEXT NOT NULL,
      version           INTEGER NOT NULL,
      content_hash      TEXT NOT NULL,
      deterministic_hash TEXT NOT NULL,
      compiled_at       TEXT NOT NULL,
      snapshot_json     TEXT NOT NULL,
      action_graph_json TEXT,
      created_at        TIMESTAMP DEFAULT ${NOW_DEFAULT},
      UNIQUE(article_id, version)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS cia_compile_events (
      id          ${PK},
      article_id  TEXT NOT NULL,
      ccm_version INTEGER NOT NULL,
      event_type  TEXT NOT NULL,
      event_json  TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      created_at  TIMESTAMP DEFAULT ${NOW_DEFAULT}
    )
  `);

  tablesChecked = true;
}

/** Test helper — allow re-ensure after schema changes in tests. */
export function resetCcmTablesFlag(): void {
  tablesChecked = false;
}
