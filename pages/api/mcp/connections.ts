/**
 * /api/mcp/connections — the agents the signed-in user has granted MCP access to.
 *
 *   GET                      → list them
 *   DELETE ?client_id=<id>   → revoke every token that client holds
 *
 * Session-authenticated (same-origin, settings UI), not bearer: a token must not be able
 * to manage the grants that issued it.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../utils/getUser';
import { listUserGrants, revokeGrant } from '@/src/infrastructure/mcp/oauthStore';
import { getErrorMessage } from '@/src/core/shared/errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });

   try {
      if (req.method === 'GET') {
         return res.status(200).json({ connections: await listUserGrants(userId) });
      }
      if (req.method === 'DELETE') {
         const clientId = typeof req.query.client_id === 'string' ? req.query.client_id : '';
         if (!clientId) return res.status(400).json({ error: 'client_id required' });
         await revokeGrant(userId, clientId);
         return res.status(200).json({ ok: true });
      }
      res.setHeader('Allow', 'GET, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
   } catch (err) {
      console.error('[mcp] connections failed:', err);
      return res.status(500).json({ error: getErrorMessage(err) || 'Server error' });
   }
}
