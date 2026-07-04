import db from '../database/database';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const JSON_T = isPostgres ? 'JSONB' : 'TEXT';
const NOW = 'CURRENT_TIMESTAMP';

/** Mirrors lib/ensureAiVisibilityTables: log non-"already exists" failures. */
function ignoreExisting(label: string, e: unknown): void {
   const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
   if (!/exist|duplicate|already/i.test(m)) console.warn(`[audit] ${label} failed:`, m);
}

/**
 * Standalone Audit tool (More tools › Audit). One row per (url, keyword). Distinct
 * from the GSC-based content-audit page and from page_audits: these hold a full
 * SurferSEO-style content audit serialized into result_json.
 *
 * status ∈ queued | running | completed | failed. started_at is the staleness
 * heartbeat: a `running` audit whose compute died can be re-kicked by comparing it
 * to the current time (compute is synchronous fire-and-forget, so this is a safety net).
 */
export async function ensureAuditTables(): Promise<void> {
   if (checked) return;

   await db.query(`CREATE TABLE IF NOT EXISTS audit_runs (
      id ${PK},
      domain_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      keyword TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      content_score INTEGER,
      result_json ${JSON_T},
      progress_done INTEGER DEFAULT 0,
      progress_total INTEGER DEFAULT 0,
      error TEXT,
      started_at TIMESTAMP,
      finished_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('audit_runs', e));

   try { await db.query('CREATE INDEX IF NOT EXISTS idx_audit_runs_domain ON audit_runs (domain_id)'); } catch (e) { ignoreExisting('idx audit_runs domain', e); }
   // One row per (domain, url, keyword): dedupes re-audits and is the ON CONFLICT
   // target for the idempotent enqueue upsert (lib/auditRunner).
   try { await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_runs_uniq ON audit_runs (domain_id, url, keyword)'); } catch (e) { ignoreExisting('idx audit_runs uniq', e); }

   checked = true;
}
