import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '@/src/infrastructure/persistence/schema/ensureAiVisibilityTables';
import { queryOne } from '@/src/infrastructure/db/query';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';

type ScanRow = {
   id: number, status: string, progress_done: number, progress_total: number, cost_micros: number,
   finished_at: string | null, sources_done_at: string | null, profiles_done_at: string | null,
};
/** Counts for the follow-on phases the progress bar reports (sources → brands → profiles). */
type PhaseRow = { sources_total: number, sources_read: number, brands_pending: number, profiles_built: number };

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureAiVisibilityTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as unknown as { ID: number }).ID;

   const scan = await queryOne<ScanRow>(
      `SELECT s.id, s.status, s.progress_done, s.progress_total, s.cost_micros, s.finished_at,
              s.sources_done_at, s.profiles_done_at
       FROM ai_vis_scans s JOIN ai_vis_configs c ON c.id = s.config_id
       WHERE c.domain_id = ? ORDER BY s.id DESC LIMIT 1`,
      [domainId],
   );
   if (!scan) {
      return res.status(200).json({
         status: 'idle', progressDone: 0, progressTotal: 0, costUsd: 0, finishedAt: null,
         sourcesTotal: 0, sourcesRead: 0, brandsPending: 0, profilesBuilt: 0,
         sourcesPending: false, profilesPending: false,
      });
   }

   // The follow-on phases have no column on the scan row — they are the state of their own
   // tables, so the counters are read from there. One round trip, all counts scalar.
   const phases = await queryOne<PhaseRow>(
      `SELECT
         (SELECT COUNT(*) FROM ai_vis_sources x WHERE x.scan_id = ?) AS sources_total,
         (SELECT COUNT(*) FROM ai_vis_sources x WHERE x.scan_id = ? AND x.fetched_at IS NOT NULL) AS sources_read,
         (SELECT COUNT(*) FROM ai_vis_results r WHERE r.scan_id = ? AND r.brands IS NULL AND r.error IS NULL AND r.answer IS NOT NULL) AS brands_pending,
         (SELECT COUNT(*) FROM ai_vis_brand_profiles p WHERE p.scan_id = ?) AS profiles_built`,
      [scan.id, scan.id, scan.id, scan.id],
   );

   return res.status(200).json({
      status: scan.status,
      progressDone: scan.progress_done || 0,
      progressTotal: scan.progress_total || 0,
      costUsd: (scan.cost_micros || 0) / 1e6, // integer micros → USD at the boundary
      finishedAt: scan.finished_at,
      sourcesTotal: Number(phases?.sources_total ?? 0),
      sourcesRead: Number(phases?.sources_read ?? 0),
      brandsPending: Number(phases?.brands_pending ?? 0),
      profilesBuilt: Number(phases?.profiles_built ?? 0),
      // Row counts cannot say "finished": a scan that cited nothing, or named no brands,
      // has zero rows for the same reason a scan that has not started does. The phase
      // writes a marker when it drains, and that is the only completion signal.
      sourcesPending: !scan.sources_done_at,
      profilesPending: !scan.profiles_done_at,
   });
}

export default withOrgPaymentAccess(handler);
