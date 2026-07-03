// GET /api/ai-visibility/[slug]/history — completed scans newest-first with their
// visibility score. Not consumed by the UI yet; enables a future trend chart with
// no schema change.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { getErrorMessage } from '../../../../lib/errors';
import { queryRows } from '../../../../lib/db/query';
import { loadScanResultRows } from '../../../../lib/aiVisibilityRead';
import { buildSnapshotsForScan, snapshotForDomain } from '../../../../lib/aiVisibilityMetrics';

const HISTORY_LIMIT = 24;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureAiVisibilityTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domain = ownership as unknown as { ID: number, domain: string };

   try {
      const scans = await queryRows<{ id: number, finished_at: string | null }>(
         `SELECT s.id, s.finished_at FROM ai_vis_scans s
          JOIN ai_vis_configs c ON c.id = s.config_id
          WHERE c.domain_id = ? AND s.status = 'completed'
          ORDER BY s.id DESC LIMIT ${HISTORY_LIMIT}`,
         [domain.ID],
      );
      // Deliberate N+1 (one snapshot build per scan), bounded by HISTORY_LIMIT (24).
      // Fine at this cap; if history ever needs hundreds of points, replace with a
      // single grouped aggregation query. Not worth the complexity now.
      const wanted = typeof req.query.competitor === 'string' ? req.query.competitor.toLowerCase().replace(/^www\./, '') : '';
      const ownKey = domain.domain.toLowerCase().replace(/^www\./, '');
      const out = [] as Array<{ scanId: number, finishedAt: string | null, series: { you: unknown, competitor?: unknown } }>;
      for (const s of scans) {
         const rows = await loadScanResultRows(s.id);
         const byDomain = buildSnapshotsForScan(rows, domain.domain);
         const series: { you: unknown, competitor?: unknown } = { you: byDomain.get(ownKey)?.overview ?? null };
         // Always emit a competitor point per scan (0-visibility when uncited that scan)
         // so the trend line is continuous instead of collapsing to a single point.
         if (wanted) series.competitor = (byDomain.get(wanted) ?? snapshotForDomain(rows, wanted)).overview;
         out.push({ scanId: s.id, finishedAt: s.finished_at, series });
      }
      return res.status(200).json({ scans: out });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
   }
}
