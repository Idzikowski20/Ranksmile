import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAuditTables } from '../../../../lib/ensureAuditTables';
import { queryOne } from '../../../../lib/db/query';

// POST /api/audit-tool/[slug]/rerun { id } — re-queue one audit so it recomputes (e.g.
// after the competitor selection changed). The client then kicks /run to process it.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureAuditTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as unknown as { ID: number }).ID;

   const id = Number((req.body as { id?: unknown } | undefined)?.id);
   if (!Number.isFinite(id)) return res.status(400).json({ error: 'A numeric audit id is required' });

   const row = await queryOne<{ id: number; status: string }>('SELECT id, status FROM audit_runs WHERE id = ? AND domain_id = ? LIMIT 1', [id, domainId]);
   if (!row) return res.status(404).json({ error: 'Audit not found' });

   // Only re-queue TERMINAL rows. Forcing a `running` row back to `queued` would let two
   // workers compute the same audit concurrently and keep whichever finishes last (a
   // stale result after a competitor change). A queued/running audit is already going
   // to compute, so this is a no-op for those.
   await db.query(
      `UPDATE audit_runs SET status = 'queued', result_json = NULL, content_score = NULL, error = NULL,
              progress_done = 0, progress_total = 1, started_at = NULL, finished_at = NULL
       WHERE id = ? AND domain_id = ? AND status IN ('completed', 'failed')`,
      { replacements: [id, domainId] },
   );
   return res.status(202).json({ ok: true, requeued: row.status === 'completed' || row.status === 'failed' });
}
