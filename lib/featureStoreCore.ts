import type { Action, Feature, Observation, ScoreVector, Signal } from './primitives/types';
import type { ExperimentRef } from './primitives/types';

export type FeatureStoreScope = {
  domainId?: number;
  articleId?: number;
  experiment?: ExperimentRef;
};

export type ListObservationsFilter = FeatureStoreScope & {
  since?: string;
  source?: string;
  kind?: string;
  limit?: number;
};

export type ListFeaturesFilter = FeatureStoreScope & {
  featureId?: string;
  since?: string;
  limit?: number;
};

export type FeatureScoreDelta = {
  featureId: string;
  before: Feature | null;
  after: Feature | null;
  scoreDelta: number | null;
};

export type FeatureStore = {
  appendObservation: (o: Observation, scope?: FeatureStoreScope) => Promise<string>;
  appendObservations: (os: Observation[], scope?: FeatureStoreScope) => Promise<string[]>;
  appendFeature: (f: Feature, scope?: FeatureStoreScope) => Promise<number>;
  listObservations: (filter?: ListObservationsFilter) => Promise<Observation[]>;
  listFeatures: (filter?: ListFeaturesFilter) => Promise<Feature[]>;
  featureScoreDelta: (featureId: string, sinceIso: string, scope?: FeatureStoreScope) => Promise<FeatureScoreDelta>;
};

/** allFeatures sorted createdAt DESC. */
export function computeFeatureScoreDelta(
  allFeaturesDesc: Feature[],
  featureId: string,
  sinceIso: string,
): FeatureScoreDelta {
  const after = allFeaturesDesc.find((f) => f.createdAt >= sinceIso) || allFeaturesDesc[0] || null;
  const before = allFeaturesDesc.find((f) => f.createdAt < sinceIso) || null;
  const scoreDelta =
    after && before ? (after.score.value ?? after.score.score) - (before.score.value ?? before.score.score) : null;
  return { featureId, before, after, scoreDelta };
}

type StoredFeature = Feature & FeatureStoreScope;

/** In-memory append-only store for unit tests (no DB / Sequelize). */
export function createMemoryFeatureStore(): FeatureStore {
  const observations: Observation[] = [];
  const features: StoredFeature[] = [];
  let featSeq = 0;

  const store: FeatureStore = {
    async appendObservation(o, scope) {
      observations.push({
        ...o,
        domainId: scope?.domainId ?? o.domainId,
        articleId: scope?.articleId ?? o.articleId,
      });
      return o.id;
    },
    async appendObservations(os, scope) {
      const ids: string[] = [];
      for (const o of os) ids.push(await store.appendObservation(o, scope));
      return ids;
    },
    async appendFeature(f, scope) {
      features.push({ ...f, domainId: scope?.domainId, articleId: scope?.articleId });
      featSeq += 1;
      return featSeq;
    },
    async listObservations(filter = {}) {
      let list = [...observations];
      if (filter.articleId != null) list = list.filter((o) => o.articleId === filter.articleId);
      if (filter.domainId != null) list = list.filter((o) => o.domainId === filter.domainId);
      if (filter.source) list = list.filter((o) => o.source === filter.source);
      if (filter.kind) list = list.filter((o) => o.kind === filter.kind);
      if (filter.since) list = list.filter((o) => o.observedAt >= filter.since!);
      list.sort((a, b) => (a.observedAt < b.observedAt ? 1 : -1));
      return list.slice(0, filter.limit ?? 200);
    },
    async listFeatures(filter = {}) {
      let list = [...features];
      if (filter.featureId) list = list.filter((f) => f.id === filter.featureId);
      if (filter.articleId != null) list = list.filter((f) => f.articleId === filter.articleId);
      if (filter.domainId != null) list = list.filter((f) => f.domainId === filter.domainId);
      if (filter.since) list = list.filter((f) => f.createdAt >= filter.since!);
      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return list.slice(0, filter.limit ?? 100).map((row) => {
        const { domainId: _d, articleId: _a, ...f } = row;
        return f;
      });
    },
    async featureScoreDelta(featureId, sinceIso, scope) {
      return computeFeatureScoreDelta(await store.listFeatures({ featureId, ...scope, limit: 500 }), featureId, sinceIso);
    },
  };
  return store;
}

let defaultStore: FeatureStore | null = null;

export function setFeatureStore(store: FeatureStore | null): void {
  defaultStore = store;
}

export function getFeatureStoreOrNull(): FeatureStore | null {
  return defaultStore;
}

export function resolveFeatureStore(factory?: () => FeatureStore): FeatureStore {
  if (!defaultStore) defaultStore = factory ? factory() : createMemoryFeatureStore();
  return defaultStore;
}

/** Persist runFeatures output into the configured store. */
export async function persistFeatureRun(
  input: { features: Feature[]; observations: Observation[] },
  scope?: FeatureStoreScope,
  store?: FeatureStore,
): Promise<void> {
  const s = store || defaultStore || createMemoryFeatureStore();
  if (!defaultStore) defaultStore = s;
  if (input.observations.length) await s.appendObservations(input.observations, scope);
  for (const f of input.features) {
    await s.appendFeature(f, scope);
  }
}

export type { Action, Feature, Observation, ScoreVector, Signal };
