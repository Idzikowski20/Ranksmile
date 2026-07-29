// POST /api/wordpress/publish — publish an article to the connected WordPress site
// via the forked plugin's import_post route (it converts our HTML to Gutenberg blocks
// and sideloads images). Body: { articleId, status?: 'draft'|'publish' }.
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { getArticleIdSql } from '../../../lib/articleSql';
import { getConnectionForWorkspace } from '../../../lib/wpConnection';
import { wpRestFetch } from '../../../lib/wpRest';
import { permalinkHash } from '../../../lib/wpDraft';
import { cleanHtmlForWordPress } from '../../../lib/wpContentClean';
import { logRun } from '../../../lib/optimizeLog';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

type ArticleRow = {
   id: number; domain_id: number; title: string | null; content: string | null;
   target_keyword: string | null; meta_title: string | null; meta_description: string | null; slug: string | null;
   wp_post_id: number | null;
};

type WpSelectField = { value?: string | number | null } | string | number | null | undefined;

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }

   const { articleId, status, customFields, title, metaTitle, metaDescription, author, categories, tags, type, mode } = req.body || {};
   if (!articleId) return res.status(400).json({ error: 'articleId is required' });
   // B5: optional ACF/custom-field map { fieldName: value } forwarded to the plugin
   // (it writes each as post meta — ACF fields are post meta). A field-mapping UI is
   // out of scope until a user needs it; this keeps the plumbing real end-to-end.
   const customFieldsMap = customFields && typeof customFields === 'object' && !Array.isArray(customFields) ? customFields : null;
   // The plugin validates the status itself; default to publish for anything unexpected.
   const ALLOWED_STATUS = new Set(['draft', 'publish', 'pending', 'future', 'private']);
   const postStatus = typeof status === 'string' && ALLOWED_STATUS.has(status) ? status : 'publish';

   const userId = await getCurrentUserId(req, res);
   if (!(await assertArticleAccess(userId, Number(articleId)))) return res.status(403).json({ error: 'Access denied.' });

   const articleIdSql = await getArticleIdSql();
   const [rows] = await db.query(
      `SELECT ${articleIdSql} AS id, domain_id, title, content, target_keyword, meta_title, meta_description, slug, wp_post_id FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      { replacements: [articleId] },
   );
   const article = (rows as ArticleRow[])[0];
   if (!article) return res.status(404).json({ error: 'Article not found' });
   if (!article.content) return res.status(400).json({ error: 'Article has no content to publish.' });

   // article → domain → workspace → connection
   const [drows] = await db.query('SELECT workspace_id FROM domain WHERE "ID" = ? LIMIT 1', { replacements: [article.domain_id] });
   const workspaceId = (drows as Array<{ workspace_id: number }>)[0]?.workspace_id;
   const conn = workspaceId ? await getConnectionForWorkspace(workspaceId) : null;
   if (!conn) return res.status(400).json({ error: 'No WordPress site is connected to this workspace.' });

   const cleanContent = cleanHtmlForWordPress(article.content);
   if (!cleanContent) return res.status(400).json({ error: 'Article content is empty after cleanup.' });

   // "create" forces a brand-new post; otherwise, if we've published this article before, send
   // the remote post id so the plugin UPDATES that post instead of creating a duplicate.
   const existingPostId = mode !== 'create' && article.wp_post_id && article.wp_post_id > 0 ? article.wp_post_id : undefined;

   // Build metadata from the modal's selections, falling back to the article's own values.
   // post types/categories/tags/authors are all { value, label } from the plugin; the importer
   // wants { value } (categories/tags as arrays of { value }).
   const toValue = (x: WpSelectField) => ({ value: x && typeof x === 'object' ? x.value : x });
   const metadata: Record<string, unknown> = {
      // The WP post title defaults to the SEO/meta title (the article's `title` is the in-editor
      // heading and can be a stale/generic default), but the modal may override it.
      postTitle: (typeof title === 'string' && title.trim()) || article.meta_title || article.title || '',
      postStatus: { value: postStatus },
      postType: type && typeof type === 'object' && type.value ? { value: type.value } : { value: 'post' },
      postMetaTitle: (typeof metaTitle === 'string' ? metaTitle : article.meta_title) || '',
      postMetaDescription: (typeof metaDescription === 'string' ? metaDescription : article.meta_description) || '',
   };
   if (author && typeof author === 'object' && author.value) metadata.postAuthor = { value: author.value };
   const catValues = Array.isArray(categories) ? categories.map(toValue).filter((c) => c.value != null && c.value !== '') : [];
   if (catValues.length) metadata.postCategory = catValues;
   const tagValues = Array.isArray(tags) ? tags.map(toValue).filter((t) => t.value != null && t.value !== '') : [];
   if (tagValues.length) metadata.postTags = tagValues;

   const payload: Record<string, unknown> = {
      content: cleanContent,
      metadata,
      url: article.slug || '',
      draft_id: article.id,
      permalink_hash: permalinkHash(article.id),
      keywords: article.target_keyword ? [article.target_keyword] : [],
      location: 'United States',
   };
   if (existingPostId) payload.post_id = existingPostId;
   if (customFieldsMap) payload.custom_fields = customFieldsMap;

   let result: { post_id?: number; post_url?: string; edit_post_url?: string; post_status?: string };
   try {
      const r = await wpRestFetch(conn.site_url, 'ranksmileseo/v1/import_post/', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${conn.api_key}` },
         body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.error) {
         return res.status(502).json({ error: data?.error || data?.wp_error_message || 'WordPress rejected the post.' });
      }
      result = data;
   } catch {
      return res.status(502).json({ error: 'Could not reach the WordPress site.' });
   }

   // Record where it was published + the remote post id/status (for future updates).
   const wpStatus = result.post_status || postStatus;
   await db.query(
      `UPDATE articles SET publish_url = ?, publish_target = 'wordpress', published_at = CURRENT_TIMESTAMP,
       wp_post_id = ?, wp_post_status = ?,
       status = ${postStatus === 'publish' ? "'published'" : 'status'}, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
      { replacements: [result.post_url || '', result.post_id ?? existingPostId ?? null, wpStatus, articleId], type: QueryTypes.UPDATE },
   ).catch(() => {});

   // Best-effort before/after log for debugging publish runs (never blocks the response).
   await logRun({
      articleId: Number(articleId),
      kind: 'publish',
      after: cleanContent,
      meta: { title: article.meta_title || article.title || '', status: wpStatus, post_id: result.post_id, updated: !!existingPostId, url: result.post_url },
   });

   return res.status(200).json({
      post_id: result.post_id,
      post_url: result.post_url,
      edit_post_url: result.edit_post_url,
      post_status: wpStatus,
      updated: !!existingPostId,
   });
}

export default withOrgPaymentAccess(handler);
