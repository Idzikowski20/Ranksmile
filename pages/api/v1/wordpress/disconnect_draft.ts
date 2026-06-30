// POST /api/v1/wordpress/disconnect_draft — drop the draft↔post link (no persistent
// link is stored on our side yet, so just acknowledge).
import type { NextApiRequest, NextApiResponse } from 'next';
import { authPluginRequest } from '../../../../lib/wpConnection';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });
   return res.status(200).json({ disconnected: true });
}
