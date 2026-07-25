import db from '../database/database';

const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const NOW = 'CURRENT_TIMESTAMP';
let tableChecked = false;

/**
 * Stores connections to WordPress sites made by the (forked Ranksmile) WP plugin.
 * One row per (workspace, site): the api_key is the shared secret both sides
 * send — the plugin sends it as the `api-key` header on its requests to us, and
 * we send it as `Authorization` when we call the plugin's REST routes. Idempotent.
 */
export async function ensureWpTables(): Promise<void> {
   if (tableChecked) return;
   await db.query(`
      CREATE TABLE IF NOT EXISTS wp_connections (
         id           ${PK},
         workspace_id INTEGER NOT NULL,
         user_id      TEXT NOT NULL,
         site_url     TEXT NOT NULL,
         api_key      TEXT NOT NULL,
         org_name     TEXT,
         created_at   TIMESTAMP DEFAULT ${NOW}
      )
   `);
   try { await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_wp_conn_apikey ON wp_connections(api_key)'); } catch { /* exists */ }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_wp_conn_ws ON wp_connections(workspace_id)'); } catch { /* exists */ }
   // "Integrated by" email, added after the initial schema — ALTER is a no-op if it already exists.
   try { await db.query('ALTER TABLE wp_connections ADD COLUMN integrated_by_email TEXT'); } catch { /* exists */ }
   tableChecked = true;
}
