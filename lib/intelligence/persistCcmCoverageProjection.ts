/**
 * Persist CCM → CoverageSnapshot into articles.ai_info_to_cover (Etap 27).
 * Non-fatal when DB unavailable (unit tests with injected CompileStore).
 */
import type { CoverageSnapshot } from '../aiCoverage';
import type { CanonicalContentModel } from '../ccm/types/ccm';
import { parseSnapshot } from '../coverageStore';
import { projectCcmToCoverageSnapshot } from './ccmToCoverageSnapshot';

export async function persistCcmCoverageProjection(opts: {
  readonly articleId: number;
  readonly model: CanonicalContentModel;
  readonly createdAt: string;
}): Promise<CoverageSnapshot | null> {
  const { queryOne, queryRows } = await import('../db/query');
  const { getArticleIdSql } = await import('../articleSql');
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
  return snap;
}
