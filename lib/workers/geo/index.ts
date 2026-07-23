import type { PipelineWorker } from '../types';

export const geoWorker: PipelineWorker = {
  id: 'geo',
  queue: 'geo',
  workerVersion: '1',
  retryPolicy: { maxAttempts: 1, backoffMs: 0 },
  costEstimate: () => 0.001,
  produces: ['geo_cues'],
  consumes: ['html'],
  async execute(ctx) {
    const html = String(ctx.payload.html || '');
    const plain = String(ctx.payload.plainText || html.replace(/<[^>]+>/g, ' '));
    if (!html && !plain.trim()) return { ok: false, error: 'html required' };
    const { computeGeoCues } = await import('../../geo/geoCues');
    const cues = computeGeoCues(html, plain);
    return {
      ok: true,
      estimatedCost: 0.001,
      actualCost: 0,
      result: { cues },
    };
  },
};
