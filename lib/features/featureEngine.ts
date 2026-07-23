import type { CoverageSnapshot } from '../aiCoverage';
import type { ArticleContext } from '../articleContext';
import { buildGuidelines } from '../recommendationEngine';
import { computeCoverageScores } from '../aiCoverage';
import type { Action, Feature, Observation, ScoreVector } from '../primitives/types';
import { guidelinesToActions } from '../primitives/guidelineToAction';
import { prioritizeActions } from '../primitives/prioritizeActions';
import {
  defaultFeatureRegistry,
  type FeatureContext,
  type FeatureProducer,
  type FeatureRegistration,
} from '../primitives/featureRegistry';
import { persistFeatureRun, type FeatureStoreScope } from '../featureStoreCore';

export type { FeatureContext, FeatureProducer };

export type RunFeaturesOptions = {
  producers?: FeatureProducer[];
  /** Append observations + immutable feature versions to FeatureStore. */
  persist?: boolean;
  scope?: FeatureStoreScope;
};

function scoreDistribution(values: number[]): ScoreVector['distribution'] {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: Math.round(median * 10) / 10,
    p25: sorted[Math.floor((sorted.length - 1) * 0.25)],
    p75: sorted[Math.floor((sorted.length - 1) * 0.75)],
    variance: Math.round(variance * 100) / 100,
  };
}

/** Coverage observations from uncovered snapshot items (append-only facts). */
export function observationsFromCoverage(snapshot: CoverageSnapshot, articleId?: string): Observation[] {
  const at = new Date().toISOString();
  return snapshot.items
    .filter((i) => !i.covered || (i.quality ?? 0) < 4)
    .map((i) => ({
      id: `obs-coverage-${i.id}`,
      kind: i.type === 'intent' ? 'coverage_gap' : 'missing_topic',
      source: 'coverage' as const,
      observedAt: at,
      articleId: articleId ? Number(articleId) || undefined : undefined,
      title: i.label,
      detail: i.reason,
      severity: i.importance === 'critical' ? 'high' : i.importance === 'recommended' ? 'medium' : 'low',
      confidence: 0.75,
      relatedQuestionIds: [i.id],
    }));
}

/** Coverage feature: Observations + CoverageSnapshot → immutable Feature version. */
export const coverageFeatureProducer: FeatureProducer = {
  id: 'coverage',
  produce(ctx: FeatureContext) {
    if (!ctx.snapshot) return null;
    const observations = ctx.observations?.length
      ? ctx.observations
      : observationsFromCoverage(ctx.snapshot, ctx.articleId);
    const guidelines = buildGuidelines(ctx.snapshot, ctx.articleContext ?? undefined);
    const actions = guidelinesToActions(guidelines, {
      articleId: ctx.articleId,
      featureId: 'coverage',
      observationIds: observations.map((o) => o.id),
    });
    const scores = computeCoverageScores(
      ctx.snapshot.items,
      !!ctx.snapshot.answersMainQuestionEarly,
    );
    const bucketScores = scores.buckets.map((b) => b.score);
    const contributors = scores.buckets.map((b) => ({
      id: b.key,
      label: b.label,
      delta: Math.round(b.score - 50),
    }));
    const top = [...contributors].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    const dist = scoreDistribution(bucketScores);
    if (dist && top) dist.topContributorId = top.id;

    const score: ScoreVector = {
      score: scores.overall,
      value: scores.overall,
      confidence: 0.75,
      version: 3,
      explainability: 'Coverage bucket blend + early-answer bonus',
      explanation: 'Coverage bucket blend + early-answer bonus',
      contributors,
      components: Object.fromEntries(scores.buckets.map((b) => [b.key, b.score])),
      distribution: dist,
    };
    return {
      id: 'coverage',
      version: 1,
      createdAt: new Date().toISOString(),
      snapshotId: ctx.snapshotId || ctx.snapshot.createdAt,
      score,
      confidence: score.confidence,
      signals: scores.buckets.map((b) => ({
        id: `coverage-${b.key}`,
        key: b.key,
        value: b.earned,
      })),
      actions,
      observationIds: observations.map((o) => o.id),
    };
  },
};

const COVERAGE_REG: FeatureRegistration = {
  id: 'coverage',
  version: 1,
  dependencies: [],
  producer: coverageFeatureProducer,
};

if (!defaultFeatureRegistry.has('coverage')) {
  defaultFeatureRegistry.register(COVERAGE_REG);
}

/** Feature Engine via FeatureRegistry — plugins register; orchestrator stays stable. */
export function runFeatures(
  ctx: FeatureContext,
  producersOrOpts?: FeatureProducer[] | RunFeaturesOptions,
): { features: Feature[]; actions: Action[]; observations: Observation[] } {
  const opts: RunFeaturesOptions = Array.isArray(producersOrOpts)
    ? { producers: producersOrOpts }
    : producersOrOpts || {};
  const list = opts.producers ?? defaultFeatureRegistry.producers();
  const features: Feature[] = [];
  for (const p of list) {
    const f = p.produce(ctx);
    if (f) features.push(f);
  }
  const observations = ctx.observations?.length
    ? ctx.observations
    : ctx.snapshot
      ? observationsFromCoverage(ctx.snapshot, ctx.articleId)
      : [];
  const actions = prioritizeActions(features.flatMap((f) => f.actions));
  if (opts.persist) {
    void persistFeatureRun({ features, observations }, opts.scope).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[featureEngine] persist failed:', msg);
    });
  }
  return { features, actions, observations };
}

/** Awaitable persist path for API routes / jobs. */
export async function runFeaturesAndPersist(
  ctx: FeatureContext,
  opts?: Omit<RunFeaturesOptions, 'persist'>,
): Promise<{ features: Feature[]; actions: Action[]; observations: Observation[] }> {
  const result = runFeatures(ctx, { ...opts, persist: false });
  await persistFeatureRun(result, opts?.scope);
  return result;
}

export function coverageActionsFromSnapshot(
  snapshot: CoverageSnapshot,
  opts?: { articleContext?: ArticleContext | null; articleId?: string },
): Action[] {
  return runFeatures({
    snapshot,
    articleContext: opts?.articleContext,
    articleId: opts?.articleId,
  }).actions;
}
