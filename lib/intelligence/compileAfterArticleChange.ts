/**
 * Fire-and-forget CCM compile after Deep Analysis / generate / AO / publish (07-runtime).
 * Never throws to callers — return error shape.
 * DB / SqlCompileStore are lazy-required so unit tests with injected store stay Jest-safe.
 */
import { hashCompileSource } from '../compiler/contentHash';
import { compileArticle, resolveCompileSource } from './runtimeApi';
import type { CompileStore } from './compileStore';
import { recordCcmCompileMetric, type CcmCompileOutcome } from './ccmCompileMetrics';
import type { CoverageSnapshot } from '../aiCoverage';

export type CompileAfterResult =
  | {
      readonly ok: true;
      readonly version: number;
      readonly contentHash: string;
      readonly noop: boolean;
      /** True when store already matched contentHash — no recompile. */
      readonly skipped?: boolean;
      /** SoT coverage after projection (when projectCoverage ran). */
      readonly coverageSnapshot?: CoverageSnapshot;
    }
  | { readonly ok: false; readonly error: string };

export type CompileAfterOpts = {
  readonly articleId: number;
  /** ISO — caller supplies when known. */
  readonly compiledAt: string;
  readonly contentHtml?: string | null;
  readonly mode?: 'full' | 'incremental';
  /** Inject for tests; default SqlCompileStore. */
  readonly store?: CompileStore;
  /**
   * Project CCM → ai_info_to_cover after compile (Etap 27).
   * Default: true. Tests with InMemoryCompileStore pass false.
   */
  readonly projectCoverage?: boolean;
  /**
   * Merge AI-visibility / DA citation seeds into CCM (Etap 28).
   * Default: true.
   */
  readonly enrichDaFacts?: boolean;
  /** Fact Engine v3 LLM gap quotes (default true when enrich on). */
  readonly llmGaps?: boolean;
};

async function resolveStore(explicit?: CompileStore): Promise<CompileStore> {
  if (explicit) return explicit;
  const { ensureCcmTables } = await import('../ensureCcmTables');
  const { SqlCompileStore } = await import('./sqlCompileStore');
  await ensureCcmTables();
  return new SqlCompileStore();
}

