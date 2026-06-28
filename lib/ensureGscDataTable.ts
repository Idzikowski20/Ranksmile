import db from '../database/database';

let checked = false;

function ignoreExisting(label: string, e: unknown): void {
   const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
   if (!/exist|duplicate|already/i.test(m)) console.warn(`[gsc-data] ${label} failed:`, m);
}

/**
 * Per-domain Google Search Console data blob. Replaces the local file
 * `data/SC_<domain>.json` so the app works on a serverless host (Vercel) whose
 * filesystem is ephemeral/read-only. One row per domain; `data` holds the same
 * `SCDomainDataType` JSON that used to live in the file. Idempotent.
 */
export async function ensureGscDataTable(): Promise<void> {
   if (checked) return;
   try {
      await db.query(`
         CREATE TABLE IF NOT EXISTS gsc_domain_data (
            domain     TEXT PRIMARY KEY,
            data       TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
         )
      `);
   } catch (e) { ignoreExisting('create table', e); }
   checked = true;
}
