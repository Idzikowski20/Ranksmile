// GET /api/ai-visibility/[slug]/history — completed scans newest-first with their
// visibility overview (own + optional competitor). One SQL batch for all scans.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '@/src/infrastructure/persistence/schema/ensureAiVisibilityTables';
import { getErrorMessage } from '@/src/core/shared/errors';
import { queryOne, queryRows } from '@/src/infrastructure/db/query';
import { loadScanRowsForScans } from '@/src/infrastructure/aiVisibility/aiVisibilityRead';
import { computeBrandOverview, brandOverviewForDomain } from '@/src/core/domain/aiVisibility/metrics';
import type { BrandTriad } from '@/src/core/domain/aiVisibility/metrics';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';

const HISTORY_LIMIT = 24;

// The chart never reads the per-model breakdown, and 24 scans of it is payload for nothing.
const triad = (o: BrandTriad): BrandTriad => ({
   visibilityScore: o.visibilityScore, mentionRate: o.mentionRate, avgPosition: o.avgPosition,
});

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
   const domain = ownership as unknown as { ID: number, domain: string };

   try {
      const scans = await queryRows<{ id: number, finished_at: string | null, brand_name: string | null }>(
         `SELECT s.id, s.finished_at, s.brand_name FROM ai_vis_scans s
          JOIN ai_vis_configs c ON c.id = s.config_id
          WHERE c.domain_id = ? AND s.status = 'completed'
          ORDER BY s.id DESC LIMIT ${HISTORY_LIMIT}`,
         [domain.ID],
      );
      const cfg = await queryOne<{ brand_name: string }>(
         'SELECT c.brand_name FROM ai_vis_configs c WHERE c.domain_id = ? ORDER BY c.id DESC LIMIT 1', [domain.ID],
      );
      const ownBrand = cfg?.brand_name || domain.domain;
      const wanted = typeof req.query.competitor === 'string' ? req.query.competitor.toLowerCase().replace(/^www\./, '') : '';
      // Prompt filter (CSV of prompt ids) so the trend matches the overview's picker.
      const pids = typeof req.query.prompts === 'string' && req.query.prompts
         ? req.query.prompts.split(',').map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n)) : [];

      const byScan = await loadScanRowsForScans(scans.map((s) => s.id));
      const out = scans.map((s) => {
         const allRows = byScan.get(s.id) ?? [];
         const rows = pids.length ? allRows.filter((r) => pids.includes(r.promptId)) : allRows;
         // Both lines plot the BRAND metric — how often the answers name the brand and how
         // early — so the comparison is like-for-like. The picker is domain-keyed, so the
         // competitor's domain is resolved to its brand (brandOverviewForDomain).
         // A scan still in brand extraction has only part of its mentions; plotting that
         // partial number draws a dip that never happened, so the point is a gap until the
         // phase finishes. Each scan is scored with the brand it ran under.
         // allRows, not the filtered subset: a prompt filter can select only the rows that
         // happen to be extracted already and hide that the scan is still mid-phase.
         const extracting = allRows.some((r) => r.brandsAnalyzed === false);
         const series: { you: BrandTriad | null; competitor?: BrandTriad | null } = {
            you: extracting ? null : triad(computeBrandOverview(rows, s.brand_name || ownBrand)),
         };
         // Always emit a competitor point per scan (0-visibility when unnamed that scan)
         // so the trend line is continuous instead of collapsing to a single point.
         if (wanted) series.competitor = extracting ? null : brandOverviewForDomain(rows, wanted);
         return { scanId: s.id, finishedAt: s.finished_at, series };
      });
      return res.status(200).json({ scans: out });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
   }
}

export default withOrgPaymentAccess(handler);
