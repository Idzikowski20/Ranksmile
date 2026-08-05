/**
 * Smoke Etap 27: compileIfStale → ai_info_to_cover.judgeVersion includes ccm-projection.
 * Usage: npx tsx --env-file=.env.local scripts/smoke-ccm-coverage.ts [articleId]
 */
import { compileIfStale } from '../lib/intelligence/compileAfterArticleChange';
import { queryOne } from '../lib/db/query';
import { getArticleIdSql } from '../lib/articleSql';
import { parseSnapshot } from '../lib/coverageStore';

const articleId = Number(process.argv[2] || 167);

async function main(): Promise<void> {
  const articleIdSql = await getArticleIdSql();
  const before = await queryOne<{ ai_info_to_cover: unknown }>(
    `SELECT ai_info_to_cover FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
    [articleId],
  );
  const beforeSnap = parseSnapshot(before?.ai_info_to_cover);
  console.log('before judgeVersion:', beforeSnap?.judgeVersion ?? '(none)');
  console.log('before items:', beforeSnap?.items?.length ?? 0);

  const r = await compileIfStale({
    articleId,
    compiledAt: new Date().toISOString(),
  });
  console.log('compileIfStale:', r);

  const after = await queryOne<{ ai_info_to_cover: unknown }>(
    `SELECT ai_info_to_cover FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
    [articleId],
  );
  const afterSnap = parseSnapshot(after?.ai_info_to_cover);
  console.log('after judgeVersion:', afterSnap?.judgeVersion ?? '(none)');
  console.log('after items:', afterSnap?.items?.length ?? 0);
  console.log('after overall:', afterSnap?.overall ?? null);

  const ok =
    typeof afterSnap?.judgeVersion === 'string' &&
    afterSnap.judgeVersion.includes('ccm-projection') &&
    (afterSnap.items?.length ?? 0) > 0;
  if (!ok) {
    console.error('SMOKE FAIL');
    process.exit(2);
  }
  console.log('SMOKE OK');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
