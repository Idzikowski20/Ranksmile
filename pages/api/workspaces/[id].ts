import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../utils/getUser';
import { renameWorkspace, deleteWorkspace } from '../../../lib/workspaces';
import { getErrorMessage } from '../../../lib/errors';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

const ERR_STATUS: Record<string, number> = {
   WORKSPACE_NOT_FOUND: 404,
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });
   const wsId = parseInt(req.query.id as string, 10);
   if (!Number.isInteger(wsId)) return res.status(400).json({ error: 'Bad workspace id' });

   try {
      if (req.method === 'PATCH') {
         const name = String(req.body?.name ?? '').trim();
         if (!name) return res.status(400).json({ error: 'Name is required' });
         await renameWorkspace(userId, wsId, name);
         return res.status(200).json({ id: wsId, name });
      }
      if (req.method === 'DELETE') {
         await deleteWorkspace(userId, wsId);
         return res.status(200).json({ deleted: wsId });
      }
      res.setHeader('Allow', 'PATCH, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
   } catch (e) {
      const msg = getErrorMessage(e);
      const code = ERR_STATUS[msg] || 500;
      return res.status(code).json({ error: msg || 'Error' });
   }
}

export default withOrgPaymentAccess(handler);
