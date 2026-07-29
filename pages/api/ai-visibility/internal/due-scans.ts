// POST /api/ai-visibility/internal/due-scans — machine-to-machine, called by the
// sidecar scheduler. Finds configs due for a 14-day refresh (oldest first, capped),
// enqueues a scan for each, and returns the scanIds for the sidecar to drive.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { findDueConfigIds, enqueueAiVisScan } from '../../../../lib/aiVisibilityScan';
import { queryRows } from '../../../../lib/db/query';
import { getErrorMessage } from '../../../../lib/errors';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

export const config = { maxDuration: 60 };

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const token = req.headers['x-internal-token'];
   if (!process.env.INTERNAL_PIPELINE_TOKEN || token !== process.env.INTERNAL_PIPELINE_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
   }
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }

   try {
      await db.sync();
      await ensureAiVisibilityTables();

      let due: Array<{ configId: number; scanId: number }> = [];
      const selectAndEnqueue = async () => {
         const configIds = await findDueConfigIds();
         for (const configId of configIds) {
            // Per-item guard: one failing enqueue must not abort the batch and
            // strand the configs already enqueued this tick.
            try { await enqueueAiVisScan(configId); }
            catch (e) { console.warn(`[ai-vis due-scans] enqueue failed for config ${configId}:`, getErrorMessage(e)); }
         }
         // Return ALL currently-queued scans (this tick's PLUS any orphaned by an
         // earlier partial failure). findDueConfigIds excludes configs that already
         // have a queued scan, and the stale-reclaim only frees `running` scans — so
         // an un-driven `queued` scan would otherwise never run. run_scan_loop /
         // runScanChunk are idempotent, so re-driving a queued scan is safe.
         const queued = await queryRows<{ id: number; config_id: number }>(
            "SELECT id, config_id FROM ai_vis_scans WHERE status = 'queued' ORDER BY id ASC",
         );
         due = queued.map((q) => ({ configId: q.config_id, scanId: q.id }));
      };

      // Cross-instance safety: if the sidecar is ever scaled to >1 instance, two
      // ticks could both see config X as due and both enqueue (→ two scans, double
      // cost). A Postgres transaction-scoped advisory lock serializes the whole
      // find+enqueue: a second caller blocks on pg_advisory_xact_lock until the
      // first transaction ends. The lock outlives the enqueue calls (they run
      // inside the awaited callback), so serialization holds even though enqueue
      // itself isn't transactional. SQLite dev is single-process → no lock needed.
      const isPg = !!process.env.DATABASE_URL;
      if (isPg) {
         await db.transaction(async (tx) => {
            await db.query('SELECT pg_advisory_xact_lock(918273001)', { transaction: tx });
            await selectAndEnqueue();
         });
      } else {
         await selectAndEnqueue();
      }

      return res.status(200).json({ due });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
   }
}

export default withOrgPaymentAccess(handler);
