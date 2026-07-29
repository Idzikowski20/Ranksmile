import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../utils/getUser';
import { changeMemberRole, removeMember } from '../../../lib/members';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

function mapError(res: NextApiResponse, e: unknown): void {
   const m = e instanceof Error ? e.message : String(e);
   if (m === 'FORBIDDEN') { res.status(403).json({ error: 'Not allowed' }); return; }
   if (m === 'MEMBER_NOT_FOUND') { res.status(404).json({ error: 'Not found' }); return; }
   if (m === 'OWNER_LAST') { res.status(409).json({ error: 'You must keep at least one owner' }); return; }
   throw e;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });
   const id = Number(req.query.id);
   if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

   try {
      if (req.method === 'PATCH') {
         const role = (req.body || {}).role;
         if (!['owner', 'admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
         await changeMemberRole(userId, id, role);
         return res.status(200).json({ ok: true });
      }
      if (req.method === 'DELETE') {
         await removeMember(userId, id);
         return res.status(200).json({ ok: true });
      }
      res.setHeader('Allow', 'PATCH, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
   } catch (e) {
      return mapError(res, e);
   }
}

export default withOrgPaymentAccess(handler);
