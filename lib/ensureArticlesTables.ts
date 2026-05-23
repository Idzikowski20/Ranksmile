/**
 * Upewnia się że tabele articles, site_context i publish_targets istnieją.
 * Obsługuje zarówno PostgreSQL (Neon) jak i SQLite (fallback dev).
 * Wywołuj na początku każdego API route artykułów.
 */
import db from '../database/database';

let tablesChecked = false;

const isPostgres = !!process.env.DATABASE_URL;

/** Typ kolumny serial/autoincrement zależny od dialektu */
const SERIAL = isPostgres ? 'SERIAL' : 'INTEGER';
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
/** Aktualny timestamp */
const NOW_DEFAULT = 'CURRENT_TIMESTAMP';

export async function ensureArticlesTables() {
   if (tablesChecked) return;

   await db.query(`
      CREATE TABLE IF NOT EXISTS site_context (
         id          ${PK},
         domain_id   INTEGER NOT NULL,
         url         TEXT NOT NULL,
         title       TEXT,
         description TEXT,
         tone        TEXT,
         language    TEXT DEFAULT 'pl',
         topics      TEXT,
         analyzed_at TIMESTAMP,
         created_at  TIMESTAMP DEFAULT ${NOW_DEFAULT}
      )
   `);

   await db.query(`
      CREATE TABLE IF NOT EXISTS articles (
         id               ${PK},
         domain_id        INTEGER NOT NULL,
         title            TEXT NOT NULL,
         slug             TEXT,
         content          TEXT,
         status           TEXT DEFAULT 'draft',
         target_keyword   TEXT,
         meta_title       TEXT,
         meta_description TEXT,
         meta_url         TEXT,
         schema_json      TEXT,
         score_data       TEXT,
         word_count       INTEGER,
         featured_image   TEXT,
         competitor_outlines_cache TEXT,
         internal_links_cache      TEXT,
         content_score    INTEGER DEFAULT 0,
         published_at     TIMESTAMP,
         publish_target   TEXT,
         publish_url      TEXT,
         scheduled_for    TIMESTAMP,
         created_at       TIMESTAMP DEFAULT ${NOW_DEFAULT},
         updated_at       TIMESTAMP DEFAULT ${NOW_DEFAULT}
      )
   `);

   await db.query(`
      CREATE TABLE IF NOT EXISTS publish_targets (
         id          ${PK},
         domain_id   INTEGER NOT NULL,
         type        TEXT NOT NULL,
         url         TEXT NOT NULL,
         api_key     TEXT,
         created_at  TIMESTAMP DEFAULT ${NOW_DEFAULT}
      )
   `);

   await db.query(`
      CREATE TABLE IF NOT EXISTS article_competitors (
         id            ${PK},
         article_id    INTEGER NOT NULL,
         url           TEXT NOT NULL,
         domain        TEXT,
         title         TEXT,
         snippet       TEXT,
         word_count    INTEGER,
         heading_count INTEGER,
         headings_json TEXT,
         entities_json TEXT,
         terms_json    TEXT,
         created_at    TIMESTAMP DEFAULT ${NOW_DEFAULT}
      )
   `);

   await db.query(`
      CREATE TABLE IF NOT EXISTS article_terms (
         id            ${PK},
         article_id    INTEGER NOT NULL,
         term          TEXT NOT NULL,
         term_type     TEXT DEFAULT 'topic',
         source        TEXT DEFAULT 'serp',
         current_count INTEGER DEFAULT 0,
         target_min    INTEGER DEFAULT 1,
         target_max    INTEGER DEFAULT 3,
         importance    REAL DEFAULT 0,
         created_at    TIMESTAMP DEFAULT ${NOW_DEFAULT}
      )
   `);

   await db.query(`
      CREATE TABLE IF NOT EXISTS ai_visibility_runs (
         id                    ${PK},
         article_id            INTEGER NOT NULL,
         target_keyword        TEXT,
         score                 INTEGER DEFAULT 0,
         prompts_total         INTEGER DEFAULT 0,
         prompts_cited         INTEGER DEFAULT 0,
         competitor_citations  INTEGER DEFAULT 0,
         summary_json          TEXT,
         created_at            TIMESTAMP DEFAULT ${NOW_DEFAULT}
      )
   `);

   await db.query(`
      CREATE TABLE IF NOT EXISTS ai_visibility_citations (
         id             ${PK},
         run_id         INTEGER NOT NULL,
         prompt         TEXT NOT NULL,
         answer         TEXT,
         cited_url      TEXT,
         cited_domain   TEXT,
         is_own_domain  INTEGER DEFAULT 0,
         is_competitor  INTEGER DEFAULT 0,
         sentiment      TEXT,
         created_at     TIMESTAMP DEFAULT ${NOW_DEFAULT}
      )
   `);

   await db.query(`
      CREATE TABLE IF NOT EXISTS article_versions (
         id            ${PK},
         article_id    INTEGER NOT NULL,
         version_type  TEXT NOT NULL,
         content       TEXT,
         score_data    TEXT,
         created_at    TIMESTAMP DEFAULT ${NOW_DEFAULT}
      )
   `);

   await db.query(`
      CREATE TABLE IF NOT EXISTS article_keywords (
         id               ${PK},
         article_id       INTEGER NOT NULL,
         keyword          TEXT NOT NULL,
         gsc_volume_range TEXT,
         gsc_position     DECIMAL(5,2),
         ads_monthly_volume INTEGER,
         ads_competition  TEXT,
         ads_cpc          DECIMAL(10,2),
         relevance_score  DECIMAL(3,2),
         is_covered       INTEGER DEFAULT 0,
         source           TEXT DEFAULT 'gsc',
         uid              TEXT,
         created_at       TIMESTAMP DEFAULT ${NOW_DEFAULT},
         updated_at       TIMESTAMP DEFAULT ${NOW_DEFAULT}
      )
   `);

   // Migrations dla SQLite (Postgres dostaje kolumny już w CREATE TABLE)
   if (!isPostgres) {
      try { await db.query(`ALTER TABLE articles ADD COLUMN featured_image TEXT`); } catch {}
      try { await db.query(`ALTER TABLE articles ADD COLUMN competitor_outlines_cache TEXT`); } catch {}
      try { await db.query(`ALTER TABLE articles ADD COLUMN internal_links_cache TEXT`); } catch {}
      try { await db.query(`ALTER TABLE articles ADD COLUMN content_score INTEGER DEFAULT 0`); } catch {}
   }

   // Indeksy
   try { await db.query(`CREATE INDEX IF NOT EXISTS idx_articles_domain ON articles(domain_id)`); } catch {}
   try { await db.query(`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)`); } catch {}
   try { await db.query(`CREATE INDEX IF NOT EXISTS idx_article_competitors_article ON article_competitors(article_id)`); } catch {}
   try { await db.query(`CREATE INDEX IF NOT EXISTS idx_article_terms_article ON article_terms(article_id)`); } catch {}
   try { await db.query(`CREATE INDEX IF NOT EXISTS idx_ai_visibility_runs_article ON ai_visibility_runs(article_id)`); } catch {}
   try { await db.query(`CREATE INDEX IF NOT EXISTS idx_ai_visibility_citations_run ON ai_visibility_citations(run_id)`); } catch {}
   try { await db.query(`CREATE INDEX IF NOT EXISTS idx_article_versions_article ON article_versions(article_id)`); } catch {}
   try { await db.query(`CREATE INDEX IF NOT EXISTS idx_article_keywords_article ON article_keywords(article_id)`); } catch {}
   try { await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_article_keywords_uid ON article_keywords(uid)`); } catch {}

   tablesChecked = true;
   console.log('[articles] Tables ready');
}
