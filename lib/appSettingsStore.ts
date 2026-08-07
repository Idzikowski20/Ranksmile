import db from '../database/database';

let checked = false;

function ignoreExisting(label: string, e: unknown): void {
   const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
   if (!/exist|duplicate|already/i.test(m)) console.warn(`[app-settings] ${label} failed:`, m);
}

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
   } catch (e) { ignoreExisting('create table', e); }
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
