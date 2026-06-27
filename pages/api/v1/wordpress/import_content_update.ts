// POST /api/v1/wordpress/import_content_update — plugin pushes edited WP content
// back into the existing draft article.
import type { NextApiRequest, NextApiResponse } from 'next';
import { authPluginRequest } from '../../../../lib/wpConnection';
import { updateArticleContent, permalinkHash } from '../../../../lib/wpDraft';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });

   const draftId = Number(req.body?.draft_id);
   if (!draftId) return res.status(400).json({ message: 'draft_id is required.' });

   await updateArticleContent(draftId, String(req.body?.content || ''));
   return res.status(200).json({ id: draftId, permalink_hash: permalinkHash(draftId) });
}
