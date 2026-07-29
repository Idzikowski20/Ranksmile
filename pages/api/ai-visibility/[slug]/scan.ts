import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { enqueueAiVisScan, kickAiVisScan, seedScanFromLatest } from '../../../../lib/aiVisibilityScan';
import { queryOne } from '../../../../lib/db/query';
import { callSidecar } from '../../../../lib/sidecar';
import { getErrorMessage } from '../../../../lib/errors';
import { manualRefreshCooldownDays, refreshIntervalDays } from '../../../../lib/aiVisibility';
import { nextjsUrl } from '../../../../lib/serviceUrls';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

export const config = { maxDuration: 60 };

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureAiVisibilityTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domain = ownership as unknown as { ID: number, domain: string };

   const cfg = await queryOne<{ id: number, priority: string | null }>('SELECT id, priority FROM ai_vis_configs WHERE domain_id = ? LIMIT 1', [domain.ID]);
   if (!cfg) return res.status(400).json({ error: 'Complete the AI Visibility setup first' });

   // Manual-refresh cost guard: a full scan is ~$4. If the last completed scan is
   // recent and nothing is already running, require an explicit { force: true }.
   const active = await queryOne<{ id: number }>(
      "SELECT id FROM ai_vis_scans WHERE config_id = ? AND status IN ('queued','running') ORDER BY id DESC LIMIT 1",
      [cfg.id],
   );
   const force = (req.body as { force?: unknown } | undefined)?.force === true;
   // Incremental refresh (after editing prompts): only new prompts cost money, so
   // skip the manual-refresh cost cooldown and carry the prior scan's results forward.
   const incremental = (req.body as { incremental?: unknown } | undefined)?.incremental === true;
   if (!active && !force && !incremental) {
      const last = await queryOne<{ finished_at: string | null }>(
         "SELECT finished_at FROM ai_vis_scans WHERE config_id = ? AND status = 'completed' ORDER BY finished_at DESC LIMIT 1",
         [cfg.id],
      );
      if (last?.finished_at) {
         const days = (Date.now() - new Date(last.finished_at).getTime()) / 86_400_000;
         const cooldown = manualRefreshCooldownDays(cfg.priority);
         if (days < cooldown) {
            return res.status(409).json({ needsConfirm: true, lastScanDaysAgo: Math.floor(days) });
         }
      }
   }

   const scanId = await enqueueAiVisScan(cfg.id);

   // Carry unchanged results into this scan first, so the runner (sidecar or inline)
   // only calls the model for new/edited prompts. Idempotent + no-op on first scan.
   if (incremental) await seedScanFromLatest(scanId, cfg.id);

   // Durable path: hand the scan to the always-on python-sidecar, which loops
   // runScanChunk via /api/ai-visibility/internal/run-chunk until done — surviving
   // this function's return AND the serverless time limit. Fall back to an inline
   // run for local dev where the sidecar isn't up (a long-lived `next dev` process
   // keeps the async work alive; on Vercel an inline run would not survive).
   try {
      await callSidecar('/ai-visibility/run-scan', { scanId, nextjsUrl: nextjsUrl() }, 15000);
   } catch (e) {
      console.warn('[ai-vis scan] sidecar trigger failed, running inline:', getErrorMessage(e));
      void kickAiVisScan(scanId, domain.domain);
   }
   return res.status(202).json({ scanId });
}

export default withOrgPaymentAccess(handler);
