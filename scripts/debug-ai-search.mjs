import dotenv from 'dotenv';
import { Sequelize, QueryTypes } from 'sequelize';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const articleId = Number(process.argv[2] || 78);
const db = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true } },
});

const art = await db.query(
  `SELECT id, status, target_keyword,
          ai_info_to_cover IS NOT NULL AS has_cover,
          LENGTH(COALESCE(ai_info_to_cover::text, '')) AS cover_len
   FROM articles WHERE id = :id`,
  { replacements: { id: articleId }, type: QueryTypes.SELECT },
);
console.log('=== ARTICLE ===');
console.log(JSON.stringify(art, null, 2));

const job = await db.query(
  `SELECT id, status, current_stage, result IS NOT NULL AS has_result
   FROM analysis_jobs
   WHERE article_id = :id AND job_type = 'deep_analysis'
   ORDER BY created_at DESC LIMIT 1`,
  { replacements: { id: articleId }, type: QueryTypes.SELECT },
);
console.log('=== JOB ===');
console.log(JSON.stringify(job, null, 2));

if (job[0]?.id) {
  const rows = await db.query(
    `SELECT result FROM analysis_jobs WHERE id = :jid`,
    { replacements: { jid: job[0].id }, type: QueryTypes.SELECT },
  );
  const raw = rows[0]?.result;
  const r = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (r) {
    console.log('=== PIPELINE RESULT KEYS ===');
    console.log(Object.keys(r));
    console.log('=== ai_search ===');
    console.log(JSON.stringify(r.ai_search, null, 2)?.slice(0, 3000));
    console.log('=== scrape_serp paa_questions ===');
    console.log(JSON.stringify(r.scrape_serp?.paa_questions || [], null, 2));
  }
}

const cover = await db.query(
  `SELECT ai_info_to_cover FROM articles WHERE id = :id`,
  { replacements: { id: articleId }, type: QueryTypes.SELECT },
);
if (cover[0]?.ai_info_to_cover) {
  const snap = typeof cover[0].ai_info_to_cover === 'string'
    ? JSON.parse(cover[0].ai_info_to_cover)
    : cover[0].ai_info_to_cover;
  console.log('=== ai_info_to_cover ===');
  console.log('overall:', snap.overall);
  console.log('items:', snap.items?.length);
  console.log('buckets:', snap.buckets?.map((b) => `${b.id}:${b.score}`));
  const types = {};
  for (const it of snap.items || []) types[it.type] = (types[it.type] || 0) + 1;
  console.log('item types:', types);
}

const runs = await db.query(
  `SELECT id, keyword, prompts_total, prompts_cited, created_at
   FROM ai_visibility_runs WHERE article_id = :id ORDER BY created_at DESC LIMIT 3`,
  { replacements: { id: articleId }, type: QueryTypes.SELECT },
).catch(() => []);
console.log('=== ai_visibility_runs ===');
console.log(JSON.stringify(runs, null, 2));

await db.close();
