import type { PipelineWorker } from '../types';
import type { Feature, ScoreVector, Signal, Action } from '../../primitives/types';

/** AI / SERP visibility feature producer. */
export const visibilityWorker: PipelineWorker = {
  id: 'visibility',
  queue: 'visibility',
  workerVersion: '1',
  retryPolicy: { maxAttempts: 2, backoffMs: 300 },
  costEstimate: () => 0.003,
  produces: ['visibility_feature'],
  consumes: ['keyword'],
  async execute(ctx) {
    const keyword = String(ctx.payload.keyword || '');
    const workspaceId = String(ctx.payload.workspaceId || '0');
    const cited = Number(ctx.payload.citedCount ?? 0);
    const prompts = Math.max(1, Number(ctx.payload.promptCount ?? 10));
    const visibility = Math.round((cited / prompts) * 100);

    const signals: Signal[] = [
      { id: 'cited', key: 'cited_count', value: cited },
      { id: 'prompts', key: 'prompt_count', value: prompts },
      { id: 'visibility', key: 'visibility_pct', value: visibility },
    ];
    const score: ScoreVector = {
      score: visibility,
      confidence: 0.6,
      version: 1,
      contributors: [{ id: 'visibility', label: 'AI visibility', delta: visibility }],
    };
    const actions: Action[] =
      visibility < 40
        ? [
            {
              id: `vis-boost-${keyword.slice(0, 24)}`,
              type: 'cover_question',
              title: 'Improve AI citation coverage',
              instruction: `Add extractable answers for "${keyword}" that AI engines can cite.`,
              expectedLift: Math.max(3, Math.round((40 - visibility) / 5)),
              confidence: 0.55,
              cost: 'medium',
              reason: `Visibility ${visibility}% below target`,
              origin: 'visibility',
              appliesTo: { kind: 'article' },
              generatedBy: 'visibilityWorker',
              featureId: 'visibility',
            },
          ]
        : [];

    const feature: Feature = {
      id: `visibility:${workspaceId}:${keyword}`,
      // growth_feature_versions.version is INT4 — Date.now() ms overflows → DLQ "integer out of range"
      version: Math.floor(Date.now() / 1000),
      createdAt: new Date().toISOString(),
      score,
      confidence: 0.6,
      signals,
      actions,
    };

    const { getFeatureStore } = await import('../../featureStore');
    await getFeatureStore().appendFeature(feature, {
      articleId: ctx.payload.articleId != null ? Number(ctx.payload.articleId) : undefined,
      domainId: ctx.payload.domainId != null ? Number(ctx.payload.domainId) : undefined,
    });

    return {
      ok: true,
      estimatedCost: 0.003,
      actualCost: 0.002,
      result: { visibility, actions },
    };
  },
};
