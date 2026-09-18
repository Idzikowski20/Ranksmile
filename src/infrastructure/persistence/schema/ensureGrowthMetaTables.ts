import db from '@/database/database';
import { ignoreExistingSchema } from '@/src/core/shared/ignoreExistingSchema';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const JSON_T = isPostgres ? 'JSONB' : 'TEXT';
const NOW = 'CURRENT_TIMESTAMP';

const ignoreExisting = (label: string, e: unknown): void => ignoreExistingSchema('growth-events', label, e);

export async function ensureDomainEventTables(): Promise<void> {
  if (checked) return;
  await db
    .query(
      `CREATE TABLE IF NOT EXISTS growth_domain_events (
      id ${PK},
      event_type TEXT NOT NULL,
      at TIMESTAMP NOT NULL,
      domain_id INTEGER,
      article_id INTEGER,
      payload ${JSON_T},
      created_at TIMESTAMP DEFAULT ${NOW}
    )`,
    )
    .catch((e) => ignoreExisting('growth_domain_events', e));
  await db
    .query('CREATE INDEX IF NOT EXISTS idx_growth_events_article ON growth_domain_events (article_id, at)')
    .catch((e) => ignoreExisting('idx_growth_events_article', e));
  checked = true;
}

export async function ensureKnowledgeLayerTables(): Promise<void> {
  await ensureDomainEventTables();
  await db
    .query(
      `CREATE TABLE IF NOT EXISTS growth_knowledge_layers (
      id ${PK},
      article_id INTEGER,
      domain_id INTEGER,
      keyword TEXT,
      graph_json ${JSON_T} NOT NULL,
      created_at TIMESTAMP DEFAULT ${NOW}
    )`,
    )
    .catch((e) => ignoreExisting('growth_knowledge_layers', e));
  await db
    .query(
      'CREATE INDEX IF NOT EXISTS idx_growth_kg_article ON growth_knowledge_layers (article_id, created_at)',
    )
    .catch((e) => ignoreExisting('idx_growth_kg_article', e));
}
