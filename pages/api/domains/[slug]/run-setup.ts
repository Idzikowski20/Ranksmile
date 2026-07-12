import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { enqueueDomainSetup, kickDomainSetup } from '../../../../lib/domainPipeline';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as { ID: number }).ID;
   const jobId = await enqueueDomainSetup(domainId);
   const statusRows = await db.query<{ status: string }>(
      'SELECT status FROM analysis_jobs WHERE id = ? LIMIT 1',
      { replacements: [jobId], type: QueryTypes.SELECT },
   );
   if (statusRows[0]?.status === 'done') {
      void import('../../../../lib/scoreDomainPages')
         .then((m) => m.scoreDomainPages(domainId))
         .catch((err) => { console.warn('[run-setup] rescore failed:', err); });
      return res.status(202).json({ jobId, rescoring: true });
   }
   void kickDomainSetup(jobId);
   return res.status(202).json({ jobId });
}
