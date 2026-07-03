// POST /api/ai-visibility/internal/run-chunk — machine-to-machine, driven by the
// python-sidecar's durable scan loop. Auth is the shared internal token ONLY (no
// user session): the sidecar isn't a logged-in user. Processes up to one chunk of
// pending (prompt × model) pairs and reports progress so the sidecar knows whether
// to loop again. Resolves ownDomain from the scan so the payload is just { scanId }.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { runScanChunk, AI_VIS_CHUNK_PAIRS } from '../../../../lib/aiVisibilityScan';
import { queryOne } from '../../../../lib/db/query';
import { getErrorMessage } from '../../../../lib/errors';

export const config = { maxDuration: 300 };

// Cap a caller-supplied chunk size so it can never blow the serverless timeout.
const AI_VIS_HARD_LIMIT = 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const token = req.headers['x-internal-token'];
   if (!process.env.INTERNAL_PIPELINE_TOKEN || token !== process.env.INTERNAL_PIPELINE_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
   }
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }

   const scanId = Number((req.body as { scanId?: unknown })?.scanId);
   if (!Number.isFinite(scanId) || scanId <= 0) return res.status(400).json({ error: 'scanId required' });
   const rawLimit = Number((req.body as { limit?: unknown })?.limit);
   const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, AI_VIS_HARD_LIMIT) : AI_VIS_CHUNK_PAIRS;

   try {
      await db.sync();
      await ensureAiVisibilityTables();

      // scan → config → domain name (own domain for citation-position scoring).
      const row = await queryOne<{ domain: string }>(
         `SELECT d.domain AS domain
            FROM ai_vis_scans s
            JOIN ai_vis_configs c ON c.id = s.config_id
            JOIN domain d ON d."ID" = c.domain_id
           WHERE s.id = ? LIMIT 1`,
         [scanId],
      );
      if (!row) return res.status(404).json({ error: 'scan not found' });

      const result = await runScanChunk(scanId, row.domain, limit);
      return res.status(200).json(result);
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
   }
}
