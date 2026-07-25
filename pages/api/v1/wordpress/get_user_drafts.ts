// POST /api/v1/wordpress/get_user_drafts — list this workspace's drafts (articles)
// in the Ranksmile draft shape the plugin consumes.
import type { NextApiRequest, NextApiResponse } from 'next';
import { authPluginRequest } from '../../../../lib/wpConnection';
import { getDomainIdForWorkspace, listArticlesForDomain, articleToDraft } from '../../../../lib/wpDraft';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });

   const domainId = await getDomainIdForWorkspace(conn.workspace_id);
   const rows = domainId ? await listArticlesForDomain(domainId, String(req.body?.query_keyword || '')) : [];
   return res.status(200).json({ drafts: rows.map(articleToDraft) });
}
