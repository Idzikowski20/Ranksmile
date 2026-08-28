import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '@/src/core/shared/errors';
import { resolveRankTrackingApi } from '@/src/infrastructure/rankTracking/apiAuth';
import { processRunChunk } from '@/src/infrastructure/rankTracking/service';
import { withOrgPaymentAccess } from '@/src/infrastructure/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveRankTrackingApi(req, res, { requireRunner: true });
  if (!ctx) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configId = Number((req.body as { configId?: unknown })?.configId);
  if (!Number.isFinite(configId)) return res.status(400).json({ error: 'configId is required' });

  try {
    const result = await processRunChunk(ctx.domainId, configId);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(handler);
