import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureKeywordResearchTables } from '@/src/infrastructure/persistence/schema/ensureKeywordResearchTables';
import { enqueueKeywordResearch } from '@/src/infrastructure/keywords/keywordResearchRunner';
import { getErrorMessage } from '@/src/core/shared/errors';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await ensureKeywordResearchTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as unknown as { ID: number }).ID;

   const body = (req.body || {}) as { seed?: unknown; country?: unknown };
   const seed = typeof body.seed === 'string' ? body.seed.trim() : '';
   if (!seed) return res.status(400).json({ error: 'A keyword seed is required' });
   const country = typeof body.country === 'string' ? body.country.trim().toUpperCase() : 'US';
   if (!country) return res.status(400).json({ error: 'Country is required' });

   try {
      const id = await enqueueKeywordResearch(domainId, seed, country);
      try {
         const { reserveKeywordResearchQuota } = await import('@/src/infrastructure/quota/keywordResearch');
         await reserveKeywordResearchQuota(domainId, id, userId);
      } catch (e) {
         const { isPlanLimitError, planLimitBody } = await import('@/src/infrastructure/quota/index');
         if (isPlanLimitError(e)) {
            const db = (await import('../../../../database/database')).default;
            await db.query(
               "UPDATE keyword_research_runs SET status = 'failed', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
               { replacements: ['Plan quota exceeded', id] },
            ).catch(() => { /* best effort */ });
            return res.status(402).json(planLimitBody(e));
         }
         const { settleKeywordResearchQuota } = await import('@/src/infrastructure/quota/keywordResearch');
         await settleKeywordResearchQuota(domainId, id, 'release').catch(() => {});
         throw e;
      }
      return res.status(202).json({ id });
   } catch (e) {
      return res.status(500).json({ error: getErrorMessage(e) });
   }
}

export default withOrgPaymentAccess(handler);
