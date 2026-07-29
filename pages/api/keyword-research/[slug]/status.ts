import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureKeywordResearchTables } from '../../../../lib/ensureKeywordResearchTables';
import { queryRows } from '../../../../lib/db/query';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

type CountRow = { status: string; n: number };
type InFlightRow = { id: number; status: string; progress_done: number | null; progress_total: number | null };

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await ensureKeywordResearchTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as unknown as { ID: number }).ID;

   const counts = await queryRows<CountRow>(
      'SELECT status, COUNT(*) AS n FROM keyword_research_runs WHERE domain_id = ? GROUP BY status',
      [domainId],
   );
   const by = (s: string): number => {
      const row = counts.find((c) => c.status === s);
      return row ? Number(row.n) || 0 : 0;
   };

   const inFlight = await queryRows<InFlightRow>(
      "SELECT id, status, progress_done, progress_total FROM keyword_research_runs WHERE domain_id = ? AND status IN ('queued','running') ORDER BY id ASC",
      [domainId],
   );

   return res.status(200).json({
      queued: by('queued'),
      running: by('running'),
      completed: by('completed'),
      failed: by('failed'),
      runs: inFlight.map((r) => ({
         id: r.id,
         status: r.status,
         progressDone: r.progress_done || 0,
         progressTotal: r.progress_total || 0,
      })),
   });
}

export default withOrgPaymentAccess(handler);
