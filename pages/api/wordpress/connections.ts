// GET  /api/wordpress/connections?workspaceId=  → list WP connections for a workspace.
// DELETE /api/wordpress/connections  { id, workspaceId }  → disconnect (also tells the plugin).
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUser } from '../../../utils/getUser';
import { getAccessibleWorkspaceIds } from '../../../lib/tenancy';
import { listConnectionsForWorkspace, deleteConnection } from '../../../lib/wpConnection';
import { wpRestFetch } from '../../../lib/wpRest';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

   const user = await getCurrentUser(req, res);
   if (!user?.id) return res.status(401).json({ error: 'Not authenticated' });
   const allowed = await getAccessibleWorkspaceIds(user.id);

   if (req.method === 'GET') {
      const workspaceId = Number(req.query.workspaceId);
      if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
      if (!allowed.includes(workspaceId)) return res.status(403).json({ error: 'Access denied.' });
      const connections = await listConnectionsForWorkspace(workspaceId);
      return res.status(200).json({ connections });
   }

   if (req.method === 'DELETE') {
      const { id, workspaceId } = req.body || {};
      if (!id || !workspaceId) return res.status(400).json({ error: 'id and workspaceId are required' });
      if (!allowed.includes(Number(workspaceId))) return res.status(403).json({ error: 'Access denied.' });

      const row = await deleteConnection(Number(id), Number(workspaceId));
      if (!row) return res.status(404).json({ error: 'Connection not found' });

      // Best-effort: tell the plugin to forget us too. We've already removed our side,
      // so a failure here (site down, plugin removed) must not fail the disconnect.
      try {
         await wpRestFetch(row.site_url, 'ranksmileseo/v1/disconnect/', { method: 'DELETE', headers: { Authorization: `Bearer ${row.api_key}` } });
      } catch { /* plugin side may be unreachable — our record is already gone */ }

      return res.status(200).json({ disconnected: true });
   }

   res.setHeader('Allow', 'GET, DELETE');
   return res.status(405).json({ error: 'Method not allowed' });
}
