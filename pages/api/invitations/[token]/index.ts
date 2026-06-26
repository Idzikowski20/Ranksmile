import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { getCurrentUser } from '../../../../utils/getUser';
import { getInvitationByToken } from '../../../../lib/invitations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const user = await getCurrentUser(req, res);
   if (!user) return res.status(401).json({ error: 'Not authenticated' });
   const token = req.query.token as string;
   const inv = await getInvitationByToken(token);
   if (!inv || inv.status !== 'pending' || (inv.expires_at && new Date(inv.expires_at) < new Date())) {
      return res.status(200).json({ status: 'invalid' });
   }
   const [orgRows] = await db.query('SELECT name FROM organizations WHERE id = ? LIMIT 1', { replacements: [inv.org_id] }) as [Array<{ name: string }>, unknown];
   let workspaceCount = 0;
   if (inv.workspace_ids) { try { workspaceCount = JSON.parse(inv.workspace_ids).length; } catch { workspaceCount = 0; } }
   else {
      const [wsRows] = await db.query('SELECT COUNT(*) AS n FROM workspaces WHERE org_id = ?', { replacements: [inv.org_id] }) as [Array<{ n: number }>, unknown];
      workspaceCount = Number(wsRows[0]?.n || 0);
   }
   return res.status(200).json({ status: 'pending', email: inv.email, role: inv.role, orgName: orgRows[0]?.name ?? null, workspaceCount });
}
