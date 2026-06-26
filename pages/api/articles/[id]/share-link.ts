// GET  /api/articles/[id]/share-link  — ensure + return the opaque share token
// POST /api/articles/[id]/share-link  — reset (regenerate) the token
import type { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes } from 'crypto';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../../lib/articleSql';
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertArticleAccess } from '../../../../lib/tenancy';

const makeToken = () => randomBytes(24).toString('base64url');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

   const { id } = req.query;
   if (!id) return res.status(400).json({ error: 'id is required' });

   const userId = await getCurrentUserId(req, res);
   const articleId = parseInt((req.query.id ?? req.query.articleId) as string, 10);
   if (!(await assertArticleAccess(userId, articleId))) {
      return res.status(403).json({ error: 'Access denied.' });
   }

   try {
      const articleIdSql = await getArticleIdSql();

      if (req.method === 'POST') {
         const token = makeToken();
         await db.query(`UPDATE articles SET share_token = ? WHERE ${articleIdSql} = ?`, { replacements: [token, id] });
         return res.status(200).json({ token });
      }

      if (req.method === 'GET') {
         const [rows] = await db.query(`SELECT share_token FROM articles WHERE ${articleIdSql} = ? LIMIT 1`, { replacements: [id] });
         const existing = (rows as any[])[0]?.share_token;
         if (existing) return res.status(200).json({ token: existing });
         const token = makeToken();
         await db.query(`UPDATE articles SET share_token = ? WHERE ${articleIdSql} = ?`, { replacements: [token, id] });
         return res.status(200).json({ token });
      }

      return res.status(405).json({ error: 'Method not allowed' });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}
