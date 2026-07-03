import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { getErrorMessage } from '../../../../lib/errors';
import { queryOne, queryRows } from '../../../../lib/db/query';
import { computeOverview, aggregateSources, aggregateCompetitors, ResultRow } from '../../../../lib/aiVisibilityMetrics';
import type { LlmCitation } from '../../../../lib/dataforseoLlm';

type DbResultRow = {
   prompt_id: number, model: string, own_cited: number, own_position: number | null,
   citations: string | null, topic: string, text: string,
};

const parseCitations = (raw: string | null): LlmCitation[] => {
   if (!raw) return [];
   try {
      const v = JSON.parse(raw);
      if (!Array.isArray(v)) return [];
      // Coerce every field to a string: a stored citation with a url but missing
      // title/domain must not yield `undefined` (aggregateSources → norm(domain) would throw).
      return v
         .filter((c): c is { url: string, domain?: unknown, title?: unknown } => !!c && typeof c.url === 'string')
         .map((c) => ({ url: c.url, domain: typeof c.domain === 'string' ? c.domain : '', title: typeof c.title === 'string' ? c.title : '' }));
   } catch { return []; }
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
          ORDER BY s.id DESC LIMIT 1`,
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
         citations: parseCitations(r.citations),
      }));

      if (view === 'overview') {
         const sources = aggregateSources(rows);
         return res.status(200).json({ scanId: scan.id, finishedAt: scan.finished_at, overview: computeOverview(rows), sourceCount: sources.length });
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
