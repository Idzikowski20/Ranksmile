import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../utils/getUser';
import { getActiveWorkspaceId, ForbiddenWorkspaceError } from '../../../lib/tenancy';
import { listWorkspaces, createWorkspace } from '../../../lib/workspaces';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });

   if (req.method === 'GET') {
      try {
         const [workspaces, activeId] = await Promise.all([listWorkspaces(userId), getActiveWorkspaceId(req, userId)]);
         return res.status(200).json({ workspaces, activeId });
      } catch (e) {
         if (e instanceof ForbiddenWorkspaceError) {
            return res.status(403).json({ error: 'Forbidden workspace' });
         }
         throw e;
      }
   }
   if (req.method === 'POST') {
      const name = String(req.body?.name ?? '').trim();
      if (!name) return res.status(400).json({ error: 'Name is required' });
      try {
         return res.status(201).json(await createWorkspace(userId, name));
      } catch (e) {
         const { isPlanLimitError, planLimitBody } = await import('../../../lib/quota');
         if (isPlanLimitError(e)) return res.status(402).json(planLimitBody(e));
         throw e;
      }
   }
   res.setHeader('Allow', 'GET, POST');
   return res.status(405).json({ error: 'Method not allowed' });
}

export default withOrgPaymentAccess(handler);
