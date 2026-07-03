import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { queryOne } from '../../../../lib/db/query';

type ScanRow = { status: string, progress_done: number, progress_total: number, cost_micros: number, finished_at: string | null };

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
   const domainId = (ownership as unknown as { ID: number }).ID;

   const scan = await queryOne<ScanRow>(
      `SELECT s.status, s.progress_done, s.progress_total, s.cost_micros, s.finished_at
       FROM ai_vis_scans s JOIN ai_vis_configs c ON c.id = s.config_id
       WHERE c.domain_id = ? ORDER BY s.id DESC LIMIT 1`,
      [domainId],
   );
   if (!scan) return res.status(200).json({ status: 'idle', progressDone: 0, progressTotal: 0, costUsd: 0, finishedAt: null });
   return res.status(200).json({
      status: scan.status,
      progressDone: scan.progress_done || 0,
      progressTotal: scan.progress_total || 0,
      costUsd: (scan.cost_micros || 0) / 1e6, // integer micros → USD at the boundary
      finishedAt: scan.finished_at,
   });
}
