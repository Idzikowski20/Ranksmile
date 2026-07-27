import db from '../database/database';
import { ignoreExistingSchema } from './ignoreExistingSchema';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const BIG = isPostgres ? 'BIGINT' : 'INTEGER';
const NOW = 'CURRENT_TIMESTAMP';

const ignore = (label: string, e: unknown) => ignoreExistingSchema('notifications', label, e);

/** notification_events (mutable projection) + notification_reads (read_revision per user). */
export async function ensureNotificationTables(): Promise<void> {
  if (checked) return;

  await db.query(`CREATE TABLE IF NOT EXISTS notification_events (
    id ${PK},
    event_id TEXT NOT NULL UNIQUE,
    org_id ${BIG} NOT NULL,
    workspace_id INTEGER NOT NULL,
    domain_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    href TEXT NOT NULL,
    current_count INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    payload_json TEXT,
    created_at TIMESTAMP DEFAULT ${NOW},
    updated_at TIMESTAMP DEFAULT ${NOW},
    archived_at TIMESTAMP
  )`).catch((e) => ignore('notification_events', e));

  await db.query(`CREATE TABLE IF NOT EXISTS notification_reads (
    user_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    read_revision INTEGER NOT NULL,
    read_at TIMESTAMP DEFAULT ${NOW},
    PRIMARY KEY (user_id, event_id)
  )`).catch((e) => ignore('notification_reads', e));

  try {
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_notification_events_workspace_active
         ON notification_events(workspace_id, updated_at DESC)
         WHERE archived_at IS NULL`,
    );
  } catch (e) { ignore('idx_notification_events_workspace_active', e); }

  try {
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_notification_events_org_active
         ON notification_events(org_id, updated_at DESC)
         WHERE archived_at IS NULL`,
    );
  } catch (e) { ignore('idx_notification_events_org_active', e); }

  checked = true;
}
