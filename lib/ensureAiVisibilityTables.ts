import db from '../database/database';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const JSON_T = isPostgres ? 'JSONB' : 'TEXT';
const NOW = 'CURRENT_TIMESTAMP';

/** Mirrors lib/ensurePipelineTables.ts: log non-"already exists" failures. */
function ignoreExisting(label: string, e: unknown): void {
   const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
   if (!/exist|duplicate|already/i.test(m)) console.warn(`[ai-vis] ${label} failed:`, m);
}

/**
 * Workspace-level AI Visibility tracking tables. Distinct from the
 * article-level ai_visibility_runs/citations pair (lib/aiVisibilityStore.ts):
 * these are keyed on domain_id and hold the wizard config + scan results.
 */
export async function ensureAiVisibilityTables(): Promise<void> {
   if (checked) return;

   // One config per domain. No row ⇒ the wizard has not been completed
   // and the route guard sends the user to /ai-visibility/setup.
   await db.query(`CREATE TABLE IF NOT EXISTS ai_vis_configs (
      id ${PK},
      domain_id INTEGER NOT NULL UNIQUE,
      brand_name TEXT NOT NULL,
      prompt_limit INTEGER DEFAULT 50,
      models ${JSON_T},
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT ${NOW},
      updated_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('ai_vis_configs', e));

   // topic is a denormalised group label — topics are display grouping only,
   // so a separate topics table would be a join with no additional data.
   await db.query(`CREATE TABLE IF NOT EXISTS ai_vis_prompts (
      id ${PK},
      config_id INTEGER NOT NULL,
      topic TEXT NOT NULL,
      text TEXT NOT NULL,
      provenance ${JSON_T},
      selected INTEGER DEFAULT 1,
      is_custom INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('ai_vis_prompts', e));

   await db.query(`CREATE TABLE IF NOT EXISTS ai_vis_competitors (
      id ${PK},
      config_id INTEGER NOT NULL,
      competitor_domain TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('ai_vis_competitors', e));

   // status ∈ queued | running | completed | failed | cancelled.
   // cost is stored as integer micro-dollars (USD × 1e6) to avoid float drift
   // when summing ~180 small per-call costs; divide by 1e6 at display.
   // started_at is the staleness heartbeat: a `running` scan older than
   // SCAN_STALE_MS (see lib/aiVisibility.ts) is treated as dead by enqueue.
   await db.query(`CREATE TABLE IF NOT EXISTS ai_vis_scans (
      id ${PK},
      config_id INTEGER NOT NULL,
      status TEXT DEFAULT 'queued',
      progress_done INTEGER DEFAULT 0,
      progress_total INTEGER DEFAULT 0,
      cost_micros INTEGER DEFAULT 0,
      error TEXT,
      started_at TIMESTAMP,
      finished_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('ai_vis_scans', e));

   // One row per (scan, prompt, model). citations = [{url, domain, title}].
   await db.query(`CREATE TABLE IF NOT EXISTS ai_vis_results (
      id ${PK},
      scan_id INTEGER NOT NULL,
      prompt_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      answer TEXT,
      citations ${JSON_T},
      brands ${JSON_T},
      own_cited INTEGER DEFAULT 0,
      own_position INTEGER,
      cost_micros INTEGER DEFAULT 0,
      error TEXT,
      created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('ai_vis_results', e));

   try { await db.query('CREATE INDEX IF NOT EXISTS idx_ai_vis_results_scan ON ai_vis_results (scan_id)'); } catch (e) { ignoreExisting('idx results', e); }
   try { await db.query(`ALTER TABLE ai_vis_results ADD COLUMN brands ${JSON_T}`); } catch (e) { ignoreExisting('ai_vis_results.brands', e); }
   try { await db.query(`ALTER TABLE ai_vis_results ADD COLUMN fan_out_queries ${JSON_T}`); } catch (e) { ignoreExisting('ai_vis_results.fan_out_queries', e); }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_ai_vis_prompts_config ON ai_vis_prompts (config_id)'); } catch (e) { ignoreExisting('idx prompts', e); }

   checked = true;
}
