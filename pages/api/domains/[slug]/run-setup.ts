import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { domainSetupActiveFresh, resetDomainSetupRun, kickDomainSetup } from '@/src/infrastructure/cron/domainPipeline';
import { rejectIfDomainBusy } from '@/src/infrastructure/cron/domainLock';
import { getErrorMessage } from '@/src/core/shared/errors';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as { ID: number }).ID;
   if (await rejectIfDomainBusy(res, domainId, 'ai_visibility_scan')) return undefined;
   try {
      // Don't disturb a fresh in-flight run — just report it.
      const { jobId, activeFresh } = await domainSetupActiveFresh(domainId);
      if (activeFresh) return res.status(202).json({ jobId, alreadyRunning: true });

      const { reserveSiteAuditRun, releaseSiteAuditReservationById } = await import('@/src/infrastructure/quota/siteAudit');
      const { isPlanLimitError, planLimitBody } = await import('@/src/infrastructure/quota/index');

      // Reserve BEFORE touching the job: a plan-limit reject leaves the completed job (and
      // its result/metadata) untouched — no phantom-queued row, nothing to roll back.
      const runKey = randomUUID();
      let reservationId: number;
      try {
         ({ reservationId } = await reserveSiteAuditRun(domainId, jobId, runKey, userId));
      } catch (e) {
         if (isPlanLimitError(e)) return res.status(402).json(planLimitBody(e));
         throw e;
      }

      // Atomic reset stamped with runKey. Concurrent reruns race here; only the winner runs,
      // and a loser releases its own (now redundant) reservation so nothing dangles.
      const won = await resetDomainSetupRun(domainId, runKey);
      if (!won) {
         await releaseSiteAuditReservationById(reservationId).catch(() => {});
         return res.status(202).json({ jobId, alreadyRunning: true });
      }
      void kickDomainSetup(jobId);
      return res.status(202).json({ jobId });
   } catch (e) {
      return res.status(500).json({ error: getErrorMessage(e) });
   }
}

export default withOrgPaymentAccess(handler);
