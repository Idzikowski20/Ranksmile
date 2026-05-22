import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { slug } = req.query;
  const checkKeyword = req.query.keyword as string | undefined;

  // Get domain ID from slug (or domain name)
  let [domains] = await db.query(`SELECT "ID" FROM domain WHERE slug = ?`, { replacements: [slug] });
  if (!(domains as any[])[0]) {
    [domains] = await db.query(`SELECT "ID" FROM domain WHERE domain = ?`, { replacements: [slug] });
  }
  const domain = (domains as any[])[0];
  if (!domain) return res.status(404).json({ error: 'Domain not found' });

  let sql = `
    SELECT ak.keyword, ak.article_id, a.title, COUNT(*) OVER (PARTITION BY ak.keyword) as article_count
    FROM article_keywords ak
    JOIN articles a ON a.id = ak.article_id
    WHERE a.domain_id = ?
  `;
  const replacements: any[] = [domain.ID];

  if (checkKeyword) {
    sql += ` AND ak.keyword = ?`;
    replacements.push(checkKeyword);
  }

  sql += ` ORDER BY article_count DESC, ak.keyword`;

  const [rows] = await db.query(sql, { replacements });

  // Group by keyword — show articles competing for each
  const cannibalized: Record<string, { keyword: string; articles: { id: number; title: string }[] }> = {};
  for (const r of rows as any[]) {
    if (r.article_count < 2) continue;
    if (!cannibalized[r.keyword]) {
      cannibalized[r.keyword] = { keyword: r.keyword, articles: [] };
    }
    if (cannibalized[r.keyword].articles.length < r.article_count) {
      cannibalized[r.keyword].articles.push({ id: r.article_id, title: r.title });
    }
  }

  return res.status(200).json({ cannibalized: Object.values(cannibalized) });
}
