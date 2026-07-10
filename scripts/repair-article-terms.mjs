#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import { Sequelize, QueryTypes } from 'sequelize';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const id = Number(process.argv[2] || 127);

const { repairWeakArticleScoreData } = await import('../lib/reconcilePostGenerateArticle.ts');

const db = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true } },
});

const rows = await db.query(
  'SELECT content FROM articles WHERE id = ?',
  { replacements: [id], type: QueryTypes.SELECT },
);
const html = rows[0]?.content || '';
if (!html) {
  console.error('No content for article', id);
  process.exit(1);
}

console.log(`Repairing article ${id}...`);
const result = await repairWeakArticleScoreData({ articleId: id, html });
if (!result) {
  console.log('No repair needed (terms already rich).');
} else {
  const articleIdSql = 'id';
  await db.query(
    `UPDATE articles SET score_data = ?, ai_info_to_cover = COALESCE(?, ai_info_to_cover), content_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    {
      replacements: [
        JSON.stringify(result.scoreData),
        result.aiInfoToCover,
        result.contentScore,
        id,
      ],
    },
  );
  console.log('Repaired terms:', result.scoreData.terms?.length);
  console.log('Sample:', result.scoreData.terms?.slice(0, 12).map((t) => t.term));
  console.log('AI score:', result.scoreData.ai_score, 'SEO:', result.scoreData.seo_score);
}

const cnt = await db.query(
  'SELECT count(*)::int AS cnt FROM article_terms WHERE article_id = ?',
  { replacements: [id], type: QueryTypes.SELECT },
);
console.log('article_terms count:', cnt[0]?.cnt);

await db.close();
