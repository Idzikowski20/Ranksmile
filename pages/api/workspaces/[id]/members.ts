import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../../utils/getUser';
import { getCallerRole } from '../../../../lib/members';
import { listWorkspaceAccess, setWorkspaceAccess } from '../../../../lib/workspaceMembers';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

function mapError(res: NextApiResponse, e: unknown): void {
   const m = e instanceof Error ? e.message : String(e);
   if (m === 'FORBIDDEN') { res.status(403).json({ error: 'Not allowed' }); return; }
   if (m === 'WORKSPACE_NOT_FOUND') { res.status(404).json({ error: 'Not found' }); return; }
   throw e;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });
   const id = Number(req.query.id);
   if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

   try {
      if (req.method === 'GET') {
         const [role, members] = await Promise.all([getCallerRole(userId), listWorkspaceAccess(userId, id)]);
         return res.status(200).json({ role, members });
      }
      if (req.method === 'PUT') {
         const raw = (req.body || {}).memberIds;
         const memberIds = (Array.isArray(raw) ? raw : []).filter(Number.isFinite);
         await setWorkspaceAccess(userId, id, memberIds);
         return res.status(200).json({ ok: true });
      }
      res.setHeader('Allow', 'GET, PUT');
      return res.status(405).json({ error: 'Method not allowed' });
   } catch (e) {
      return mapError(res, e);
   }
}

export default withOrgPaymentAccess(handler);
