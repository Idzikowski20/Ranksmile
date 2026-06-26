import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import { getCurrentUserId } from '../../../../utils/getUser';
import { getAccessibleWorkspaceIds } from '../../../../lib/tenancy';
import { enqueueDomainSetup, kickDomainSetup } from '../../../../lib/domainPipeline';
import db from '../../../../database/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const domainId = Number(req.query.id);
   if (!Number.isFinite(domainId)) return res.status(400).json({ error: 'Invalid domain id' });
   // access check: the domain's workspace must be accessible to the caller
   const drows = await db.query<{ workspace_id: number }>(
      `SELECT workspace_id FROM domain WHERE "ID" = ? LIMIT 1`,
      { replacements: [domainId], type: QueryTypes.SELECT },
   );
   const accessible = await getAccessibleWorkspaceIds(userId);
   if (!drows.length || !accessible.includes(Number(drows[0].workspace_id))) return res.status(404).json({ error: 'Not found' });
   const jobId = await enqueueDomainSetup(domainId);
   void kickDomainSetup(jobId); // fire-and-forget; claim guards double-run
   return res.status(202).json({ jobId });
}
