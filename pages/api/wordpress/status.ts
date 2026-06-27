// GET /api/wordpress/status?articleId=X — is a WordPress site connected for this
// article's workspace? Drives the editor's Export → WordPress UI.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { getArticleIdSql } from '../../../lib/articleSql';
import { getConnectionForWorkspace } from '../../../lib/wpConnection';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

   const articleId = Number(req.query.articleId);
   if (!articleId) return res.status(400).json({ error: 'articleId is required' });

   const userId = await getCurrentUserId(req, res);
   if (!(await assertArticleAccess(userId, articleId))) return res.status(403).json({ error: 'Access denied.' });

   const articleIdSql = await getArticleIdSql();
   const [arows] = await db.query(`SELECT domain_id FROM articles WHERE ${articleIdSql} = ? LIMIT 1`, { replacements: [articleId] });
   const domainId = (arows as Array<{ domain_id: number }>)[0]?.domain_id;
   const [drows] = domainId ? await db.query('SELECT workspace_id FROM domain WHERE "ID" = ? LIMIT 1', { replacements: [domainId] }) : [[]];
   const workspaceId = (drows as Array<{ workspace_id: number }>)[0]?.workspace_id;
   const conn = workspaceId ? await getConnectionForWorkspace(workspaceId) : null;

   return res.status(200).json({ connected: !!conn, siteUrl: conn?.site_url || null });
}
