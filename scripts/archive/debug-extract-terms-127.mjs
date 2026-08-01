import dotenv from 'dotenv';
import { Sequelize, QueryTypes } from 'sequelize';
import axios from 'axios';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const id = 127;
const db = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true } },
});

const rows = await db.query(
  'SELECT url FROM article_competitors WHERE article_id = ?',
  { replacements: [id], type: QueryTypes.SELECT },
);
const keyword = 'detektyw warszawa';
const urls = rows.map((r) => r.url).filter(Boolean);
console.log('URLs:', urls.length, urls);

const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
const res = await axios.post(
  `${sidecarUrl}/extract-terms-from-urls`,
  { keyword, urls },
  { timeout: 180000, headers: { 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' } },
);
console.log('terms count:', res.data?.terms?.length);
console.log('sample:', res.data?.terms?.slice(0, 25).map((t) => t.term));

await db.close();
