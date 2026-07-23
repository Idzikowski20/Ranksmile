import type { PipelineWorker } from '../types';

export const diffWorker: PipelineWorker = {
  id: 'diff',
  queue: 'diff',
  workerVersion: '1',
  retryPolicy: { maxAttempts: 2, backoffMs: 200 },
  costEstimate: () => 0.001,
  produces: ['planner_signals'],
  consumes: ['corpus'],
  async execute(ctx) {
    const { getLatestCorpusVersions } = await import('../../corpus/corpusService');
    const { diffCorpora } = await import('../../engines/corpusDiff');

    const workspaceId = String(ctx.payload.workspaceId || '0');
    const keyword = String(ctx.payload.keyword || '');
    const language = String(ctx.payload.language || 'pl');
    const versions = await getLatestCorpusVersions({
      workspaceId,
      keyword,
      language,
      limit: 2,
    });
    if (versions.length < 2) {
      return {
        ok: true,
        result: { signals: [], note: 'need ≥2 corpus versions' },
      };
    }
    const [next, prev] = versions;
    const diff = diffCorpora({
      prevUrls: prev.urls,
      nextUrls: next.urls,
      prevTerms: Array.isArray(ctx.payload.prevTerms)
        ? (ctx.payload.prevTerms as string[])
        : undefined,
      nextTerms: Array.isArray(ctx.payload.nextTerms)
        ? (ctx.payload.nextTerms as string[])
        : undefined,
      prevVersion: prev.corpusVersion,
      nextVersion: next.corpusVersion,
    });

    return {
      ok: true,
      estimatedCost: 0.001,
      actualCost: 0,
      corpusVersion: next.corpusVersion,
      result: diff,
      nextQueue: 'planner',
      nextPayload: {
        ...ctx.payload,
        plannerSignals: diff.signals,
        actions: Array.isArray(ctx.payload.actions) ? ctx.payload.actions : [],
      },
    };
  },
};
