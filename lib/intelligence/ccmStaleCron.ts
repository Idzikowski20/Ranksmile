/**
 * Cron batch: recompile CCM for articles missing snapshot or with drifted contentHash.
 * Backend-only (07-runtime Cron trigger).
 * DB imports are lazy so unit tests with injected candidates stay Jest-safe.
 */
import {
  compileIfStale,
  type CompileAfterResult,
} from './compileAfterArticleChange';
import type { CompileStore } from './compileStore';

export type CcmCronCandidate = {
  readonly articleId: number;
  readonly contentHtml: string;
};

export type CcmCronArticleResult = {
  readonly articleId: number;
} & CompileAfterResult;

export type RunCcmCompileCronOpts = {
  readonly limit?: number;
  /** ISO compiledAt for all compiles in this run. */
  readonly compiledAt: string;
  readonly store?: CompileStore;
  /** Inject candidates (unit tests). */
  readonly candidates?: readonly CcmCronCandidate[];
};

export type RunCcmCompileCronResult = {
  readonly scanned: number;
  readonly refreshed: number;
  readonly skipped: number;
  readonly failed: number;
  readonly results: readonly CcmCronArticleResult[];
};

type ArticleContentRow = {
  id: number;
  content: string | null;
};

/**
 * Recently updated articles with non-trivial HTML (hash checked in compileIfStale).
 */
export async function listCcmCompileCandidates(limit: number): Promise<CcmCronCandidate[]> {
  const { ensureCcmTables } = await import('../ensureCcmTables');
  const { getArticleIdSql } = await import('../articleSql');
  const { queryRows } = await import('../db/query');
  await ensureCcmTables();
  const articleIdSql = await getArticleIdSql();
  const rows = await queryRows<ArticleContentRow>(
    `SELECT ${articleIdSql} AS id, content
     FROM articles
     WHERE content IS NOT NULL
       AND LENGTH(TRIM(content)) > 80
     ORDER BY updated_at DESC
     LIMIT ?`,
    [limit],
  );
  return rows
    .filter((r) => r.id != null && typeof r.content === 'string' && r.content.trim().length > 80)
    .map((r) => ({
      articleId: Number(r.id),
      contentHtml: r.content as string,
    }));
}

export async function runCcmCompileCron(
  opts: RunCcmCompileCronOpts,
): Promise<RunCcmCompileCronResult> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const candidates =
    opts.candidates ?? (await listCcmCompileCandidates(limit));

  const results: CcmCronArticleResult[] = [];
  let refreshed = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of candidates) {
    const r = await compileIfStale({
      articleId: c.articleId,
      compiledAt: opts.compiledAt,
      contentHtml: c.contentHtml,
      store: opts.store,
      mode: 'full',
    });
    results.push({ articleId: c.articleId, ...r });
    if (!r.ok) failed += 1;
    else if (r.skipped) skipped += 1;
    else refreshed += 1;
  }

  return {
    scanned: candidates.length,
    refreshed,
    skipped,
    failed,
    results,
  };
}
