import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../utils/getUser';
import { getAccessibleWorkspaceIds } from '../../../lib/tenancy';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }

   const wsId = parseInt(req.body?.id, 10);
   if (!Number.isInteger(wsId) || wsId <= 0) return res.status(400).json({ error: 'Bad workspace id' });
   const accessible = await getAccessibleWorkspaceIds(userId);
   if (!accessible.includes(wsId)) return res.status(403).json({ error: 'Access denied.' });

   res.setHeader('Set-Cookie', `active_workspace=${wsId}; Path=/; Max-Age=31536000; SameSite=Lax`);
   return res.status(200).json({ activeId: wsId });
}

export default withOrgPaymentAccess(handler);
