import type { PipelineWorker } from '../types';
import type { CoverageItem } from '../../aiCoverage';

/** Async NER worker — ENTITY coverage only; never from TF-IDF. */
export const nerWorker: PipelineWorker = {
  id: 'ner',
  queue: 'ner',
  workerVersion: '2',
  retryPolicy: { maxAttempts: 2, backoffMs: 400 },
  costEstimate: () => 0.01,
  produces: ['entities', 'entity_coverage'],
  consumes: ['corpus', 'html'],
  async execute(ctx) {
    const text = String(ctx.payload.plainText || ctx.payload.html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Prefer competitor documents text when article html empty
    let corpusText = text;
    if (!corpusText && Array.isArray(ctx.payload.documents)) {
      corpusText = (ctx.payload.documents as Array<{ text?: string; html?: string }>)
        .map((d) => d.text || d.html || '')
        .join('\n')
        .replace(/<[^>]+>/g, ' ')
        .slice(0, 50_000);
    }
    if (!corpusText.trim()) return { ok: false, error: 'text required for NER' };

    const { heuristicNerExtract, resolveEntities } = await import('../../entities/entityResolver');
    let raw: Parameters<typeof resolveEntities>[0] = Array.isArray(ctx.payload.nerSpans)
      ? (ctx.payload.nerSpans as Parameters<typeof resolveEntities>[0])
      : [];

    if (!raw.length) {
      try {
        const { callSidecar } = await import('../../sidecar');
        const resp = await callSidecar<{
          spans?: Array<{ text: string; label?: string; start?: number; end?: number; score?: number }>;
        }>(
          '/ner',
          {
            text: corpusText.slice(0, 50_000),
            language: String(ctx.payload.language || 'pl'),
            max_spans: 40,
          },
          30_000,
        );
        raw = resp.spans || [];
      } catch {
        raw = heuristicNerExtract(corpusText.slice(0, 50_000));
      }
    }
    if (!raw.length) raw = heuristicNerExtract(corpusText.slice(0, 50_000));

    const resolved = resolveEntities(raw);
    const entities: CoverageItem[] = resolved.map((e) => ({
      id: e.id,
      label: e.canonical,
      type: 'entity' as const,
      category: 'knowledge' as const,
      importance: e.confidence >= 0.75 ? ('critical' as const) : ('recommended' as const),
      source: 'competitors' as const,
      covered: false,
      quality: 0,
      confidence: e.confidence,
      reason: `NER ${e.type} (worker_version=${ctx.workerVersion})`,
    }));

    return {
      ok: true,
      estimatedCost: 0.01,
      actualCost: 0.008,
      result: {
        workerVersion: ctx.workerVersion,
        entityCount: entities.length,
        entities,
        resolved,
      },
      nextQueue: 'coverage',
      nextPayload: {
        ...ctx.payload,
        entityItems: entities,
        nerWorkerVersion: ctx.workerVersion,
      },
    };
  },
};
