// GET  /api/articles?domainId=X  — lista artykułów
// POST /api/articles              — utwórz artykuł (bez AI)
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   if (req.method === 'GET') return getArticles(req, res);
   if (req.method === 'POST') return createArticle(req, res);
   if (req.method === 'DELETE') return deleteArticle(req, res);
   return res.status(405).json({ error: 'Method not allowed' });
}

async function getArticles(req: NextApiRequest, res: NextApiResponse) {
   const { domainId } = req.query;
   const sequelize = db;

   try {
      const where = domainId ? `WHERE domain_id = ${parseInt(domainId as string, 10)}` : '';
      const [articles] = await sequelize.query(
         `SELECT id, domain_id, title, slug, status, target_keyword, meta_title, word_count,
                 published_at, publish_target, publish_url, created_at, updated_at, content_score
          FROM articles ${where}
          ORDER BY created_at DESC`,
      );
      return res.status(200).json({ articles });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}

async function createArticle(req: NextApiRequest, res: NextApiResponse) {
   const { domain_id, title, target_keyword } = req.body;
   if (!domain_id || !title) {
      return res.status(400).json({ error: 'domain_id and title are required' });
   }

   try {
      const [articleId] = await db.query(
         `INSERT INTO articles (domain_id, title, target_keyword, status, created_at, updated_at)
          VALUES (?, ?, ?, 'draft', datetime('now'), datetime('now'))`,
         { replacements: [domain_id, title, target_keyword || ''], type: QueryTypes.INSERT },
      );
      return res.status(200).json({ articleId, title });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}

async function deleteArticle(req: NextApiRequest, res: NextApiResponse) {
   const { id } = req.query;
   if (!id) return res.status(400).json({ error: 'id is required' });

   try {
      await db.query(`DELETE FROM articles WHERE id = ?`, { replacements: [id] });
      return res.status(200).json({ deleted: true });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}
