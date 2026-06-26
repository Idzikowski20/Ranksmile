import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertCanManage } from '../../../../lib/members';
import { revokeInvitation } from '../../../../lib/invitations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });
   if (req.method !== 'DELETE') { res.setHeader('Allow', 'DELETE'); return res.status(405).json({ error: 'Method not allowed' }); }
   try { await assertCanManage(userId); } catch { return res.status(403).json({ error: 'FORBIDDEN' }); }
   const id = parseInt(req.query.id as string, 10);
   if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
   await revokeInvitation(userId, id);
   return res.status(200).json({ ok: true });
}
