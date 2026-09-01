import type { PipelineWorker } from '../types';
import type { CoverageItem } from '../../aiCoverage';

/** Coverage materialize — Coverage → Gap → Reco; Feature Store write. */
export const coverageWorker: PipelineWorker = {
  id: 'coverage',
  queue: 'coverage',
  workerVersion: '2',
  retryPolicy: { maxAttempts: 2, backoffMs: 300 },
  costEstimate: () => 0.005,
  produces: ['coverage_items', 'features', 'gaps', 'actions'],
  consumes: ['corpus'],
  async execute(ctx) {
    const keyword = String(ctx.payload.keyword || '').trim();
    const corpusId = ctx.payload.corpusId != null ? String(ctx.payload.corpusId) : '';
    const plainText = String(ctx.payload.plainText || ctx.payload.html || '');
    const { getCorpusById } = await import('../../corpus/corpusService');
    const { runCoverageEngine } = await import('../../engines/coverageEngine');
    const { runGapEngine } = await import('../../engines/gapEngine');
    const { runRecommendationEngine } = await import('../../engines/gapToReco');
    const { upsertSerpCoverageFeatures } = await import('../../features/serpCoverageFeatures');
    const { computeMultiScore } = await import('../../engines/multiScore');
    const { cachePut } = await import('../../pipeline/cacheLayers');
    const { isWorkerAllowedAtStage } = await import('../../pipeline/pipelineStage');

    const corpus = corpusId ? await getCorpusById(corpusId) : null;
    const terms = Array.isArray(ctx.payload.terms)
      ? (ctx.payload.terms as Array<{ term: string; doc_freq?: number; target_count?: number }>)
      : [];
    const paaQuestions = Array.isArray(ctx.payload.paaQuestions)
      ? (ctx.payload.paaQuestions as Array<{ question: string; answer?: string }>)
      : [];

    const covered = runCoverageEngine({
      keyword,
      terms,
      paaQuestions,
      urls: corpus?.urls ?? [],
    });

    // Merge NER entities (never invent from TF-IDF)
    const entityItems = Array.isArray(ctx.payload.entityItems)
      ? (ctx.payload.entityItems as CoverageItem[]).filter((i) => i.type === 'entity')
      : [];
    const items = [...covered.items, ...entityItems];
    const byType: Record<string, CoverageItem[]> = { ...covered.byType };
    if (entityItems.length) byType.entity = entityItems;

    const gaps = runGapEngine({ items, plainText });
    const recos = runRecommendationEngine({
      gaps: gaps.gaps,
      articleId: ctx.payload.articleId != null ? Number(ctx.payload.articleId) : undefined,
      domainId: ctx.payload.domainId != null ? Number(ctx.payload.domainId) : undefined,
    });

    await upsertSerpCoverageFeatures({
      workspaceId: String(ctx.payload.workspaceId || '0'),
      articleId: ctx.payload.articleId != null ? Number(ctx.payload.articleId) : undefined,
      domainId: ctx.payload.domainId != null ? Number(ctx.payload.domainId) : undefined,
      keyword,
      corpusVersion: corpus?.corpusVersion,
      concepts: byType.concept ?? [],
      terms: byType.term ?? [],
    });

    const multi = computeMultiScore({
      seo: Math.round(gaps.coverageRatio * 100),
      ai: Math.round(gaps.coverageRatio * 90),
      coverage: Math.round(gaps.coverageRatio * 100),
    });

    await cachePut({
      namespace: 'coverage',
      parts: [String(ctx.payload.workspaceId || '0'), keyword, corpusId || 'none'],
      value: { items: items.slice(0, 80), multi },
      ttlMs: 120_000,
    });

    const result = {
      ok: true as const,
      estimatedCost: 0.005,
      actualCost: 0.005,
      corpusVersion: corpus?.corpusVersion,
      snapshotId: corpusId || undefined,
      result: {
        conceptCount: (byType.concept ?? []).length,
        termCount: (byType.term ?? []).length,
        entityCount: entityItems.length,
        gapCount: gaps.gaps.length,
        actionCount: recos.actions.length,
        multiScore: multi,
        items: items.slice(0, 40),
        actions: recos.actions.slice(0, 12),
      },
    };

    // Stage ≥ 2: chain planner (Etap 0 stays serp→coverage only)
    if (isWorkerAllowedAtStage('planner') && recos.actions.length) {
      return {
        ...result,
        nextQueue: 'planner' as const,
        nextPayload: {
          ...ctx.payload,
          actions: recos.actions,
          coverageItems: items.slice(0, 80),
        },
      };
    }

    return result;
  },
};