async function resolveHtml(
  articleId: number,
  contentHtml: string | null | undefined,
): Promise<string> {
  if (contentHtml != null && contentHtml !== '') return contentHtml;
  const { queryOne } = await import('../db/query');
  const { getArticleIdSql } = await import('../articleSql');
  const articleIdSql = await getArticleIdSql();
  const row = await queryOne<{ content: string | null }>(
    `SELECT content FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
    [articleId],
  );
  return row?.content ?? '';
}

async function projectCoverageSafe(
  articleId: number,
  model: import('../ccm/types/ccm').CanonicalContentModel,
  createdAt: string,
): Promise<CoverageSnapshot | undefined> {
  const { persistCcmCoverageProjection } = await import('./persistCcmCoverageProjection');
  const snap = await persistCcmCoverageProjection({
    articleId,
    model,
    createdAt,
  });
  return snap ?? undefined;
}

/** True when no CCM or contentHash ≠ current HTML (after html→plain normalize). */
export async function isCcmStale(opts: {
  readonly articleId: number | string;
  readonly contentHtml: string;
  readonly store?: CompileStore;
}): Promise<boolean> {
  const store = await resolveStore(opts.store);
  const source = resolveCompileSource({ kind: 'html', html: opts.contentHtml });
  const hash = hashCompileSource(source);
  const model = await store.get(String(opts.articleId));
  return !model || model.contentHash !== hash;
}

/**
 * Compile article HTML → CCM + persist. Non-fatal product hook.
 */
export async function compileAfterArticleChange(
  opts: CompileAfterOpts,
): Promise<CompileAfterResult> {
  const t0 = Date.now();
  const record = (outcome: CcmCompileOutcome, error?: string) => {
    recordCcmCompileMetric({
      articleId: opts.articleId,
      outcome,
      ms: Date.now() - t0,
      ...(error ? { error } : {}),
    });
  };

  try {
    const html = await resolveHtml(opts.articleId, opts.contentHtml);
    if (!html.trim()) {
      record('empty', 'empty_content');
      return { ok: false, error: 'empty_content' };
    }

    const store = await resolveStore(opts.store);
    const result = await compileArticle({
      articleId: String(opts.articleId),
      compiledAt: opts.compiledAt,
      source: { kind: 'html', html },
      mode: opts.mode ?? 'full',
      store,
      persist: true,
    });

    let model = result.model;
    if (opts.enrichDaFacts !== false) {
      try {
        const { applyDaFactEnrichment } = await import('./applyDaFactEnrichment');
        model = await applyDaFactEnrichment({
          articleId: opts.articleId,
          model,
          contentHtml: html,
          store,
          persist: true,
          llmGaps: opts.llmGaps,
        });
      } catch {
        // non-fatal
      }
    }

    let coverageSnapshot: CoverageSnapshot | undefined;
    if (opts.projectCoverage !== false) {
      try {
        coverageSnapshot = await projectCoverageSafe(
          opts.articleId,
          model,
          opts.compiledAt,
        );
      } catch {
        // non-fatal — CCM already persisted
      }
    }

    const outcome: CcmCompileOutcome = result.noop ? 'noop' : 'ok';
    record(outcome);
    return {
      ok: true,
      version: model.version,
      contentHash: model.contentHash,
      noop: result.noop,
      ...(coverageSnapshot ? { coverageSnapshot } : {}),
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'compile_failed';
    record('error', error);
    return { ok: false, error };
  }
}

/**
 * Publish / AO gate helper: recompile only when contentHash drifted.
 */
export async function compileIfStale(
  opts: CompileAfterOpts,
): Promise<CompileAfterResult> {
  const t0 = Date.now();
  try {
    const html = await resolveHtml(opts.articleId, opts.contentHtml);
    if (!html.trim()) {
      recordCcmCompileMetric({
        articleId: opts.articleId,
        outcome: 'empty',
        ms: Date.now() - t0,
        error: 'empty_content',
      });
      return { ok: false, error: 'empty_content' };
    }
    const store = await resolveStore(opts.store);
    const stale = await isCcmStale({
      articleId: opts.articleId,
      contentHtml: html,
      store,
    });
    if (!stale) {
      let model = await store.get(String(opts.articleId));
      if (model && opts.enrichDaFacts !== false) {
        try {
          const { applyDaFactEnrichment } = await import('./applyDaFactEnrichment');
          model = await applyDaFactEnrichment({
            articleId: opts.articleId,
            model,
            contentHtml: html,
            store,
            persist: true,
            llmGaps: opts.llmGaps,
          });
        } catch {
          // non-fatal
        }
      }
      let coverageSnapshot: CoverageSnapshot | undefined;
      if (model && opts.projectCoverage !== false) {
        try {
          coverageSnapshot = await projectCoverageSafe(
            opts.articleId,
            model,
            opts.compiledAt,
          );
        } catch {
          // non-fatal
        }
      }
      recordCcmCompileMetric({
        articleId: opts.articleId,
        outcome: 'skipped',
        ms: Date.now() - t0,
      });
      return {
        ok: true,
        version: model?.version ?? 0,
        contentHash: model?.contentHash ?? '',
        noop: true,
        skipped: true,
        ...(coverageSnapshot ? { coverageSnapshot } : {}),
      };
    }
    return compileAfterArticleChange({ ...opts, contentHtml: html, store });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'compile_failed';
    recordCcmCompileMetric({
      articleId: opts.articleId,
      outcome: 'error',
      ms: Date.now() - t0,
      error,
    });
    return { ok: false, error };
  }
}
