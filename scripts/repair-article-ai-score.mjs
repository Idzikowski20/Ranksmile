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

console.log(`Regrading AI coverage for article ${id}...`);
const result = await repairWeakArticleScoreData({ articleId: id, html });
if (!result) {
  console.log('No repair needed.');
} else {
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
  console.log('AI score:', result.scoreData.ai_score);
  console.log('SEO score:', result.scoreData.seo_score);
  console.log('Content score:', result.contentScore);
}

await db.close();
