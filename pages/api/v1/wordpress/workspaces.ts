// GET /api/v1/wordpress/workspaces — the user's workspaces (for the plugin's picker).
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { authPluginRequest } from '../../../../lib/wpConnection';
import { getAccessibleWorkspaceIds } from '../../../../lib/tenancy';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });

   const ids = await getAccessibleWorkspaceIds(conn.user_id);
   let workspaces: Array<{ id: number; name: string }> = [];
   if (ids.length) {
      const [rows] = await db.query(
         `SELECT id, name FROM workspaces WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id ASC`,
         { replacements: ids },
      );
      workspaces = (rows as Array<{ id: number; name: string }>).map((w) => ({ id: w.id, name: w.name }));
   }
   return res.status(200).json({ workspaces, default_workspace_id: conn.workspace_id });
}

export default withOrgPaymentAccess(handler);
