import db from '@/database/database';
import { ignoreExistingSchema } from '@/src/core/shared/ignoreExistingSchema';

let checked = false;

const ignoreExisting = (label: string, e: unknown): void => ignoreExistingSchema('gsc-data', label, e);

/**
 * Per-domain Google Search Console data blob. Replaces the local file
 * `data/SC_<domain>.json` so the app works on a host whose filesystem is
 * ephemeral/read-only. One row per domain; `data` holds the same
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
