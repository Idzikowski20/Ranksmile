import db from '@/database/database';
import { ensureArticlesTables } from '@/src/infrastructure/persistence/schema/ensureArticlesTables';

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

   // domain_recommendations: optimize recs carry a page url + score (score is 0–100:
   // content score for legacy recs, opportunity×10 for GSC-ranked optimize recs); write
   // ("create") recs carry DataForSEO search_volume + keyword_difficulty like Surfer.
   const recCols: Array<[string, string]> = [
      ['url', 'TEXT'], ['score', 'INTEGER'],
      ['search_volume', 'INTEGER'], ['keyword_difficulty', 'INTEGER'],
      // Surfer parity: optimize carries a keyword; write ("create") carries its topic-map
      // cluster name. `title` (existing) holds the page/headline title on both.
      ['keyword', 'TEXT'], ['topic_title', 'TEXT'],
      // Surfer-style optimize lifecycle: not_started → in_progress, linked to the article
      // that opens as its "Content Editor" once the user hits Optimize.
      ['optimization_status', 'TEXT'], ['article_id', 'INTEGER'],
   ];
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
   // autoLearnBrandDna picks the domain's 8 best audited pages. page_audits grows with
   // every crawled page, and the domain_id-only index above left that a full per-domain
   // scan plus a sort.
   //
   // Equality columns first, then the ORDER BY keys in the query's own direction, so the
   // engine can walk the index and stop once eight rows qualify. word_count is left as a
   // filter rather than an index range on purpose: a range column before the sort keys
   // ends the usable ordering right there, which is what a (…, word_count, score) index
   // did — it served the WHERE and then sorted every qualifying page anyway.
   //
   // Every ORDER BY key is in here, url included: without the tie-break the engine can
   // walk the index but still has to sort each tie group before it knows which eight
   // rows come first, and score/word_count collide often on a real blog.
   //
   // NULLS LAST is spelled out on Postgres and left off on SQLite, which rejects it in
   // CREATE INDEX ("unsupported use of NULLS LAST") and does not need it: SQLite sorts
   // NULLs smallest, so a DESC index already ends with them. Postgres defaults a DESC
   // index to NULLS FIRST, and an index whose null placement disagrees with the query's
   // is not usable for the sort at all — the whole point of this index.
   //
   // New name, and the superseded one is dropped rather than re-declared: CREATE INDEX
   // IF NOT EXISTS matches on the name alone, so every database that already ran the
   // first definition would have silently kept it.
   //
   // Create first, drop only if the create actually succeeded — never the other way, and
   // never unconditionally. If the create fails, dropping the old index would leave the
   // query with no index at all until the next boot that happens to succeed; keeping the
   // old one until the new exists is the whole point, so the drop is gated on the create,
   // not just sequenced after it. The drop is a no-op once nobody is on the first name.
   const scoreKey = isPostgres ? 'score DESC NULLS LAST' : 'score DESC';
   let topIndexReady = false;
   try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_page_audits_top ON page_audits(domain_id, fetch_status, ${scoreKey}, word_count DESC, url ASC)`);
      topIndexReady = true;
   } catch (e) { ignoreExisting('idx_page_audits_top', e); }
   if (topIndexReady) {
      try { await db.query('DROP INDEX IF EXISTS idx_page_audits_best'); } catch (e) { ignoreExisting('drop idx_page_audits_best', e); }
   }

   checked = true;
}
