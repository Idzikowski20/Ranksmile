// GET  /api/articles?domainId=X  — lista artykułów
// POST /api/articles              — utwórz artykuł (bez AI)
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { getAccessibleWorkspaceIds, getScopedWorkspaceIds, ForbiddenWorkspaceError } from '../../../lib/tenancy';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import Domain from '../../../database/models/domain';
import { Op } from 'sequelize';
import { getArticleIdSql } from '../../../lib/articleSql';
import { getErrorMessage } from '../../../lib/errors';
import { queryOne, type ArticleRow } from '../../../lib/db/query';
import type { SqlReplacements } from '../../../lib/types/db';

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

/** Domain IDs in the user's active (scoped) workspace. */
export async function getUserDomainIds(
   userId: string | null,
   req?: NextApiRequest,
): Promise<number[]> {
   if (!userId) return [];
   const wsIds = req
      ? await getScopedWorkspaceIds(req, userId)
      : await getAccessibleWorkspaceIds(userId);
   if (!wsIds.length) return [];
   const domains = await Domain.findAll({ where: { workspace_id: { [Op.in]: wsIds } }, attributes: ['ID'] });
   return domains.map((d) => d.ID);
}

async function getArticles(req: NextApiRequest, res: NextApiResponse, userId: string | null) {
   const { domainId, domain: domainSlug, limit: limitRaw, offset: offsetRaw, sort, q } = req.query;

   const limit = Math.min(Math.max(parseInt(String(limitRaw ?? '30'), 10) || 30, 1), 100);
   const offset = Math.max(parseInt(String(offsetRaw ?? '0'), 10) || 0, 0);
   const search = typeof q === 'string' ? q.trim() : '';
   const sortKey = typeof sort === 'string' ? sort : 'ContentUpdatedAt';

   const orderBy = (() => {
      if (sortKey === 'Title') return 'title ASC';
      if (sortKey === 'CreatedAt') return 'created_at DESC';
      return 'updated_at DESC';
   })();

   try {
      const articleIdSql = await getArticleIdSql();
      let where = '';
      const replacements: SqlReplacements = [];

      const allowedIds = await getUserDomainIds(userId, req);

      let resolvedDomainId: number | undefined;
      if (domainId) {
         resolvedDomainId = parseInt(domainId as string, 10);
      } else if (domainSlug) {
         const slugToDomain = (domainSlug as string).replaceAll('-', '.').replaceAll('_', '-');
         const d = await Domain.findOne({ where: { domain: slugToDomain }, attributes: ['ID'] });
         resolvedDomainId = d?.ID;
      }

      if (resolvedDomainId) {
         if (!allowedIds.includes(resolvedDomainId)) {
            return res.status(403).json({ error: 'Access denied.' });
         }
         where = 'WHERE domain_id = ?';
         replacements.push(resolvedDomainId);
      } else if (allowedIds.length === 0) {
         return res.status(200).json({ articles: [], total: 0, hasMore: false, limit, offset });
      } else {
         where = `WHERE domain_id IN (${allowedIds.map(() => '?').join(',')})`;
         replacements.push(...allowedIds);
      }

      if (search) {
         where += ' AND (LOWER(title) LIKE ? OR LOWER(target_keyword) LIKE ?)';
         const pattern = `%${search.toLowerCase()}%`;
         replacements.push(pattern, pattern);
      }

      const countReplacements = [...replacements];
      const [countRows] = await db.query(
         `SELECT COUNT(*) AS total FROM articles ${where}`,
         { replacements: countReplacements },
      );
      const total = Number((countRows as Array<{ total: number | string }>)[0]?.total ?? 0);

      const [articles] = await db.query(
         `SELECT ${articleIdSql} AS id, domain_id, title, slug, status, target_keyword, meta_title, word_count,
                 published_at, publish_target, publish_url, meta_url, created_at, updated_at, content_score
          FROM articles ${where}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?`,
         { replacements: [...replacements, limit, offset] },
      );

      let result = articles as unknown[];

      if (resolvedDomainId && offset === 0 && !search) {
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
         const merged = (scRows as Array<{ id: number; domain_id: number; title: string | null; publish_url: string | null; language: string | null; created_at: string | null }>).map((sc) => ({
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
         result = [...result, ...merged];
      }

      const hasMore = offset + limit < total;
      return res.status(200).json({ articles: result, total, hasMore, limit, offset });
   } catch (error) {
      if (error instanceof ForbiddenWorkspaceError) {
         return res.status(403).json({ error: 'Forbidden workspace' });
      }
      return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
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
      const { getOrgIdForDomain, ensureOrgQuotaBalances, adjustActiveUsage } = await import('../../../lib/quota');
      const orgId = await getOrgIdForDomain(parseInt(domain_id, 10));
      if (!orgId) return res.status(400).json({ error: 'Domain has no organization' });
      await ensureOrgQuotaBalances(orgId);

      const articleIdSql = await getArticleIdSql();
      let articleId: number | undefined;
      const idem = `doc-create:${orgId}:${domain_id}:${title}:${cryptoRandom()}`;
      await db.transaction(async (tx) => {
         await adjustActiveUsage(
            {
               orgId,
               meter: 'documents',
               delta: 1,
               idempotencyKey: idem,
               ref: { type: 'article', id: 'pending' },
               userId,
            },
            { transaction: tx },
         );
         if (process.env.DATABASE_URL) {
            const rows = await db.query<{ id: number }>(
               `INSERT INTO articles (domain_id, title, target_keyword, status, created_at, updated_at)
                VALUES (?, ?, ?, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING ${articleIdSql} AS id`,
               { replacements: [domain_id, title, target_keyword || ''], type: QueryTypes.SELECT, transaction: tx },
            );
            articleId = rows[0]?.id;
         } else {
            const [newArticleId] = await db.query(
               `INSERT INTO articles (domain_id, title, target_keyword, status, created_at, updated_at)
                VALUES (?, ?, ?, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
               { replacements: [domain_id, title, target_keyword || ''], type: QueryTypes.INSERT, transaction: tx },
            );
            articleId = newArticleId as unknown as number;
         }
      });
      return res.status(200).json({ articleId, title });
   } catch (error) {
      const { isPlanLimitError, planLimitBody } = await import('../../../lib/quota');
      if (isPlanLimitError(error)) return res.status(402).json(planLimitBody(error));
      return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
   }
}

function cryptoRandom(): string {
   return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function deleteArticle(req: NextApiRequest, res: NextApiResponse, userId: string | null) {
   const { id } = req.query;
   if (!id) return res.status(400).json({ error: 'id is required' });

   // Sprawdź własność artykułu przez domenę
   try {
      const articleIdSql = await getArticleIdSql();
      const article = await queryOne<Pick<ArticleRow, 'domain_id'>>(
         `SELECT domain_id FROM articles WHERE ${articleIdSql} = ?`,
         [id],
      );
      if (!article) return res.status(404).json({ error: 'Article not found' });

      const allowedIds = await getUserDomainIds(userId);
      if (!allowedIds.includes(article.domain_id)) {
         return res.status(403).json({ error: 'Access denied.' });
      }

      const { getOrgIdForDomain, ensureOrgQuotaBalances, adjustActiveUsage } = await import('../../../lib/quota');
      const orgId = await getOrgIdForDomain(article.domain_id);
      await db.transaction(async (tx) => {
         await db.query(`DELETE FROM articles WHERE ${articleIdSql} = ?`, { replacements: [id], transaction: tx });
         if (orgId) {
            await ensureOrgQuotaBalances(orgId);
            await adjustActiveUsage(
               {
                  orgId,
                  meter: 'documents',
                  delta: -1,
                  idempotencyKey: `doc-delete:${id}`,
                  ref: { type: 'article', id: String(id) },
                  userId,
               },
               { transaction: tx },
            );
         }
      });
      return res.status(200).json({ deleted: true });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
   }
}
