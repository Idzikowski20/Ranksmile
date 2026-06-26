import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../../utils/getUser';
import { finishWorkspaceSetup } from '../../../../lib/workspaces';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const wsId = Number(req.query.id);
   if (!Number.isFinite(wsId)) return res.status(400).json({ error: 'Invalid workspace id' });
   const { brandName, brandKnowledge } = (req.body || {}) as { brandName?: string; brandKnowledge?: string };
   if (!brandName || !brandName.trim()) return res.status(400).json({ error: 'brandName required' });
   try {
      await finishWorkspaceSetup(userId, wsId, brandName, brandKnowledge || '');
      return res.status(200).json({ ok: true });
   } catch (e: any) {
      if (e?.message === 'WORKSPACE_NOT_FOUND') return res.status(404).json({ error: 'Workspace not found' });
      throw e;
   }
}
