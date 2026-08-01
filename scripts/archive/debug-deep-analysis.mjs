import dotenv from 'dotenv';
import { Sequelize, QueryTypes } from 'sequelize';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const db = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true } },
});

const articles = await db.query(
  `SELECT id, status, meta_url, target_keyword, updated_at
   FROM articles WHERE status = 'analyzing'
   ORDER BY updated_at DESC LIMIT 5`,
  { type: QueryTypes.SELECT },
);
console.log('=== ARTICLES (analyzing) ===');
console.log(JSON.stringify(articles, null, 2));

const recentJobs = await db.query(
  `SELECT id, article_id, status, current_stage, progress_message, error, updated_at, created_at
   FROM analysis_jobs
   WHERE job_type = 'deep_analysis'
   ORDER BY created_at DESC LIMIT 10`,
  { type: QueryTypes.SELECT },
);
console.log('=== RECENT JOBS ===');
console.log(JSON.stringify(recentJobs, null, 2));

for (const a of articles) {
  const jobs = await db.query(
    `SELECT id, status, current_stage, progress_message, error, locked_by, attempts,
            created_at, updated_at
     FROM analysis_jobs
     WHERE article_id = :aid AND job_type = 'deep_analysis'
     ORDER BY created_at DESC LIMIT 3`,
    { replacements: { aid: a.id }, type: QueryTypes.SELECT },
  );
  console.log(`--- jobs for article ${a.id} ---`);
  console.log(JSON.stringify(jobs, null, 2));
}

await db.close();
