import dotenv from 'dotenv';
import { Sequelize, QueryTypes } from 'sequelize';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const id = Number(process.argv[2] || 127);
const db = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true } },
});

const art = await db.query(
  `SELECT id, target_keyword, status, length(content) AS content_len, score_data,
          ai_info_to_cover IS NOT NULL AS has_ai_cover, updated_at
   FROM articles WHERE id = ?`,
  { replacements: [id], type: QueryTypes.SELECT },
);
console.log('ARTICLE', JSON.stringify(art, null, 2));

const termsCnt = await db.query(
  'SELECT count(*)::int AS cnt FROM article_terms WHERE article_id = ?',
  { replacements: [id], type: QueryTypes.SELECT },
);
console.log('ARTICLE_TERMS_COUNT', termsCnt[0]?.cnt);

const sample = await db.query(
  'SELECT term, target_min, target_max, importance FROM article_terms WHERE article_id = ? LIMIT 20',
  { replacements: [id], type: QueryTypes.SELECT },
);
console.log('ARTICLE_TERMS_SAMPLE', JSON.stringify(sample, null, 2));

const comps = await db.query(
  'SELECT count(*)::int AS cnt FROM article_competitors WHERE article_id = ?',
  { replacements: [id], type: QueryTypes.SELECT },
);
console.log('COMPETITORS', comps[0]?.cnt);

if (art[0]?.score_data) {
  const sd = JSON.parse(art[0].score_data);
  console.log('SCORE_DATA_TERMS_COUNT', sd.terms?.length);
  console.log('SCORE_DATA_TERMS', sd.terms?.map((t) => t.term));
  console.log('AI_SCORE', sd.ai_score, 'SEO', sd.seo_score);
}

console.log('LANGUAGE', art[0] ? await db.query('SELECT language, domain_id FROM articles WHERE id = ?', { replacements: [id], type: QueryTypes.SELECT }) : []);

const compsDetail = await db.query(
  'SELECT domain, title, left(snippet, 80) AS snippet FROM article_competitors WHERE article_id = ? LIMIT 5',
  { replacements: [id], type: QueryTypes.SELECT },
);
console.log('COMPETITORS_DETAIL', JSON.stringify(compsDetail, null, 2));

const allCompDomains = await db.query(
  'SELECT domain FROM article_competitors WHERE article_id = ?',
  { replacements: [id], type: QueryTypes.SELECT },
);
console.log('ALL_COMP_DOMAINS', allCompDomains.map((r) => r.domain));

const jobs = await db.query(
  `SELECT id, job_type, status, created_at FROM analysis_jobs
   WHERE article_id = ? ORDER BY created_at DESC LIMIT 5`,
  { replacements: [id], type: QueryTypes.SELECT },
);
console.log('JOBS', JSON.stringify(jobs, null, 2));

const deepJob = await db.query(
  `SELECT result FROM analysis_jobs WHERE id = 'job_${id}_1783603169294' OR (article_id = ? AND job_type = 'deep_analysis') ORDER BY created_at DESC LIMIT 1`,
  { replacements: [id], type: QueryTypes.SELECT },
);
if (deepJob[0]?.result) {
  const parsed = typeof deepJob[0].result === 'string' ? JSON.parse(deepJob[0].result) : deepJob[0].result;
  const terms = parsed?.score_data?.terms || parsed?.terms || [];
  console.log('DEEP_JOB_TERMS_COUNT', terms.length);
  console.log('DEEP_JOB_TERMS_SAMPLE', terms.slice(0, 15).map((t) => t.term));
}

await db.close();
