// POST /api/v1/wordpress/get_draft_sync_status — last-edit timestamps for a draft.
import type { NextApiRequest, NextApiResponse } from 'next';
import { authPluginRequest } from '../../../../lib/wpConnection';
import { getArticleRow } from '../../../../lib/wpDraft';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });

   const a = await getArticleRow(Number(req.body?.draft_id));
   const raw = a?.updated_at ?? a?.created_at;
   const iso = new Date(raw != null ? String(raw) : Date.now()).toISOString();
   return res.status(200).json({ surfer_last_update_date: iso, last_sync_date: iso, last_sync_direction: 'from Ranksmile to WordPress' });
}

export default withOrgPaymentAccess(handler);
