/**
 * Fire-and-forget bridge: deep-analysis sidecar result → v7 pipeline queue.
 * Does not block SSE / sidecar path.
 */
import { enqueueJob } from './pipelineQueue';
import type { EnqueueResult } from './pipelineQueue';
import { getErrorMessage } from '../errors';

export type DeepAnalysisCompetitor = {
  url?: string;
  domain?: string;
  title?: string;
  snippet?: string;
  html?: string;
  text?: string;
};

export type DeepAnalysisTerm = {
  term?: string;
  text?: string;
  doc_freq?: number;
  target_count?: number;
  salience?: number;
};

export type EnqueueFromDeepAnalysisOpts = {
  workspaceId: string | number;
  articleId: number;
  domainId?: number;
  keyword: string;
  language?: string;
  competitors?: DeepAnalysisCompetitor[];
  terms?: DeepAnalysisTerm[];
  paaQuestions?: Array<string | { question: string; answer?: string }>;
  /** AI visibility counts for visibility worker (stage ≥ 2). */
  citedCount?: number;
  promptCount?: number;
};

export function buildPipelinePayloadFromDeepAnalysis(
  opts: EnqueueFromDeepAnalysisOpts,
): Record<string, unknown> {
  const serpUrls = (opts.competitors || [])
    .map((c) => (c.url || '').trim())
    .filter(Boolean);

  const terms = (opts.terms || [])
    .map((t) => {
      const term = (t.term || t.text || '').trim();
      if (!term) return null;
      return {
        term,
        doc_freq: t.doc_freq,
        target_count: t.target_count ?? 1,
        salience: t.salience,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t != null);

  const paaQuestions = (opts.paaQuestions || [])
    .map((q) => (typeof q === 'string' ? { question: q } : q))
    .filter((q) => (q.question || '').trim().length >= 8);

  const documents = (opts.competitors || [])
    .filter((c) => (c.html || c.text || c.snippet || '').trim())
    .map((c) => ({
      url: c.url || '',
      html: c.html || '',
      text: c.text || c.snippet || '',
    }));

  return {
    workspaceId: String(opts.workspaceId),
    articleId: opts.articleId,
    domainId: opts.domainId,
    keyword: opts.keyword,
    language: opts.language || 'pl',
    serpUrls,
    terms,
    paaQuestions,
    documents,
    citedCount: opts.citedCount,
    promptCount: opts.promptCount,
  };
}

/** Enqueue serp_crawl (→ coverage). Returns null on soft failure. */
export async function enqueueFromDeepAnalysis(
  opts: EnqueueFromDeepAnalysisOpts,
): Promise<EnqueueResult | null> {
  const keyword = (opts.keyword || '').trim();
  if (!keyword) return null;

  const payload = buildPipelinePayloadFromDeepAnalysis(opts);
  try {
    return await enqueueJob({
      workspaceId: opts.workspaceId,
      keyword,
      locale: opts.language,
      queue: 'serp_crawl',
      payload,
      force: false,
    });
  } catch (err: unknown) {
    console.warn('[enqueueFromDeepAnalysis] failed:', getErrorMessage(err));
    return null;
  }
}

/** Optional visibility enqueue when stage unlocks the worker. */
export async function enqueueVisibilityFromDeepAnalysis(
  opts: EnqueueFromDeepAnalysisOpts,
): Promise<EnqueueResult | null> {
  const keyword = (opts.keyword || '').trim();
  if (!keyword) return null;
  try {
    const { isWorkerAllowedAtStage } = await import('./pipelineStage');
    if (!isWorkerAllowedAtStage('visibility')) return null;
    return await enqueueJob({
      workspaceId: opts.workspaceId,
      keyword,
      locale: opts.language,
      queue: 'visibility',
      payload: {
        ...buildPipelinePayloadFromDeepAnalysis(opts),
        citedCount: opts.citedCount ?? 0,
        promptCount: opts.promptCount ?? 10,
      },
      force: true,
    });
  } catch (err: unknown) {
    console.warn('[enqueueVisibilityFromDeepAnalysis] failed:', getErrorMessage(err));
    return null;
  }
}

export async function enqueueLiveScoreOnSave(opts: {
  workspaceId: string | number;
  articleId: number;
  keyword: string;
  html: string;
  scoreData: Record<string, unknown>;
  coverageItems?: unknown[];
}): Promise<EnqueueResult | null> {
  if (!opts.html?.trim()) return null;
  try {
    return await enqueueJob({
      workspaceId: opts.workspaceId,
      keyword: opts.keyword || '_',
      queue: 'live_score',
      payload: {
        workspaceId: String(opts.workspaceId),
        articleId: opts.articleId,
        keyword: opts.keyword,
        html: opts.html,
        score_data: opts.scoreData,
        coverageItems: opts.coverageItems,
      },
      force: false,
    });
  } catch (err: unknown) {
    console.warn('[enqueueLiveScoreOnSave] failed:', getErrorMessage(err));
    return null;
  }
}
