// POST /api/ai-visibility/internal/read-sources — machine-to-machine, called by the
// sidecar tick. Fetches the pages the AI answers cited for the latest completed scan of
// each config that still has unread sources. One chunk per scan per call → drained over
// ticks, so a 250-source scan never blocks a request.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { ensureAiVisibilityTables } from '@/src/infrastructure/persistence/schema/ensureAiVisibilityTables';
import { findScansNeedingSources, runSourceChunk } from '@/src/infrastructure/aiVisibility/aiVisibilitySources';
import { getErrorMessage } from '@/src/core/shared/errors';
import { isInternalPipelineRequest } from '@/src/infrastructure/aiVisibility/internalPipelineAuth';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';

/** Leaves headroom under the sidecar's 120s call timeout for the surrounding queries. */
const REQUEST_BUDGET_MS = 90_000;

async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (!isInternalPipelineRequest(req)) return res.status(401).json({ error: 'unauthorized' });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   try {
      await db.sync();
      await ensureAiVisibilityTables();
      // Five scans x eight pages x a 15s fetch timeout is ten minutes of worst case, and
      // the sidecar gives this call 120s. Work to a deadline instead: whatever is not
      // reached stays pending and the next tick picks it up.
      const deadlineAt = Date.now() + REQUEST_BUDGET_MS;
      const scans = await findScansNeedingSources();
      const out: Array<{ scanId: number; done: number; remaining: number }> = [];
      for (const s of scans) {
         if (Date.now() >= deadlineAt) break;
         // Per-item guard: one unreachable host must not abort the batch.
         try {
            const r = await runSourceChunk(s.scanId, s.brandName, s.domain, undefined, deadlineAt);
            out.push({ scanId: s.scanId, ...r });
         } catch { /* per-item */ }
      }
      return res.status(200).json({ read: out });
   } catch (error) {
      // Logged, not returned: the message can carry database or config detail.
      console.error(`[ai-vis] ${req.url} failed:`, getErrorMessage(error));
      return res.status(500).json({ error: 'Internal server error' });
   }
}

export default withOrgPaymentAccess(handler);
