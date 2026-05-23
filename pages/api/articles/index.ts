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
   const { domainId, domain: domainSlug } = req.query;

   try {
      const articleIdSql = await getArticleIdSql();
      let where = '';
      const replacements: any[] = [];

      const allowedIds = await getUserDomainIds(userId);

      // Resolve domain ID — support both domainId (int) and domain (slug)
      let resolvedDomainId: number | undefined;
      if (domainId) {
         resolvedDomainId = parseInt(domainId as string, 10);
      } else if (domainSlug) {
         const slugToDomain = (domainSlug as string).replaceAll('-', '.').replaceAll('_', '-');
         const d = await Domain.findOne({ where: { domain: slugToDomain }, attributes: ['ID'] });
         resolvedDomainId = d?.ID;
      }

      if (resolvedDomainId) {
         if (allowedIds.length > 0 && !allowedIds.includes(resolvedDomainId)) {
            return res.status(403).json({ error: 'Access denied.' });
         }
         where = 'WHERE domain_id = ?';
         replacements.push(resolvedDomainId);
      } else if (allowedIds.length === 0) {
         return res.status(200).json({ articles: [] });
      } else {
         where = `WHERE domain_id IN (${allowedIds.map(() => '?').join(',')})`;
         replacements.push(...allowedIds);
      }

      const [articles] = await db.query(
         `SELECT ${articleIdSql} AS id, domain_id, title, slug, status, target_keyword, meta_title, word_count,
                 published_at, publish_target, publish_url, meta_url, created_at, updated_at, content_score
          FROM articles ${where}
          ORDER BY created_at DESC`,
         { replacements },
      );

      // Merge site_context entries that don't have matching articles yet.
      // Pages imported during /sites configuration live in site_context and may
      // not have corresponding articles — include them so they show in recommendations.
      if (resolvedDomainId) {
         const [scRows] = await db.query(
            `SELECT sc.id, sc.domain_id, COALESCE(NULLIF(sc.title,''), sc.url) AS title,
                    sc.url AS publish_url, sc.language, sc.created_at
             FROM site_context sc
             WHERE sc.domain_id = ?
               AND NOT EXISTS (
                 SELECT 1 FROM articles a
                 WHERE a.domain_id = sc.domain_id
                   AND (a.publish_url = sc.url OR a.meta_url = sc.url)
               )
             ORDER BY sc.created_at DESC`,
            { replacements: [resolvedDomainId] },
         );
         const merged = (scRows as any[]).map((sc: any) => ({
            id: `sc_${sc.id}`,
            domain_id: sc.domain_id,
            title: sc.title,
            slug: null,
            status: 'not_started',
            target_keyword: null,
            meta_title: null,
            word_count: 0,
            published_at: null,
            publish_target: null,
            publish_url: sc.publish_url,
            meta_url: sc.publish_url,
            created_at: sc.created_at,
            updated_at: sc.created_at,
            content_score: 0,
            source: 'site_context',
         }));
         return res.status(200).json({ articles: [...(articles as any[]), ...merged] });
      }

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
