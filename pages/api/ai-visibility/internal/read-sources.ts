// POST /api/ai-visibility/internal/read-sources — machine-to-machine, called by the
// sidecar tick. Fetches the pages the AI answers cited for the latest completed scan of
// each config that still has unread sources. One chunk per scan per call → drained over
// ticks, so a 250-source scan never blocks a request.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { ensureAiVisibilityTables } from '@/src/infrastructure/persistence/schema/ensureAiVisibilityTables';
import { findScansNeedingSources, runSourceChunk } from '@/src/infrastructure/aiVisibility/aiVisibilitySources';
import { getErrorMessage } from '@/src/core/shared/errors';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const token = req.headers['x-internal-token'];
   if (!process.env.INTERNAL_PIPELINE_TOKEN || token !== process.env.INTERNAL_PIPELINE_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
   }
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   try {
      await db.sync();
      await ensureAiVisibilityTables();
      const scans = await findScansNeedingSources();
      const out: Array<{ scanId: number; done: number; remaining: number }> = [];
      for (const s of scans) {
         // Per-item guard: one unreachable host must not abort the batch.
         try {
            const r = await runSourceChunk(s.scanId, s.brandName, s.domain);
            out.push({ scanId: s.scanId, ...r });
         } catch { /* per-item */ }
      }
      return res.status(200).json({ read: out });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
   }
}

export default withOrgPaymentAccess(handler);
