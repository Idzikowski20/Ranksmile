// POST /api/ai-visibility/internal/build-profiles — machine-to-machine, called by the
// sidecar tick. Aggregates the extracted brand mentions of the latest completed scan of
// each config into one profile row per brand (what Competitors reads). One chunk per scan
// per call → drained over ticks.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { ensureAiVisibilityTables } from '@/src/infrastructure/persistence/schema/ensureAiVisibilityTables';
import { findScansNeedingProfiles, runProfileChunk } from '@/src/infrastructure/aiVisibility/aiVisibilityProfiles';
import { getErrorMessage } from '@/src/core/shared/errors';
import { isInternalPipelineRequest } from '@/src/infrastructure/aiVisibility/internalPipelineAuth';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (!isInternalPipelineRequest(req)) return res.status(401).json({ error: 'unauthorized' });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   try {
      await db.sync();
      await ensureAiVisibilityTables();
      const scans = await findScansNeedingProfiles();
      const out: Array<{ scanId: number; done: number; remaining: number }> = [];
      for (const s of scans) {
         // Per-item guard: one bad aggregate must not abort the batch.
         try {
            const r = await runProfileChunk(s.scanId);
            out.push({ scanId: s.scanId, ...r });
         } catch { /* per-item */ }
      }
      return res.status(200).json({ built: out });
   } catch (error) {
      // Logged, not returned: the message can carry database or config detail.
      console.error(`[ai-vis] ${req.url} failed:`, getErrorMessage(error));
      return res.status(500).json({ error: 'Internal server error' });
   }
}

export default withOrgPaymentAccess(handler);
