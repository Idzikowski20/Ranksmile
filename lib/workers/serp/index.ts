import type { PipelineWorker } from '../types';
import { PIPELINE_VERSION } from '../../pipeline/queuePriorities';

/** SERP crawl worker — corpus via Corpus API; Serper fallback when no serpUrls. */
export const serpWorker: PipelineWorker = {
  id: 'serp',
  queue: 'serp_crawl',
  workerVersion: '2',
  retryPolicy: { maxAttempts: 3, backoffMs: 500 },
  costEstimate: () => 0.02,
  produces: ['serp_snapshot', 'corpus'],
  consumes: ['keyword'],
  async execute(ctx) {
    const keyword = String(ctx.payload.keyword || '').trim();
    const language = String(ctx.payload.language || 'pl');
    const workspaceId = String(ctx.payload.workspaceId || '0');
    if (!keyword) return { ok: false, error: 'keyword required' };

    const {
      getFreshCorpus,
      createCorpusFromSerpUrls,
      upsertCompetitorDocuments,
    } = await import('../../corpus/corpusService');
    const { decideCorpusRefresh, volatilityFromKeywordHints } = await import('../../pipeline/scheduler');
    const { cacheGetOrLoad, cachePut } = await import('../../pipeline/cacheLayers');
    const { recordJobCostActual } = await import('../../pipeline/costTelemetry');
    const { isWorkerAllowedAtStage } = await import('../../pipeline/pipelineStage');
    const { enqueueJob } = await import('../../pipeline/pipelineQueue');

    let urls = Array.isArray(ctx.payload.serpUrls)
      ? (ctx.payload.serpUrls as string[]).filter((u) => typeof u === 'string')
      : [];
    let paaFromSerper: Array<{ question: string }> = [];

    if (!urls.length) {
      const { fetchSerperUrls } = await import('../../pipeline/fetchSerperUrls');
      const fetched = await fetchSerperUrls({ keyword, language });
      urls = fetched.urls;
      paaFromSerper = fetched.paaQuestions;
    }

    const refresh = await decideCorpusRefresh({
      workspaceId,
      keyword,
      language,
      nextUrls: urls.length ? urls : undefined,
    });

    const baseNext = {
      ...ctx.payload,
      serpUrls: urls,
      paaQuestions: Array.isArray(ctx.payload.paaQuestions) && (ctx.payload.paaQuestions as unknown[]).length
        ? ctx.payload.paaQuestions
        : paaFromSerper,
    };

    if (!refresh.shouldRefresh) {
      const cached = await cacheGetOrLoad({
        namespace: 'corpus',
        parts: [workspaceId, keyword, language],
        ttlMs: 60_000,
        loadL3: () => getFreshCorpus({ workspaceId, keyword, language }),
      });
      const existing = cached.value;
      if (existing) {
        await recordJobCostActual({
          jobKey: ctx.jobKey,
          workspaceId,
          keyword,
          jobType: 'serp_crawl',
          estimatedCost: 0.02,
          actualCost: 0,
          cacheHit: true,
        });
        return {
          ok: true,
          cacheHit: true,
          estimatedCost: 0.02,
          actualCost: 0,
          corpusVersion: existing.corpusVersion,
          snapshotId: existing.id,
          result: {
            corpusId: existing.id,
            urls: existing.urls,
            cacheLayer: cached.layer,
            refreshReason: refresh.reason,
          },
          nextQueue: 'coverage',
          nextPayload: {
            ...baseNext,
            corpusId: existing.id,
            corpusVersion: existing.corpusVersion,
          },
        };
      }
    }

    const corpus = await createCorpusFromSerpUrls({
      workspaceId,
      keyword,
      language,
      pipelineVersion: PIPELINE_VERSION,
      urls,
      volatilityClass:
        String(ctx.payload.volatilityClass || '') || volatilityFromKeywordHints(keyword),
    });

    const documents = Array.isArray(ctx.payload.documents)
      ? (ctx.payload.documents as Array<{ url?: string; html?: string; text?: string }>)
      : [];
    if (documents.length) {
      await upsertCompetitorDocuments(
        corpus.id,
        documents.map((d) => ({
          url: d.url || '',
          html: d.html,
          text: d.text,
        })),
      );
    }

    await cachePut({
      namespace: 'corpus',
      parts: [workspaceId, keyword, language],
      value: corpus,
      ttlMs: 60_000,
    });
    await recordJobCostActual({
      jobKey: ctx.jobKey,
      workspaceId,
      keyword,
      jobType: 'serp_crawl',
      estimatedCost: 0.02,
      actualCost: urls.length ? 0.02 : 0.001,
      cacheHit: false,
    });

    // Stage ≥ 3: enqueue corpus diff when we created v2+
    if (corpus.corpusVersion >= 2 && isWorkerAllowedAtStage('diff')) {
      void enqueueJob({
        workspaceId,
        keyword,
        locale: language,
        queue: 'diff',
        payload: { ...baseNext, corpusId: corpus.id, corpusVersion: corpus.corpusVersion },
        force: true,
      }).catch(() => undefined);
    }

    // Stage ≥ 2: fan-out parallel fingerprint ∥ tfidf ∥ ner after corpus is ready
    if (isWorkerAllowedAtStage('fingerprint')) {
      for (const q of ['fingerprint', 'tfidf', 'ner'] as const) {
        if (!isWorkerAllowedAtStage(q)) continue;
        void enqueueJob({
          workspaceId,
          keyword,
          locale: language,
          queue: q,
          payload: {
            ...baseNext,
            corpusId: corpus.id,
            corpusVersion: corpus.corpusVersion,
          },
          force: true,
        }).catch(() => undefined);
      }
    }

    return {
      ok: true,
      cacheHit: false,
      estimatedCost: 0.02,
      actualCost: urls.length ? 0.02 : 0.001,
      corpusVersion: corpus.corpusVersion,
      snapshotId: corpus.id,
      result: { corpusId: corpus.id, urls: corpus.urls, documentCount: documents.length },
      nextQueue: 'coverage',
      nextPayload: {
        ...baseNext,
        corpusId: corpus.id,
        corpusVersion: corpus.corpusVersion,
      },
    };
  },
};
