// POST /api/ai-visibility/internal/analyze-brands — machine-to-machine, called by the
// sidecar tick. Backfills brand extraction for the latest completed scan of each config
// that still has un-analysed answers. One chunk per config per call → drained over ticks.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { findConfigsNeedingBrands, runBrandChunk } from '../../../../lib/aiVisibilityBrands';
import { getErrorMessage } from '../../../../lib/errors';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const token = req.headers['x-internal-token'];
   if (!process.env.INTERNAL_PIPELINE_TOKEN || token !== process.env.INTERNAL_PIPELINE_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
   }
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
      return res.status(500).json({ error: getErrorMessage(error) });
   }
}
