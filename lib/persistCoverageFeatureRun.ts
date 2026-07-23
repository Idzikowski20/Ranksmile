import type { CoverageSnapshot } from './aiCoverage';
import type { ArticleContext } from './articleContext';
import { runFeatures } from './features/featureEngine';
import {
  getFeatureStoreOrNull,
  persistFeatureRun,
  resolveFeatureStore,
  type FeatureStore,
} from './featureStoreCore';
import {
  assignExperimentBucket,
  COVERAGE_EXPERIMENT,
} from './primitives/experiments';
import { makeDomainEvent } from './primitives/events';
import type { Action, ExperimentRef, Feature, Observation } from './primitives/types';

export type PersistCoverageFeatureResult = {
  features: Feature[];
  actions: Action[];
  observations: Observation[];
  experiment: ExperimentRef;
};

function resolveStore(explicit?: FeatureStore): FeatureStore {
  if (explicit) return explicit;
  const existing = getFeatureStoreOrNull();
  if (existing) return existing;
  // Jest / unit tests: never pull Sequelize (uuid ESM breaks).
  if (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test') {
    const { createMemoryFeatureStore } = require('./featureStoreCore') as typeof import('./featureStoreCore');
    return resolveFeatureStore(() => createMemoryFeatureStore());
  }
  try {
    // Lazy-load DB store so unit tests that pass `store` never import sequelize.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createDbFeatureStore } = require('./featureStore') as typeof import('./featureStore');
    return resolveFeatureStore(() => createDbFeatureStore());
  } catch {
    const { createMemoryFeatureStore } = require('./featureStoreCore') as typeof import('./featureStoreCore');
    return resolveFeatureStore(() => createMemoryFeatureStore());
  }
}

/**
 * After ai_info_to_cover is written: append Observations + immutable Coverage Feature version.
 * Non-fatal by design — callers should catch/warn.
 */
export async function persistCoverageFeatureRun(opts: {
  snapshot: CoverageSnapshot;
  articleId: number;
  domainId?: number;
  keyword?: string;
  articleContext?: ArticleContext | null;
  store?: FeatureStore;
}): Promise<PersistCoverageFeatureResult> {
  const store = resolveStore(opts.store);

  const experiment = assignExperimentBucket(COVERAGE_EXPERIMENT, `article:${opts.articleId}`);
  const scope = {
    articleId: opts.articleId,
    domainId: opts.domainId,
    experiment,
  };

  const prev = await store.listFeatures({
    featureId: 'coverage',
    articleId: opts.articleId,
    limit: 1,
  });
  const nextVersion = (prev[0]?.version ?? 0) + 1;

  const result = runFeatures({
    snapshot: opts.snapshot,
    articleContext: opts.articleContext,
    articleId: String(opts.articleId),
    snapshotId: opts.snapshot.createdAt,
  });

  const features = result.features.map((f) =>
    f.id === 'coverage'
      ? {
          ...f,
          version: nextVersion,
          createdAt: new Date().toISOString(),
          snapshotId: opts.snapshot.createdAt,
        }
      : f,
  );

  await persistFeatureRun({ features, observations: result.observations }, scope, store);

  const recordEvent = async (
    type: 'FeatureComputed' | 'ObservationRecorded',
    payload: Record<string, unknown>,
  ) => {
    if (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test') {
      void makeDomainEvent(type, payload, { articleId: opts.articleId, domainId: opts.domainId });
      return;
    }
    try {
      const { persistDomainEvent } = await import('./growthMetaStore');
      await persistDomainEvent(type, payload, { articleId: opts.articleId, domainId: opts.domainId });
    } catch {
      void makeDomainEvent(type, payload, { articleId: opts.articleId, domainId: opts.domainId });
    }
  };

  await recordEvent('FeatureComputed', {
    featureId: 'coverage',
    version: nextVersion,
    experiment,
    observationCount: result.observations.length,
  });
  await recordEvent('ObservationRecorded', {
    count: result.observations.length,
    source: 'coverage',
  });

  if (!(process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test')) {
    try {
      const { buildKnowledgeLayer } = await import('./primitives/knowledgeLayer');
      const { persistKnowledgeLayer } = await import('./growthMetaStore');
      const graph = buildKnowledgeLayer({
        keyword: opts.keyword,
        articleId: opts.articleId,
        observations: result.observations,
        actions: result.actions,
      });
      await persistKnowledgeLayer({
        graph,
        articleId: opts.articleId,
        domainId: opts.domainId,
        keyword: opts.keyword,
      });
    } catch {
      /* KG persist non-fatal */
    }
  }

  return {
    features,
    actions: result.actions,
    observations: result.observations,
    experiment,
  };
}
