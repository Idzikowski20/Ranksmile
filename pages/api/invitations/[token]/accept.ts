import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUser } from '../../../../utils/getUser';
import { acceptInvitation } from '../../../../lib/invitations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const user = await getCurrentUser(req, res);
   if (!user) return res.status(401).json({ error: 'Not authenticated' });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const token = req.query.token as string;
   try {
      await acceptInvitation(user.id, user.email, token);
      return res.status(200).json({ ok: true });
   } catch (e: any) {
      if (e?.message === 'INVITE_EMAIL_MISMATCH') return res.status(409).json({ error: e.message });
      if (e?.message === 'INVITE_NOT_PENDING') return res.status(410).json({ error: e.message });
      return res.status(500).json({ error: 'Error' });
   }
}
