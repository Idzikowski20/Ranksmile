// GET /api/wordpress/post-options?articleId=  → options for the "Export to WordPress" modal.
// Resolves the article's workspace WordPress connection and asks the plugin's
// list_post_details_options route for the site's post types / categories / tags / authors
// (all returned as { value, label }), plus a static status list and any existing wp_post_id.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { getArticleIdSql } from '../../../lib/articleSql';
import { getConnectionForWorkspace } from '../../../lib/wpConnection';
import { wpRestFetch } from '../../../lib/wpRest';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

export const config = { maxDuration: 30 };

// WordPress post statuses the plugin accepts (resolve_post_status validates against these).
const STATUSES = [
   { value: 'draft', label: 'Draft' },
   { value: 'publish', label: 'Published' },
   { value: 'pending', label: 'Pending' },
   { value: 'future', label: 'Future' },
   { value: 'private', label: 'Private' },
];

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }

   const articleId = Number(req.query.articleId);
   if (!articleId) return res.status(400).json({ error: 'articleId is required' });

   const userId = await getCurrentUserId(req, res);
   if (!(await assertArticleAccess(userId, articleId))) return res.status(403).json({ error: 'Access denied.' });

   const articleIdSql = await getArticleIdSql();
   const [arows] = await db.query(
      `SELECT domain_id, wp_post_id, title, meta_title, meta_description FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      { replacements: [articleId] },
   );
   const article = (arows as Array<{ domain_id: number; wp_post_id: number | null; title: string | null; meta_title: string | null; meta_description: string | null }>)[0];
   if (!article) return res.status(404).json({ error: 'Article not found' });

   const [drows] = await db.query('SELECT workspace_id FROM domain WHERE "ID" = ? LIMIT 1', { replacements: [article.domain_id] });
   const workspaceId = (drows as Array<{ workspace_id: number }>)[0]?.workspace_id;
   const conn = workspaceId ? await getConnectionForWorkspace(workspaceId) : null;
   if (!conn) return res.status(400).json({ error: 'No WordPress site is connected to this workspace.' });

   let data: Record<string, unknown> = {};
   try {
      const r = await wpRestFetch(conn.site_url, 'ranksmileseo/v1/list_post_details_options/', {
         headers: { Authorization: `Bearer ${conn.api_key}` },
      });
      data = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(502).json({ error: 'WordPress did not return post options.' });
   } catch {
      return res.status(502).json({ error: 'Could not reach the WordPress site.' });
   }

   return res.status(200).json({
      siteUrl: conn.site_url,
      types: data.post_types || [],
      categories: data.post_categories || [],
      tags: data.post_tags || [],
      authors: data.post_authors || [],
      statuses: STATUSES,
      wpPostId: article.wp_post_id && article.wp_post_id > 0 ? article.wp_post_id : null,
      defaultTitle: article.meta_title || article.title || '',
      metaTitle: article.meta_title || '',
      metaDescription: article.meta_description || '',
   });
}

export default withOrgPaymentAccess(handler);
