import dotenv from 'dotenv';
import { Sequelize, QueryTypes } from 'sequelize';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const slug = process.argv[2] || 'idztech-pl';
const domainGuess = slug.replace(/-/g, '.');

const db = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true } },
});

const dom = await db.query(
  `SELECT "ID" AS id, domain FROM domain WHERE domain ILIKE :q OR domain ILIKE :q2 LIMIT 3`,
  { replacements: { q: `%${domainGuess}%`, q2: `%${slug}%` }, type: QueryTypes.SELECT },
);
console.log('domains:', dom);
if (!dom[0]) { await db.close(); process.exit(0); }

const cfg = await db.query(
  'SELECT id, brand_name, completed_at FROM ai_vis_configs WHERE domain_id = :id ORDER BY id DESC LIMIT 1',
  { replacements: { id: dom[0].id }, type: QueryTypes.SELECT },
);
console.log('config:', cfg);

const scans = await db.query(
  `SELECT id, status, progress_done, progress_total, finished_at
   FROM ai_vis_scans WHERE config_id = :cid ORDER BY id DESC LIMIT 5`,
  { replacements: { cid: cfg[0]?.id }, type: QueryTypes.SELECT },
);
console.log('scans:', scans);

for (const scan of scans.filter((s) => s.status === 'completed').slice(0, 5)) {
  const [stats] = await db.query(
    `SELECT COUNT(1)::int AS total,
            SUM(CASE WHEN error IS NULL THEN 1 ELSE 0 END)::int AS ok,
            SUM(CASE WHEN own_cited = 1 THEN 1 ELSE 0 END)::int AS own_cited,
            SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END)::int AS errors
     FROM ai_vis_results WHERE scan_id = :sid`,
    { replacements: { sid: scan.id }, type: QueryTypes.SELECT },
  );
  const [cites] = await db.query(
    `SELECT COALESCE(SUM(jsonb_array_length(COALESCE(citations, '[]'::jsonb))), 0)::int AS cites
     FROM ai_vis_results WHERE scan_id = :sid AND error IS NULL`,
    { replacements: { sid: scan.id }, type: QueryTypes.SELECT },
  );
  console.log(`scan ${scan.id}:`, { ...stats, cites: cites.cites });
}

await db.close();
