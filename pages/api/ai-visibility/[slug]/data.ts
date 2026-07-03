import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { getErrorMessage } from '../../../../lib/errors';
import { queryOne, queryRows } from '../../../../lib/db/query';
import { aggregateSources, aggregateCompetitors, buildSnapshot, computeDelta, ResultRow } from '../../../../lib/aiVisibilityMetrics';
import { parseCitations as parseCitationsShared, loadScanResultRows } from '../../../../lib/aiVisibilityRead';
import { AI_VIS_SETTINGS } from '../../../../lib/aiVisibility';

type DbResultRow = {
   prompt_id: number, model: string, own_cited: number, own_position: number | null,
   citations: string | null, topic: string, text: string,
};

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
   const view = String(req.query.view || 'overview');

   try {
      const scan = await queryOne<{ id: number, finished_at: string | null }>(
         `SELECT s.id, s.finished_at FROM ai_vis_scans s
          JOIN ai_vis_configs c ON c.id = s.config_id
          WHERE c.domain_id = ? AND s.status = 'completed'
          ORDER BY s.finished_at DESC LIMIT 1`,
         [domain.ID],
      );
      if (!scan) return res.status(200).json({ pending: true });

      if (view === 'fanout') return res.status(200).json({ queries: [] }); // Beta stub

      const dbRows = await queryRows<DbResultRow>(
         `SELECT r.prompt_id, r.model, r.own_cited, r.own_position, r.citations, p.topic, p.text
          FROM ai_vis_results r JOIN ai_vis_prompts p ON p.id = r.prompt_id
          WHERE r.scan_id = ? AND r.error IS NULL`,
         [scan.id],
      );
      const rows: ResultRow[] = dbRows.map((r) => ({
         promptId: r.prompt_id,
         model: r.model,
         ownCited: !!r.own_cited,
         ownPosition: r.own_position,
         citations: parseCitationsShared(r.citations),
      }));

      if (view === 'overview') {
         const current = buildSnapshot(rows);
         // "Previous" = the completed scan that finished before this one (chronology
         // by finished_at, NOT id — a retry may have a higher id but earlier finish).
         const prev = scan.finished_at ? await queryOne<{ id: number, finished_at: string | null }>(
            `SELECT s.id, s.finished_at FROM ai_vis_scans s
             JOIN ai_vis_configs c ON c.id = s.config_id
             WHERE c.domain_id = ? AND s.status = 'completed' AND s.finished_at < ?
             ORDER BY s.finished_at DESC LIMIT 1`,
            [domain.ID, scan.finished_at],
         ) : undefined;
         const delta = prev ? computeDelta(current, buildSnapshot(await loadScanResultRows(prev.id))) : null;

         // Next automatic refresh = last finish + cadence; days until (clamped ≥ 0).
         const nextRefreshAt = scan.finished_at
            ? new Date(new Date(scan.finished_at).getTime() + AI_VIS_SETTINGS.REFRESH_INTERVAL_DAYS * 86_400_000).toISOString()
            : null;
         const daysUntilRefresh = nextRefreshAt
            ? Math.max(0, Math.ceil((new Date(nextRefreshAt).getTime() - Date.now()) / 86_400_000))
            : null;

         return res.status(200).json({
            scanId: scan.id,
            finishedAt: scan.finished_at,
            overview: current.overview,
            sourceCount: current.sources.length,
            delta,
            previousScanAt: prev ? prev.finished_at : null,
            nextRefreshAt,
            daysUntilRefresh,
         });
      }
      if (view === 'sources') {
         return res.status(200).json({ sources: aggregateSources(rows) });
      }
      if (view === 'competitors') {
         return res.status(200).json({ competitors: aggregateCompetitors(rows, domain.domain) });
      }
      if (view === 'prompts') {
         const byPrompt = new Map<number, { id: number, topic: string, text: string, perModel: Array<{ model: string, cited: boolean, position: number | null }> }>();
         for (const r of dbRows) {
            const entry = byPrompt.get(r.prompt_id) ?? { id: r.prompt_id, topic: r.topic, text: r.text, perModel: [] };
            entry.perModel.push({ model: r.model, cited: !!r.own_cited, position: r.own_position });
            byPrompt.set(r.prompt_id, entry);
         }
         const prompts = Array.from(byPrompt.values()).map((p) => {
            const scores = p.perModel.map((m) => (m.cited && m.position ? Math.max(0, 100 - (m.position - 1) * 15) : 0));
            const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            return { ...p, score };
         }).sort((a, b) => b.score - a.score);
         return res.status(200).json({ prompts });
      }
      return res.status(400).json({ error: `Unknown view: ${view}` });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'Data fetch failed' });
   }
}
