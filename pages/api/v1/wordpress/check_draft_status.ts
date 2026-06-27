// POST /api/v1/wordpress/check_draft_status — our drafts are always ready (no SERP scrape step).
import type { NextApiRequest, NextApiResponse } from 'next';
import { authPluginRequest } from '../../../../lib/wpConnection';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });
   return res.status(200).json({ draft_ready: 1, draft_status: 'ready' });
}
