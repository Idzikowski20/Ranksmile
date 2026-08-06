/**
 * Upewnia się że tabele articles, site_context i publish_targets istnieją.
 * Obsługuje zarówno PostgreSQL (Neon) jak i SQLite (fallback dev).
 * Wywołuj na początku każdego API route artykułów.
 */
import db from '../database/database';
import { ensureUserOnboardingTable } from './onboardingState';

let tablesChecked = false;

const isPostgres = !!process.env.DATABASE_URL;

/** Typ kolumny serial/autoincrement zależny od dialektu */
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
         language         TEXT DEFAULT 'pl',
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
      CREATE TABLE IF NOT EXISTS article_comments (
         id          TEXT PRIMARY KEY,
         article_id  INTEGER NOT NULL,
         quote       TEXT,
         body        TEXT,
         images_json TEXT,
         author      TEXT,
         color       TEXT,
         created_at  TIMESTAMP DEFAULT ${NOW_DEFAULT}
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

   // user_onboarding — per-user onboarding survey state (gates app access).
   // Owned by lib/onboardingState.ts, which invitation acceptance calls on its own.
   await ensureUserOnboardingTable();

   // analysis_jobs — event-driven pipeline job queue
   await db.query(`
      CREATE TABLE IF NOT EXISTS analysis_jobs (
         id               TEXT PRIMARY KEY,
         article_id       INTEGER NOT NULL,
         job_type         TEXT NOT NULL DEFAULT 'deep_analysis',
         status           TEXT NOT NULL DEFAULT 'queued',
         current_stage    TEXT,
         stage_progress   INTEGER DEFAULT 0,
         total_progress   INTEGER DEFAULT 0,
         progress_message TEXT,
         payload          ${isPostgres ? 'JSONB' : 'TEXT'},
         result           ${isPostgres ? 'JSONB' : 'TEXT'},
         error            TEXT,
         locked_at        TIMESTAMP,
         locked_by        TEXT,
         attempts         INTEGER DEFAULT 0,
         max_attempts     INTEGER DEFAULT 3,
         created_at       TIMESTAMP DEFAULT ${NOW_DEFAULT},
         updated_at       TIMESTAMP DEFAULT ${NOW_DEFAULT}
      )
   `);

   // Typed analysis phases (lib/analysisPhases) — the editor renders fields, not a
   // progress sentence. IF NOT EXISTS on the Postgres path keeps the server log clean.
   // status_text / stream_text carry the two generation channels (lib/streamText).
   if (isPostgres) {
      try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS progress_json TEXT`); } catch {}
      try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS status_text TEXT`); } catch {}
      try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS stream_text TEXT`); } catch {}
   } else {
      try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN progress_json TEXT`); } catch {}
      try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN status_text TEXT`); } catch {}
      try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN stream_text TEXT`); } catch {}
   }

   // New columns for AI ranking score
   if (isPostgres) {
      try { await db.query(`ALTER TABLE articles ADD COLUMN ranking_score INTEGER`); } catch {}
      try { await db.query(`ALTER TABLE articles ADD COLUMN ranking_signals JSONB`); } catch {}
      try { await db.query(`ALTER TABLE articles ADD COLUMN ai_info_to_cover JSONB`); } catch {}
   } else {
      try { await db.query(`ALTER TABLE articles ADD COLUMN ranking_score INTEGER`); } catch {}
      try { await db.query(`ALTER TABLE articles ADD COLUMN ranking_signals TEXT`); } catch {}
      try { await db.query(`ALTER TABLE articles ADD COLUMN ai_info_to_cover TEXT`); } catch {}
   }

   // Wizard language (used by generation to write in the analysed language)
   try { await db.query(`ALTER TABLE articles ADD COLUMN language TEXT DEFAULT 'pl'`); } catch {}

   // Ranking content gathered at the deep-analysis step (Google Search + AI-cited
   // sources) — shown in the New-Content wizard "Ranking content" panel.
   try { await db.query(`ALTER TABLE articles ADD COLUMN ranking_sources TEXT`); } catch {}

   // Saved New-Content wizard progress (step + selections) so an unfinished draft
   // can be resumed from the Content Editor. Cleared once generation starts.
   try { await db.query(`ALTER TABLE articles ADD COLUMN wizard_state TEXT`); } catch {}

   // Which planner/writer pipeline produced the article — so a later quality drop
   // can be traced back to the version that wrote it.
   try { await db.query(`ALTER TABLE articles ADD COLUMN pipeline_version TEXT`); } catch {}

   // Cached Plagiarism Check result so it survives reloads (avoids re-scanning).
   try { await db.query(`ALTER TABLE articles ADD COLUMN plagiarism_json TEXT`); } catch {}

   // Cached AI Readability rubric result (10-criteria LLM assessment).
   try { await db.query(`ALTER TABLE articles ADD COLUMN ai_readability_json TEXT`); } catch {}

   // WordPress publish tracking: the remote post id (so re-publish UPDATES it instead
   // of creating a duplicate) and its last-known status (draft / publish).
   try { await db.query(`ALTER TABLE articles ADD COLUMN wp_post_id INTEGER`); } catch {}
   try { await db.query(`ALTER TABLE articles ADD COLUMN wp_post_status TEXT`); } catch {}

   // Threaded comments: replies (parent_id), resolved threads, edit timestamp.
   try { await db.query(`ALTER TABLE article_comments ADD COLUMN parent_id TEXT`); } catch {}
   try { await db.query(`ALTER TABLE article_comments ADD COLUMN resolved INTEGER DEFAULT 0`); } catch {}
   try { await db.query(`ALTER TABLE article_comments ADD COLUMN updated_at TIMESTAMP`); } catch {}
   try { await db.query(`ALTER TABLE article_comments ADD COLUMN reactions_json TEXT`); } catch {}
   try { await db.query(`ALTER TABLE article_comments ADD COLUMN avatar_url TEXT`); } catch {}
   // 1 when authored by the article owner (authenticated), 0 for anonymous share-token reviewers.
   // Anonymous reviewers may not edit/delete owner comments — this is the non-spoofable flag for that.
   try { await db.query(`ALTER TABLE article_comments ADD COLUMN is_owner INTEGER DEFAULT 0`); } catch {}
   try { await db.query(`CREATE INDEX IF NOT EXISTS idx_article_comments_article ON article_comments(article_id)`); } catch {}
   try { await db.query(`CREATE INDEX IF NOT EXISTS idx_article_comments_parent ON article_comments(parent_id)`); } catch {}

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

   try { await db.query(`CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status)`); } catch {}
   try { await db.query(`CREATE INDEX IF NOT EXISTS idx_analysis_jobs_article ON analysis_jobs(article_id)`); } catch {}

   tablesChecked = true;
   console.log('[articles] Tables ready');
}
