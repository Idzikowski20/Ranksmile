import { QueryTypes } from 'sequelize';
import db from '../database/database';
import { ensureFeatureStoreTables } from './ensureFeatureStoreTables';
import type { Action, Feature, Observation, ScoreVector, Signal } from './primitives/types';
import {
  computeFeatureScoreDelta,
  createMemoryFeatureStore,
  getFeatureStoreOrNull,
  persistFeatureRun,
  resolveFeatureStore,
  setFeatureStore,
  type FeatureStore,
  type FeatureStoreScope,
  type ListFeaturesFilter,
  type ListObservationsFilter,
} from './featureStoreCore';

export type {
  FeatureStore,
  FeatureStoreScope,
  FeatureScoreDelta,
  ListFeaturesFilter,
  ListObservationsFilter,
} from './featureStoreCore';

export {
  computeFeatureScoreDelta,
  createMemoryFeatureStore,
  persistFeatureRun,
  setFeatureStore,
} from './featureStoreCore';

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToObservation(row: Record<string, unknown>): Observation {
  const payload = parseJson<Record<string, unknown>>(row.payload, {});
  return {
    id: String(row.obs_id),
    kind: String(row.kind),
    source: String(row.source),
    observedAt: String(row.observed_at),
    domainId: row.domain_id != null ? Number(row.domain_id) : undefined,
    articleId: row.article_id != null ? Number(row.article_id) : undefined,
    title: String(row.title),
    detail: row.detail != null ? String(row.detail) : undefined,
    severity: row.severity as Observation['severity'],
    score: row.score != null ? Number(row.score) : undefined,
    confidence: row.confidence != null ? Number(row.confidence) : undefined,
    payload: Object.keys(payload).length ? payload : undefined,
    evidence: Array.isArray(payload.evidence) ? (payload.evidence as Observation['evidence']) : undefined,
    relatedTopicIds: Array.isArray(payload.relatedTopicIds)
      ? (payload.relatedTopicIds as string[])
      : undefined,
    relatedEntityIds: Array.isArray(payload.relatedEntityIds)
      ? (payload.relatedEntityIds as string[])
      : undefined,
    relatedQuestionIds: Array.isArray(payload.relatedQuestionIds)
      ? (payload.relatedQuestionIds as string[])
      : undefined,
  };
}

function rowToFeature(row: Record<string, unknown>): Feature {
  return {
    id: String(row.feature_id),
    version: Number(row.version),
    createdAt: String(row.created_at),
    snapshotId: row.snapshot_id != null ? String(row.snapshot_id) : undefined,
    score: parseJson<ScoreVector>(row.score_json, { score: 0, confidence: 0, version: 1, contributors: [] }),
    confidence: row.confidence != null ? Number(row.confidence) : 0,
    signals: parseJson<Signal[]>(row.signals_json, []),
    actions: parseJson<Action[]>(row.actions_json, []),
    observationIds: parseJson<string[]>(row.observation_ids_json, []),
  };
}

function obsPayload(o: Observation): Record<string, unknown> {
  return {
    ...(o.payload || {}),
    evidence: o.evidence,
    relatedTopicIds: o.relatedTopicIds,
    relatedEntityIds: o.relatedEntityIds,
    relatedQuestionIds: o.relatedQuestionIds,
  };
}

