import db from '../database/database';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const JSON_T = isPostgres ? 'JSONB' : 'TEXT';
const NOW = 'CURRENT_TIMESTAMP';

function ignoreExisting(label: string, e: unknown): void {
  const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
  if (!/exist|duplicate|already/i.test(m)) console.warn(`[corpus] ${label} failed:`, m);
}

export async function ensureCorpusTables(): Promise<void> {
  if (checked) return;

  await db
    .query(
      `CREATE TABLE IF NOT EXISTS serp_corpora (
      id ${PK},
      corpus_id TEXT NOT NULL UNIQUE,
      workspace_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'pl',
      corpus_version INTEGER NOT NULL,
      pipeline_version TEXT NOT NULL,
      volatility_class TEXT DEFAULT 'medium',
      refresh_policy_hours INTEGER DEFAULT 24,
      urls_json ${JSON_T},
      fetched_at TIMESTAMP NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT ${NOW}
    )`,
    )
    .catch((e) => ignoreExisting('serp_corpora', e));

  await db
    .query(
      `CREATE INDEX IF NOT EXISTS idx_serp_corpora_ws_kw ON serp_corpora (workspace_id, keyword, language, corpus_version)`,
    )
    .catch((e) => ignoreExisting('idx_serp_corpora_ws_kw', e));

  await db
    .query(
      `CREATE TABLE IF NOT EXISTS serp_fingerprints (
      id ${PK},
      corpus_id TEXT NOT NULL,
      h2_avg REAL,
      faq_rate REAL,
      schema_rate REAL,
      tables_rate REAL,
      media_rate REAL,
      citations_rate REAL,
      para_len_avg REAL,
      entity_count INTEGER,
      concept_count INTEGER,
      metrics_json ${JSON_T},
      created_at TIMESTAMP DEFAULT ${NOW}
    )`,
    )
    .catch((e) => ignoreExisting('serp_fingerprints', e));

  await db
    .query(
      `CREATE TABLE IF NOT EXISTS competitor_documents (
      id ${PK},
      corpus_id TEXT NOT NULL,
      url TEXT NOT NULL,
      content_md TEXT,
      content_hash TEXT,
      quality_score REAL,
      simhash TEXT,
      created_at TIMESTAMP DEFAULT ${NOW}
    )`,
    )
    .catch((e) => ignoreExisting('competitor_documents', e));

  await db
    .query(
      `CREATE TABLE IF NOT EXISTS knowledge_edges (
      id ${PK},
      workspace_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      relation TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      weight REAL DEFAULT 1,
      version INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT ${NOW}
    )`,
    )
    .catch((e) => ignoreExisting('knowledge_edges', e));

  await db
    .query(
      `CREATE TABLE IF NOT EXISTS workspace_brand_knowledge (
      id ${PK},
      workspace_id TEXT NOT NULL UNIQUE,
      brand TEXT,
      products_json ${JSON_T},
      usp TEXT,
      style TEXT,
      entities_json ${JSON_T},
      forbidden_claims_json ${JSON_T},
      preferred_sources_json ${JSON_T},
      updated_at TIMESTAMP DEFAULT ${NOW}
    )`,
    )
    .catch((e) => ignoreExisting('workspace_brand_knowledge', e));

  await db
    .query(
      `CREATE TABLE IF NOT EXISTS optimization_history (
      id ${PK},
      workspace_id TEXT,
      article_id INTEGER,
      change_type TEXT,
      change_detail ${JSON_T},
      before_score REAL,
      after_score REAL,
      ranking_delta REAL,
      ai_citation_delta REAL,
      created_at TIMESTAMP DEFAULT ${NOW}
    )`,
    )
    .catch((e) => ignoreExisting('optimization_history', e));

  checked = true;
}
