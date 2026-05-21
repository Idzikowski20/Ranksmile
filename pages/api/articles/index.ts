// GET  /api/articles?domainId=X  — lista artykułów
// POST /api/articles              — utwórz artykuł (bez AI)
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import Domain from '../../../database/models/domain';
import { Op } from 'sequelize';
import { getArticleIdSql } from '../../../lib/articleSql';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }
   const userId = await getCurrentUserId(req, res);

   if (req.method === 'GET') return getArticles(req, res, userId);
   if (req.method === 'POST') return createArticle(req, res, userId);
   if (req.method === 'DELETE') return deleteArticle(req, res, userId);
   return res.status(405).json({ error: 'Method not allowed' });
}

/** Pobiera ID domen należących do danego usera (lub legacy null). */
async function getUserDomainIds(userId: string | null): Promise<number[]> {
   const whereClause = userId
      ? { [Op.or]: [{ userId }, { userId: null }] }
      : {};
   const domains = await Domain.findAll({ where: whereClause, attributes: ['ID'] });
   return domains.map((d) => d.ID);
}

async function getArticles(req: NextApiRequest, res: NextApiResponse, userId: string | null) {
   const { domainId } = req.query;

   try {
      const articleIdSql = await getArticleIdSql();
      let where = '';
      const replacements: any[] = [];

      const totalDomains = await Domain.count();
      const allowedIds = await getUserDomainIds(userId);

      if (domainId) {
         const domainIdInt = parseInt(domainId as string, 10);
         // If domains exist, enforce ownership check; if table is empty allow all (fresh install)
         if (totalDomains > 0 && !allowedIds.includes(domainIdInt)) {
            return res.status(403).json({ error: 'Access denied.' });
         }
         where = 'WHERE domain_id = ?';
         replacements.push(domainIdInt);
      } else if (totalDomains === 0) {
         // No domains in DB yet (fresh install / migration from SQLite) — return all articles
         where = '';
      } else if (allowedIds.length === 0) {
         return res.status(200).json({ articles: [] });
      } else {
         where = `WHERE domain_id IN (${allowedIds.map(() => '?').join(',')})`;
         replacements.push(...allowedIds);
      }

      const [articles] = await db.query(
         `SELECT ${articleIdSql} AS id, domain_id, title, slug, status, target_keyword, meta_title, word_count,
                 published_at, publish_target, publish_url, created_at, updated_at, content_score
          FROM articles ${where}
          ORDER BY created_at DESC`,
         { replacements },
      );
      return res.status(200).json({ articles });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}

async function createArticle(req: NextApiRequest, res: NextApiResponse, userId: string | null) {
   const { domain_id, title, target_keyword } = req.body;
   if (!domain_id || !title) {
      return res.status(400).json({ error: 'domain_id and title are required' });
   }

   // Sprawdź własność domeny
   const allowedIds = await getUserDomainIds(userId);
   if (!allowedIds.includes(parseInt(domain_id, 10))) {
      return res.status(403).json({ error: 'Access denied.' });
   }

   try {
      const articleIdSql = await getArticleIdSql();
      let articleId: number | undefined;
      if (process.env.DATABASE_URL) {
         const rows = await db.query<{ id: number }>(
            `INSERT INTO articles (domain_id, title, target_keyword, status, created_at, updated_at)
             VALUES (?, ?, ?, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING ${articleIdSql} AS id`,
            { replacements: [domain_id, title, target_keyword || ''], type: QueryTypes.SELECT },
         );
         articleId = rows[0]?.id;
      } else {
         const [newArticleId] = await db.query(
            `INSERT INTO articles (domain_id, title, target_keyword, status, created_at, updated_at)
             VALUES (?, ?, ?, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            { replacements: [domain_id, title, target_keyword || ''], type: QueryTypes.INSERT },
         );
         articleId = newArticleId as unknown as number;
      }
      return res.status(200).json({ articleId, title });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}

async function deleteArticle(req: NextApiRequest, res: NextApiResponse, userId: string | null) {
   const { id } = req.query;
   if (!id) return res.status(400).json({ error: 'id is required' });

   // Sprawdź własność artykułu przez domenę
   try {
      const articleIdSql = await getArticleIdSql();
      const [rows] = await db.query(
         `SELECT domain_id FROM articles WHERE ${articleIdSql} = ?`,
         { replacements: [id] },
      );
      const article = (rows as any[])[0];
      if (!article) return res.status(404).json({ error: 'Article not found' });

      const allowedIds = await getUserDomainIds(userId);
      if (!allowedIds.includes(article.domain_id)) {
         return res.status(403).json({ error: 'Access denied.' });
      }

      await db.query(`DELETE FROM articles WHERE ${articleIdSql} = ?`, { replacements: [id] });
      return res.status(200).json({ deleted: true });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'DB error' });
   }
}
