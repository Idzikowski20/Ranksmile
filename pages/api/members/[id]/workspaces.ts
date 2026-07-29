import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../../utils/getUser';
import { setMemberWorkspaces } from '../../../../lib/members';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });
   const id = Number(req.query.id);
   if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
   if (req.method !== 'PATCH') { res.setHeader('Allow', 'PATCH'); return res.status(405).json({ error: 'Method not allowed' }); }

   const raw = (req.body || {}).workspaceIds;
   const workspaceIds: number[] | null = Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : null;
   try {
      await setMemberWorkspaces(userId, id, workspaceIds);
      return res.status(200).json({ ok: true });
   } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (m === 'FORBIDDEN') return res.status(403).json({ error: 'Not allowed' });
      throw e;
   }
}

export default withOrgPaymentAccess(handler);