/** Durable DB-backed store (Postgres / SQLite). */
export function createDbFeatureStore(): FeatureStore {
  const store: FeatureStore = {
    async appendObservation(o, scope) {
      await ensureFeatureStoreTables();
      const domainId = scope?.domainId ?? o.domainId ?? null;
      const articleId = scope?.articleId ?? o.articleId ?? null;
      await db.query(
        `INSERT INTO growth_observations
          (obs_id, kind, source, observed_at, domain_id, article_id, title, detail, severity, score, confidence, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        {
          replacements: [
            o.id,
            o.kind,
            o.source,
            o.observedAt,
            domainId,
            articleId,
            o.title,
            o.detail ?? null,
            o.severity ?? null,
            o.score ?? null,
            o.confidence ?? null,
            JSON.stringify(obsPayload(o)),
          ],
        },
      );
      return o.id;
    },

    async appendObservations(os, scope) {
      const ids: string[] = [];
      for (const o of os) ids.push(await store.appendObservation(o, scope));
      return ids;
    },

    async appendFeature(f, scope) {
      await ensureFeatureStoreTables();
      const values = [
        f.id,
        f.version,
        f.createdAt,
        f.snapshotId ?? null,
        scope?.domainId ?? null,
        scope?.articleId ?? null,
        JSON.stringify(f.score),
        f.confidence,
        JSON.stringify(f.signals || []),
        JSON.stringify(f.actions || []),
        JSON.stringify(f.observationIds || []),
        scope?.experiment?.id ?? null,
        scope?.experiment?.variant ?? null,
        scope?.experiment?.bucket ?? null,
      ];
      if (process.env.DATABASE_URL) {
        const rows = await db.query<{ id: number }>(
          `INSERT INTO growth_feature_versions
            (feature_id, version, created_at, snapshot_id, domain_id, article_id,
             score_json, confidence, signals_json, actions_json, observation_ids_json,
             experiment_id, experiment_variant, experiment_bucket)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING id`,
          { replacements: values, type: QueryTypes.SELECT },
        );
        return rows[0]?.id ?? 0;
      }
      const [insertedId] = await db.query(
        `INSERT INTO growth_feature_versions
          (feature_id, version, created_at, snapshot_id, domain_id, article_id,
           score_json, confidence, signals_json, actions_json, observation_ids_json,
           experiment_id, experiment_variant, experiment_bucket)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        { replacements: values, type: QueryTypes.INSERT },
      );
      return insertedId as unknown as number;
    },

    async listObservations(filter: ListObservationsFilter = {}) {
      await ensureFeatureStoreTables();
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
      if (filter.source) {
        where.push('source = ?');
        replacements.push(filter.source);
      }
      if (filter.kind) {
        where.push('kind = ?');
        replacements.push(filter.kind);
      }
      if (filter.since) {
        where.push('observed_at >= ?');
        replacements.push(filter.since);
      }
      replacements.push(filter.limit ?? 200);
      const rows = await db.query<Record<string, unknown>>(
        `SELECT * FROM growth_observations
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY observed_at DESC
        LIMIT ?`,
        { replacements, type: QueryTypes.SELECT },
      );
      return (rows || []).map(rowToObservation);
    },

    async listFeatures(filter: ListFeaturesFilter = {}) {
      await ensureFeatureStoreTables();
      const where: string[] = [];
      const replacements: Array<string | number> = [];
      if (filter.featureId) {
        where.push('feature_id = ?');
        replacements.push(filter.featureId);
      }
      if (filter.articleId != null) {
        where.push('article_id = ?');
        replacements.push(filter.articleId);
      }
      if (filter.domainId != null) {
        where.push('domain_id = ?');
        replacements.push(filter.domainId);
      }
      if (filter.since) {
        where.push('created_at >= ?');
        replacements.push(filter.since);
      }
      replacements.push(filter.limit ?? 100);
      const rows = await db.query<Record<string, unknown>>(
        `SELECT * FROM growth_feature_versions
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY created_at DESC
        LIMIT ?`,
        { replacements, type: QueryTypes.SELECT },
      );
      return (rows || []).map(rowToFeature);
    },

    async featureScoreDelta(featureId, sinceIso, scope) {
      return computeFeatureScoreDelta(
        await store.listFeatures({ featureId, ...scope, limit: 500 }),
        featureId,
        sinceIso,
      );
    },
  };
  return store;
}

/** Process-default store: DB in runtime. */
export function getFeatureStore(): FeatureStore {
  const existing = getFeatureStoreOrNull();
  if (existing) return existing;
  return resolveFeatureStore(() => createDbFeatureStore());
}
