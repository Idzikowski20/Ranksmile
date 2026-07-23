import { QueryTypes } from 'sequelize';
import db from '../database/database';
import { ensureDomainEventTables, ensureKnowledgeLayerTables } from './ensureGrowthMetaTables';
import type { DomainEvent, KnowledgeLayerStub } from './primitives/types';
import { makeDomainEvent } from './primitives/events';

/** Persist DomainEvent (append-only). */
export async function persistDomainEvent(
  type: DomainEvent['type'],
  payload?: DomainEvent['payload'],
  ids?: { domainId?: number; articleId?: number },
): Promise<DomainEvent> {
  const event = makeDomainEvent(type, payload, ids);
  await ensureDomainEventTables();
  await db.query(
    `INSERT INTO growth_domain_events (event_type, at, domain_id, article_id, payload)
     VALUES (?, ?, ?, ?, ?)`,
    {
      replacements: [
        event.type,
        event.at,
        event.domainId ?? null,
        event.articleId ?? null,
        JSON.stringify(event.payload || {}),
      ],
    },
  );
  return event;
}

export async function listDomainEvents(filter: {
  articleId?: number;
  domainId?: number;
  limit?: number;
}): Promise<DomainEvent[]> {
  await ensureDomainEventTables();
  const where: string[] = [];
  const replacements: Array<string | number> = [];
  if (filter.articleId != null) {
    where.push('article_id = ?');
    replacements.push(filter.articleId);
  }
  if (filter.domainId != null) {
    where.push('domain_id = ?');
    replacements.push(filter.domainId);
  }
  replacements.push(filter.limit ?? 100);
  const rows = await db.query<{
    event_type: string;
    at: string;
    domain_id: number | null;
    article_id: number | null;
    payload: unknown;
  }>(
    `SELECT event_type, at, domain_id, article_id, payload FROM growth_domain_events
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY at DESC LIMIT ?`,
    { replacements, type: QueryTypes.SELECT },
  );
  return (rows || []).map((r) => ({
    type: r.event_type as DomainEvent['type'],
    at: String(r.at),
    domainId: r.domain_id ?? undefined,
    articleId: r.article_id ?? undefined,
    payload:
      typeof r.payload === 'string'
        ? (JSON.parse(r.payload) as Record<string, unknown>)
        : ((r.payload as Record<string, unknown>) || undefined),
  }));
}

/** Append-only Knowledge Layer graph snapshot. */
export async function persistKnowledgeLayer(opts: {
  graph: KnowledgeLayerStub;
  articleId?: number;
  domainId?: number;
  keyword?: string;
}): Promise<number> {
  await ensureKnowledgeLayerTables();
  const values = [
    opts.articleId ?? null,
    opts.domainId ?? null,
    opts.keyword ?? null,
    JSON.stringify(opts.graph),
  ];
  if (process.env.DATABASE_URL) {
    const rows = await db.query<{ id: number }>(
      `INSERT INTO growth_knowledge_layers (article_id, domain_id, keyword, graph_json)
       VALUES (?, ?, ?, ?) RETURNING id`,
      { replacements: values, type: QueryTypes.SELECT },
    );
    return rows[0]?.id ?? 0;
  }
  const [id] = await db.query(
    `INSERT INTO growth_knowledge_layers (article_id, domain_id, keyword, graph_json)
     VALUES (?, ?, ?, ?)`,
    { replacements: values, type: QueryTypes.INSERT },
  );
  return id as unknown as number;
}
