// GET /api/ai-visibility/[slug]/history — completed scans newest-first with their
// visibility overview (own + optional competitor). One SQL batch for all scans.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { getErrorMessage } from '../../../../lib/errors';
import { queryRows } from '../../../../lib/db/query';
import { loadScanCitationRowsForScans } from '../../../../lib/aiVisibilityRead';
import { overviewForDomain } from '../../../../lib/aiVisibilityMetrics';

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
      const wanted = typeof req.query.competitor === 'string' ? req.query.competitor.toLowerCase().replace(/^www\./, '') : '';
      // Prompt filter (CSV of prompt ids) so the trend matches the overview's picker.
      const pids = typeof req.query.prompts === 'string' && req.query.prompts
         ? req.query.prompts.split(',').map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n)) : [];

      const byScan = await loadScanCitationRowsForScans(scans.map((s) => s.id));
      const out = scans.map((s) => {
         const allRows = byScan.get(s.id) ?? [];
         const rows = pids.length ? allRows.filter((r) => pids.includes(r.promptId)) : allRows;
         const series: { you: ReturnType<typeof overviewForDomain>; competitor?: ReturnType<typeof overviewForDomain> } = {
            you: overviewForDomain(rows, domain.domain),
         };
         // Always emit a competitor point per scan (0-visibility when uncited that scan)
         // so the trend line is continuous instead of collapsing to a single point.
         if (wanted) series.competitor = overviewForDomain(rows, wanted);
         return { scanId: s.id, finishedAt: s.finished_at, series };
      });
      return res.status(200).json({ scans: out });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
   }
}
