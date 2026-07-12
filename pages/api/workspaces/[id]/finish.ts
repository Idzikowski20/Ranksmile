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
   } catch (e) {
      if ((e as { message?: string }).message === 'WORKSPACE_NOT_FOUND') return res.status(404).json({ error: 'Workspace not found' });
      throw e;
   }
   // resolve the workspace's domain, then enqueue + kick the setup pipeline (best-effort)
   try {
      const { default: db } = await import('../../../../database/database');
      const { QueryTypes } = await import('sequelize');
      const drows = await db.query<{ id: number }>(
         `SELECT "ID" as id FROM domain WHERE workspace_id = ? LIMIT 1`,
         { replacements: [wsId], type: QueryTypes.SELECT },
      );
      const domainId = drows[0]?.id;
      if (domainId) {
         const { enqueueDomainSetup, kickDomainSetup } = await import('../../../../lib/domainPipeline');
         const jobId = await enqueueDomainSetup(Number(domainId));
         void kickDomainSetup(jobId);
         // Warm Performance cache — domain.search_console is set during configure when GSC site was picked.
         try {
            const Domain = (await import('../../../../database/models/domain')).default;
            const { fetchDomainSCData, getSearchConsoleApiInfo, hasValidSCAuth } = await import('../../../../utils/searchConsole');
            const row = await Domain.findOne({ where: { ID: domainId } });
            if (row) {
               const plain = row.get({ plain: true }) as DomainType;
               const scApi = await getSearchConsoleApiInfo(plain, userId);
               if (hasValidSCAuth(scApi)) void fetchDomainSCData(plain, scApi);
            }
         } catch { /* best-effort */ }
      }
   } catch { /* pipeline kickoff is best-effort; dashboard fallback covers it */ }
   return res.status(200).json({ ok: true });
}
