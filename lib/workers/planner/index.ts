import type { PipelineWorker } from '../types';

export const plannerWorker: PipelineWorker = {
  id: 'planner',
  queue: 'planner',
  workerVersion: '1',
  retryPolicy: { maxAttempts: 2, backoffMs: 300 },
  costEstimate: () => 0.004,
  produces: ['plan', 'actions'],
  consumes: ['features', 'actions'],
  async execute(ctx) {
    const actions = Array.isArray(ctx.payload.actions)
      ? (ctx.payload.actions as Parameters<typeof import('../../engines/planner').planActions>[0]['actions'])
      : [];
    const { planActions } = await import('../../engines/planner');
    const { getFeatureStore } = await import('../../featureStore');

    let features: Parameters<typeof planActions>[0]['features'] = [];
    try {
      const store = getFeatureStore();
      if (ctx.payload.articleId != null) {
        const list = await store.listFeatures({
          articleId: Number(ctx.payload.articleId),
        });
        features = list;
      }
    } catch {
      features = [];
    }

    const plan = planActions({ actions, features, maxActions: 15 });
    return {
      ok: true,
      estimatedCost: 0.004,
      actualCost: 0.003,
      result: {
        ranked: plan.ranked,
        totalExpectedLift: plan.totalExpectedLift,
      },
    };
  },
};
