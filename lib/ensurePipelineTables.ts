import db from '../database/database';
import { ensureArticlesTables } from './ensureArticlesTables';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const JSON_T = isPostgres ? 'JSONB' : 'TEXT';
const NOW = 'CURRENT_TIMESTAMP';

/** Log non-"already exists" failures instead of a blanket catch{} that masks real errors
 * (permission denied / offline / syntax) as success. Mirrors lib/ensureTenancyTables.ts. */
function ignoreExisting(label: string, e: unknown): void {
   const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
   if (!/exist|duplicate|already/i.test(m)) console.warn(`[pipeline] ${label} failed:`, m);
}

/** Domain-pipeline tables + analysis_jobs columns for domain-level jobs. */
export async function ensurePipelineTables(): Promise<void> {
   if (checked) return;
   await ensureArticlesTables(); // analysis_jobs must already exist

   // analysis_jobs is now a shared job table — nullable article_id, generic domain_id + metadata.
   try { await db.query('ALTER TABLE analysis_jobs ADD COLUMN domain_id INTEGER'); } catch (e) { ignoreExisting('add analysis_jobs.domain_id', e); }
   try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN metadata ${JSON_T}`); } catch (e) { ignoreExisting('add analysis_jobs.metadata', e); }
   if (isPostgres) { try { await db.query('ALTER TABLE analysis_jobs ALTER COLUMN article_id DROP NOT NULL'); } catch (e) { ignoreExisting('drop article_id NOT NULL', e); } }

   await db.query(`CREATE TABLE IF NOT EXISTS domain_gsc_pages (
      id ${PK}, domain_id INTEGER NOT NULL, url TEXT NOT NULL,
      clicks INTEGER DEFAULT 0, impressions INTEGER DEFAULT 0, position REAL,
      captured_at TIMESTAMP DEFAULT ${NOW})`);
   await db.query(`CREATE TABLE IF NOT EXISTS domain_keywords (
      id ${PK}, domain_id INTEGER NOT NULL, keyword TEXT NOT NULL, source TEXT,
      volume INTEGER, position REAL, topic_id INTEGER, created_at TIMESTAMP DEFAULT ${NOW})`);
   await db.query(`CREATE TABLE IF NOT EXISTS domain_topics (
      id ${PK}, domain_id INTEGER NOT NULL, title TEXT NOT NULL, summary TEXT,
      created_at TIMESTAMP DEFAULT ${NOW})`);
   await db.query(`CREATE TABLE IF NOT EXISTS domain_competitors (
      id ${PK}, domain_id INTEGER NOT NULL, competitor_domain TEXT NOT NULL,
      appearances INTEGER DEFAULT 0, avg_position REAL, created_at TIMESTAMP DEFAULT ${NOW})`);
   await db.query(`CREATE TABLE IF NOT EXISTS domain_recommendations (
      id ${PK}, domain_id INTEGER NOT NULL, topic_id INTEGER, title TEXT NOT NULL,
      rationale TEXT, priority TEXT, type TEXT, created_at TIMESTAMP DEFAULT ${NOW})`);

   await db.query(`CREATE TABLE IF NOT EXISTS page_audits (
      id ${PK},
      domain_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      path TEXT,
      title TEXT,
      score INTEGER,
      word_count INTEGER,
      signals_json TEXT,
      fetch_status TEXT,
      content_hash TEXT,
      duration_ms INTEGER,
      status TEXT DEFAULT 'triaged',
      deep_json TEXT,
      deep_content_hash TEXT,
      deep_generated_at TIMESTAMP,
      last_audited_at TIMESTAMP DEFAULT ${NOW}
   )`);
   // status is open vocabulary (triaged|deep now; queued|failed|outdated reserved) — plain
   // TEXT, no DB enum, so future states need no migration.

   // domain_recommendations: optimize recs carry a page url + snapshot score
   const recCols: Array<[string, string]> = [['url', 'TEXT'], ['score', 'INTEGER']];
   for (const [col, type] of recCols) {
      try { await db.query(`ALTER TABLE domain_recommendations ADD COLUMN ${col} ${type}`); } catch (e) { ignoreExisting(`add domain_recommendations.${col}`, e); }
   }

   await db.query(`CREATE TABLE IF NOT EXISTS site_audit_crawl_snapshots (
      id ${isPostgres ? 'TEXT' : 'TEXT'} PRIMARY KEY,
      domain_id INTEGER NOT NULL,
      crawled_at TIMESTAMP DEFAULT ${NOW},
      metrics_json ${JSON_T} NOT NULL
   )`);
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_sa_snapshots_domain ON site_audit_crawl_snapshots(domain_id, crawled_at DESC)'); } catch (e) { ignoreExisting('idx_sa_snapshots_domain', e); }

   for (const t of ['domain_gsc_pages','domain_keywords','domain_topics','domain_competitors','domain_recommendations','page_audits']) {
      try { await db.query(`CREATE INDEX IF NOT EXISTS idx_${t}_domain ON ${t}(domain_id)`); } catch (e) { ignoreExisting(`idx_${t}_domain`, e); }
   }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_jobs_domain_type ON analysis_jobs(domain_id, job_type)'); } catch (e) { ignoreExisting('idx_jobs_domain_type', e); }

   checked = true;
}
