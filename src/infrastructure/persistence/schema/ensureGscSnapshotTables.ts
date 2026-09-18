import db from '@/database/database';
import { ignoreExistingSchema } from '@/src/core/shared/ignoreExistingSchema';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const NOW = 'CURRENT_TIMESTAMP';

const ignoreExisting = (label: string, e: unknown): void => ignoreExistingSchema('gsc-snap', label, e);

/** Weekly per-page GSC snapshots (for week-over-week drop detection) + org email throttle. Idempotent. */
export async function ensureGscSnapshotTables(): Promise<void> {
   if (checked) return;
   await db.query(`
      CREATE TABLE IF NOT EXISTS gsc_page_snapshots (
         id          ${PK},
         domain_id   INTEGER NOT NULL,
         page        TEXT NOT NULL,
         week_start  DATE NOT NULL,
         clicks      INTEGER NOT NULL DEFAULT 0,
         impressions INTEGER NOT NULL DEFAULT 0,
         position    REAL,
         captured_at TIMESTAMP DEFAULT ${NOW}
      )
   `);
   try { await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_gsc_snap_unique ON gsc_page_snapshots(domain_id, page, week_start)'); } catch (e) { ignoreExisting('unique index', e); }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_gsc_snap_domain_week ON gsc_page_snapshots(domain_id, week_start)'); } catch (e) { ignoreExisting('week index', e); }
   try { await db.query('ALTER TABLE organizations ADD COLUMN last_gsc_digest_sent_at TIMESTAMP'); } catch (e) { ignoreExisting('throttle column', e); }
   checked = true;
}
