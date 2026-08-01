import dotenv from 'dotenv';
import { Sequelize, QueryTypes } from 'sequelize';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const id = 127;
const db = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true } },
});

const rows = await db.query(
  'SELECT content, ai_info_to_cover, score_data FROM articles WHERE id = ?',
  { replacements: [id], type: QueryTypes.SELECT },
);
const row = rows[0];
const html = row?.content || '';
const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const { parseSnapshot } = await import('../lib/coverageStore.ts');
const { liveCoverageItems } = await import('../lib/liveCoverage.ts');
const { computeCoverageScores } = await import('../lib/aiCoverage.ts');

const snap = parseSnapshot(row?.ai_info_to_cover);
console.log('parseSnapshot:', snap ? 'OK' : 'NULL');
console.log('items count:', snap?.items?.length ?? 0);
console.log('stored overall:', snap?.overall);
console.log('answersMainQuestionEarly:', snap?.answersMainQuestionEarly);

if (snap?.items?.length) {
  const live = liveCoverageItems(snap.items, plainText, html);
  const covered = live.filter((i) => i.covered).length;
  console.log('live covered:', covered, '/', live.length);
  const { overall, buckets } = computeCoverageScores(live, !!snap.answersMainQuestionEarly);
  console.log('recomputed overall:', overall);
  console.log('buckets:', buckets.map((b) => `${b.label}:${b.score} (${b.covered}/${b.items})`).join(', '));
  console.log('uncovered sample:', live.filter((i) => !i.covered).slice(0, 8).map((i) => `${i.type}:${i.label}`));
}

const sd = row?.score_data ? JSON.parse(row.score_data) : null;
console.log('score_data.ai_score:', sd?.ai_score);

await db.close();
