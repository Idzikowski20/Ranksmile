/**
 * Persist CCM → CoverageSnapshot into articles.ai_info_to_cover (Etap 27).
 * Non-fatal when DB unavailable (unit tests with injected CompileStore).
 */
import type { CoverageSnapshot } from '@/src/core/domain/coverage/aiCoverage';
import type { CanonicalContentModel } from '@/src/core/ccm/types/ccm';
import { parseSnapshot } from '@/src/infrastructure/coverage/coverageStore';
import { projectCcmToCoverageSnapshot } from '@/src/core/intelligence/ccmToCoverageSnapshot';

export async function persistCcmCoverageProjection(opts: {
  readonly articleId: number;
  readonly model: CanonicalContentModel;
  readonly createdAt: string;
}): Promise<CoverageSnapshot | null> {
  const { queryOne, queryRows } = await import('@/src/infrastructure/db/query');
  const { getArticleIdSql } = await import('@/src/infrastructure/articles/articleSql');
  const articleIdSql = await getArticleIdSql();

  const row = await queryOne<{ ai_info_to_cover: unknown }>(
    `SELECT ai_info_to_cover FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
    [opts.articleId],
  );
  const previous = parseSnapshot(row?.ai_info_to_cover);
  const snap = projectCcmToCoverageSnapshot(opts.model, {
    createdAt: opts.createdAt,
    previous,
  });
  if (!snap.items.length) return null;

  await queryRows(
    `UPDATE articles SET ai_info_to_cover = ? WHERE ${articleIdSql} = ?`,
    [JSON.stringify(snap), opts.articleId],
  );

  // The gauge has to follow the checklist it is derived from. reconcilePostGenerateArticle
  // writes ai_score from live coverage and then kicks this projection off with `void`, so
  // the richer snapshot landed in ai_info_to_cover while score_data.ai_score kept the
  // earlier number — article 84 stored 45 against a snapshot that scored 65.
  await syncAiScoreToSnapshot(opts.articleId, snap.overall, articleIdSql);
  return snap;
}

async function syncAiScoreToSnapshot(
  articleId: number,
  overall: number,
  articleIdSql: string,
): Promise<void> {
  if (!(overall > 0)) return;
  const { queryOne, queryRows } = await import('@/src/infrastructure/db/query');
  const { computeOverallContentScore } = await import('@/src/core/domain/aiScore/aiSearchScore');
  try {
    const row = await queryOne<{ score_data: string | null }>(
      `SELECT score_data FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      [articleId],
    );
    if (!row?.score_data) return;
    const scoreData = JSON.parse(row.score_data) as Record<string, unknown>;
    const seo = typeof scoreData.seo_score === 'number' ? scoreData.seo_score : 0;
    const contentScore = computeOverallContentScore(seo, overall);
    scoreData.ai_score = overall;
    scoreData._computed_score = contentScore;
    scoreData._content_score = contentScore;
    await queryRows(
      `UPDATE articles SET score_data = ?, content_score = ? WHERE ${articleIdSql} = ?`,
      [JSON.stringify(scoreData), contentScore, articleId],
    );
  } catch (err: unknown) {
    // Never fail the projection over the score mirror — the snapshot is already saved.
    console.warn('[ccm] ai_score sync skipped:', err instanceof Error ? err.message : String(err));
  }
}
