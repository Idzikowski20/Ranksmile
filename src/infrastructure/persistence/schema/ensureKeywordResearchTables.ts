import db from '@/database/database';
import { ignoreExistingSchema } from '@/src/core/shared/ignoreExistingSchema';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const JSON_T = isPostgres ? 'JSONB' : 'TEXT';
const NOW = 'CURRENT_TIMESTAMP';

const ignoreExisting = (label: string, e: unknown): void => ignoreExistingSchema('keyword-research', label, e);

/**
 * Standalone Keyword Research (More tools › Keyword Research). One row per (seed, country).
 * Shares the Topic Research result shape but keeps its own runs list (own table).
 * status ∈ queued | running | completed | failed.
 */
export async function ensureKeywordResearchTables(): Promise<void> {
   if (checked) return;

   await db.query(`CREATE TABLE IF NOT EXISTS keyword_research_runs (
      id ${PK},
      domain_id INTEGER NOT NULL,
      seed TEXT NOT NULL,
      country TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      result_json ${JSON_T},
      stats_json ${JSON_T},
      progress_done INTEGER DEFAULT 0,
      progress_total INTEGER DEFAULT 0,
      error TEXT,
      started_at TIMESTAMP,
      finished_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('keyword_research_runs', e));

   try { await db.query('CREATE INDEX IF NOT EXISTS idx_keyword_research_runs_domain ON keyword_research_runs (domain_id)'); } catch (e) { ignoreExisting('idx keyword_research domain', e); }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_keyword_research_runs_domain_status ON keyword_research_runs (domain_id, status, id)'); } catch (e) { ignoreExisting('idx keyword_research domain_status', e); }
   try { await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_keyword_research_runs_uniq ON keyword_research_runs (domain_id, seed, country)'); } catch (e) { ignoreExisting('idx keyword_research uniq', e); }

   checked = true;
}
