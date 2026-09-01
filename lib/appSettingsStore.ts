import db from '../database/database';

let checked = false;

/**
 * Single-row app settings blob. Replaces the local file `data/settings.json`
 * (SMTP/notification + GSC service-account creds) so settings persist on a
 * host whose filesystem is ephemeral/read-only. Idempotent.
 */
export async function ensureAppSettingsTable(): Promise<void> {
   if (checked) return;
   try {
      await db.query(`
         CREATE TABLE IF NOT EXISTS app_settings (
            skey       TEXT PRIMARY KEY,
            data       TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
         )
      `);
   } catch (e) {
      const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
      // "already exists" still means the table is there; anything else (transient
      // outage) must NOT mark the table ready — rethrow so the next call retries.
      if (!/exist|duplicate|already/i.test(m)) throw e;
   }
   checked = true;
}

const KEY = 'app';

/** The persisted settings blob (encrypted fields included), or null if never saved. */
export async function readSettingsBlob(): Promise<Record<string, unknown> | null> {
   await ensureAppSettingsTable();
   const [rows] = await db.query('SELECT data FROM app_settings WHERE skey = ?', { replacements: [KEY] });
   const row = (rows as Array<{ data: string }>)[0];
   if (!row) return null;
   try { return JSON.parse(row.data); } catch { return null; }
}

/** Upsert the settings blob (delete+insert; dialect-agnostic, mirrors lib/gscSnapshots.ts). */
export async function writeSettingsBlob(obj: Record<string, unknown>): Promise<void> {
   await ensureAppSettingsTable();
   await db.query('DELETE FROM app_settings WHERE skey = ?', { replacements: [KEY] });
   await db.query('INSERT INTO app_settings (skey, data) VALUES (?, ?)', { replacements: [KEY, JSON.stringify(obj)] });
}
