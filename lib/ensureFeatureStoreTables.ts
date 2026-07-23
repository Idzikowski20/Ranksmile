import db from '../database/database';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const JSON_T = isPostgres ? 'JSONB' : 'TEXT';
const NOW = 'CURRENT_TIMESTAMP';

function ignoreExisting(label: string, e: unknown): void {
  const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
  if (!/exist|duplicate|already/i.test(m)) console.warn(`[feature-store] ${label} failed:`, m);
}

/** Append-only Observation + Feature version tables (Q2). Never UPDATE feature rows. */
export async function ensureFeatureStoreTables(): Promise<void> {
  if (checked) return;

  await db
    .query(
      `CREATE TABLE IF NOT EXISTS growth_observations (
      id ${PK},
      obs_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      source TEXT NOT NULL,
      observed_at TIMESTAMP NOT NULL,
      domain_id INTEGER,
      article_id INTEGER,
      title TEXT NOT NULL,
      detail TEXT,
      severity TEXT,
      score REAL,
      confidence REAL,
      payload ${JSON_T},
      created_at TIMESTAMP DEFAULT ${NOW}
    )`,
    )
    .catch((e) => ignoreExisting('growth_observations', e));

  await db
    .query(
      `CREATE INDEX IF NOT EXISTS idx_growth_obs_article ON growth_observations (article_id, observed_at)`,
    )
    .catch((e) => ignoreExisting('idx_growth_obs_article', e));

  await db
    .query(
      `CREATE INDEX IF NOT EXISTS idx_growth_obs_domain ON growth_observations (domain_id, observed_at)`,
    )
    .catch((e) => ignoreExisting('idx_growth_obs_domain', e));

  await db
    .query(
      `CREATE TABLE IF NOT EXISTS growth_feature_versions (
      id ${PK},
      feature_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL,
      snapshot_id TEXT,
      domain_id INTEGER,
      article_id INTEGER,
      score_json ${JSON_T} NOT NULL,
      confidence REAL,
      signals_json ${JSON_T},
      actions_json ${JSON_T},
      observation_ids_json ${JSON_T},
      experiment_id TEXT,
      experiment_variant TEXT,
      experiment_bucket TEXT,
      inserted_at TIMESTAMP DEFAULT ${NOW}
    )`,
    )
    .catch((e) => ignoreExisting('growth_feature_versions', e));

  await db
    .query(
      `CREATE INDEX IF NOT EXISTS idx_growth_feat_id ON growth_feature_versions (feature_id, created_at)`,
    )
    .catch((e) => ignoreExisting('idx_growth_feat_id', e));

  checked = true;
}

/** Test helper — allow re-ensure after schema changes in same process. */
export function resetFeatureStoreTablesCheck(): void {
  checked = false;
}
