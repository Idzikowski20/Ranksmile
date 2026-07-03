import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { enqueueAiVisScan, kickAiVisScan } from '../../../../lib/aiVisibilityScan';
import { queryOne } from '../../../../lib/db/query';
import { callSidecar } from '../../../../lib/sidecar';
import { getErrorMessage } from '../../../../lib/errors';

export const config = { maxDuration: 60 };

const selfUrl = () => process.env.NEXTJS_URL || 'http://127.0.0.1:3000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

   const cfg = await queryOne<{ id: number }>('SELECT id FROM ai_vis_configs WHERE domain_id = ? LIMIT 1', [domain.ID]);
   if (!cfg) return res.status(400).json({ error: 'Complete the AI Visibility setup first' });

   const scanId = await enqueueAiVisScan(cfg.id);

   // Durable path: hand the scan to the always-on python-sidecar, which loops
   // runScanChunk via /api/ai-visibility/internal/run-chunk until done — surviving
   // this function's return AND the serverless time limit. Fall back to an inline
   // run for local dev where the sidecar isn't up (a long-lived `next dev` process
   // keeps the async work alive; on Vercel an inline run would not survive).
   try {
      await callSidecar('/ai-visibility/run-scan', { scanId, nextjsUrl: selfUrl() }, 15000);
   } catch (e) {
      console.warn('[ai-vis scan] sidecar trigger failed, running inline:', getErrorMessage(e));
      void kickAiVisScan(scanId, domain.domain);
   }
   return res.status(202).json({ scanId });
}
