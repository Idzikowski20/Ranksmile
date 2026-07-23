import type { PipelineWorker } from '../types';

/** Fast live score — cache/corpus aware; multi-score overall. */
export const liveScoreWorker: PipelineWorker = {
  id: 'live_score',
  queue: 'live_score',
  workerVersion: '1',
  retryPolicy: { maxAttempts: 1, backoffMs: 0 },
  costEstimate: () => 0,
  produces: ['live_score'],
  consumes: ['html', 'score_data'],
  async execute(ctx) {
    const html = String(ctx.payload.html || '');
    const keyword = String(ctx.payload.keyword || '');
    const scoreData = (ctx.payload.score_data || ctx.payload.scoreData || {}) as Record<string, unknown>;
    if (!html) return { ok: false, error: 'html required' };

    const { scoreArticleHtml } = await import('../../scoreArticleHtml');
    const { computeMultiScore } = await import('../../engines/multiScore');
    const { computeGeoCues } = await import('../../geo/geoCues');
    const { cacheGetOrLoad } = await import('../../pipeline/cacheLayers');

    const coverageItems = Array.isArray(ctx.payload.coverageItems)
      ? ctx.payload.coverageItems
      : undefined;

    const scores = scoreArticleHtml({
      html,
      keyword,
      scoreData: scoreData as Parameters<typeof scoreArticleHtml>[0]['scoreData'],
      coverageItems: coverageItems as Parameters<typeof scoreArticleHtml>[0]['coverageItems'],
    });

    const geo = computeGeoCues(html, scores.plainText);
    const coveragePct =
      scores.liveItems.length > 0
        ? Math.round(
            (scores.liveItems.filter((i) => i.covered).length / scores.liveItems.length) * 100,
          )
        : scores.ai;

    const multi = computeMultiScore({
      seo: scores.seo,
      ai: scores.ai,
      coverage: coveragePct,
      authority: scores.seo,
      originality: 50,
      structure: Math.min(100, scores.headings * 8),
      geo: geo.score,
    });

    // Optional corpus cache touch
    let cacheLayer: string | undefined;
    if (ctx.payload.workspaceId && keyword) {
      const cached = await cacheGetOrLoad({
        namespace: 'coverage',
        parts: [String(ctx.payload.workspaceId), keyword, String(ctx.payload.corpusId || 'none')],
        ttlMs: 30_000,
        loadL3: async () => null,
      });
      cacheLayer = cached.layer;
    }

    return {
      ok: true,
      cacheHit: cacheLayer === 'L1' || cacheLayer === 'L2',
      estimatedCost: 0,
      actualCost: 0,
      result: {
        seoScore: scores.seo,
        aiScore: scores.ai,
        overall: multi.overall,
        multiScore: multi,
        geo,
        cacheLayer,
      },
    };
  },
};
