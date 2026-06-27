// POST /api/v1/wordpress/get_draft_sync_status — last-edit timestamps for a draft.
import type { NextApiRequest, NextApiResponse } from 'next';
import { authPluginRequest } from '../../../../lib/wpConnection';
import { getArticleRow } from '../../../../lib/wpDraft';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });

   const a = await getArticleRow(Number(req.body?.draft_id));
   const iso = (() => { try { return new Date(a?.updated_at || a?.created_at || Date.now()).toISOString(); } catch { return new Date().toISOString(); } })();
   return res.status(200).json({ surfer_last_update_date: iso, last_sync_date: iso, last_sync_direction: 'from Surfer to WordPress' });
}
