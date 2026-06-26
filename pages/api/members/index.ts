import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUser } from '../../../utils/getUser';
import { listMembers, assertCanManage, getCallerRole, backfillCallerEmail } from '../../../lib/members';
import { listInvitations, createInvitation } from '../../../lib/invitations';
import { readOrganization } from '../../../lib/organization';
import { sendMail } from '../../../lib/sendMail';
import { inviteEmailHtml } from '../../../lib/inviteEmail';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const user = await getCurrentUser(req, res);
   if (!user) return res.status(401).json({ error: 'Not authenticated' });
   const userId = user.id;

   if (req.method === 'GET') {
      await backfillCallerEmail(userId, user.email);
      const [members, invitations, role] = await Promise.all([
         listMembers(userId), listInvitations(userId), getCallerRole(userId),
      ]);
      return res.status(200).json({ members, invitations, role });
   }
   if (req.method === 'POST') {
      try { await assertCanManage(userId); } catch { return res.status(403).json({ error: 'FORBIDDEN' }); }
      const { email, role, workspaceIds } = req.body || {};
      if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Email is required' });
      const inv = await createInvitation(userId, { email, role: role || 'member', workspaceIds: Array.isArray(workspaceIds) ? workspaceIds : null });
      const org = await readOrganization(userId);
      const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/invite/${inv.token}`;
      const expiresAt = inv.expires_at ? new Date(inv.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const { sent } = await sendMail({
         to: inv.email,
         subject: `You've been invited to join ${org.name || 'an organization'}`,
         html: inviteEmailHtml({ orgName: org.name || 'an organization', role: inv.role, acceptUrl, expiresAt }),
      });
      return res.status(201).json({ ok: true, sent });
   }
   res.setHeader('Allow', 'GET, POST');
   return res.status(405).json({ error: 'Method not allowed' });
}
