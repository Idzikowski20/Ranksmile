import db from '../database/database';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const NOW = 'CURRENT_TIMESTAMP';

function ignoreExisting(label: string, e: unknown): void {
  const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
  if (!/exist|duplicate|already/i.test(m)) console.warn(`[automations] ${label} failed:`, m);
}

/** Content-calendar automation events (scheduled article creates). */
export async function ensureAutomationTables(): Promise<void> {
  if (checked) return;

  await db.query(`CREATE TABLE IF NOT EXISTS automation_events (
    id ${PK},
    domain_id INTEGER NOT NULL,
    workspace_id INTEGER NOT NULL,
    scheduled_date TEXT NOT NULL,
    title TEXT NOT NULL,
    target_keyword TEXT NOT NULL DEFAULT '',
    publish_mode TEXT NOT NULL DEFAULT 'draft',
    article_id INTEGER,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_by TEXT,
    created_at TIMESTAMP DEFAULT ${NOW},
    updated_at TIMESTAMP DEFAULT ${NOW}
  )`).catch((e) => ignoreExisting('automation_events', e));

  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_automation_events_domain_date ON automation_events (domain_id, scheduled_date)`,
  ).catch((e) => ignoreExisting('idx_automation_events_domain_date', e));

  checked = true;
}
