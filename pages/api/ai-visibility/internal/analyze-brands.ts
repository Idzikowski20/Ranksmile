// POST /api/ai-visibility/internal/analyze-brands — machine-to-machine, called by the
// sidecar tick. Backfills brand extraction for the latest completed scan of each config
// that still has un-analysed answers. One chunk per config per call → drained over ticks.
import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureAiVisibilityTables } from '@/src/infrastructure/persistence/schema/ensureAiVisibilityTables';
import { findConfigsNeedingBrands, runBrandChunk } from '@/src/infrastructure/aiVisibility/aiVisibilityBrands';
import { getErrorMessage } from '@/src/core/shared/errors';
import { isInternalPipelineRequest } from '@/src/infrastructure/aiVisibility/internalPipelineAuth';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import db from '../../../../database/database';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (!isInternalPipelineRequest(req)) return res.status(401).json({ error: 'unauthorized' });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   try {
      await db.sync();
      await ensureAiVisibilityTables();
      const configs = await findConfigsNeedingBrands();
      const out: Array<{ scanId: number; done: number; remaining: number }> = [];
      for (const c of configs) {
         // Per-item guard: one failing config's extraction must not abort the batch.
         try { const r = await runBrandChunk(c.scanId, c.brandName); out.push({ scanId: c.scanId, ...r }); } catch { /* per-item */ }
      }
      return res.status(200).json({ analyzed: out });
   } catch (error) {
      // Logged, not returned: the message can carry database or config detail.
      console.error(`[ai-vis] ${req.url} failed:`, getErrorMessage(error));
      return res.status(500).json({ error: 'Internal server error' });
   }
}

export default withOrgPaymentAccess(handler);
