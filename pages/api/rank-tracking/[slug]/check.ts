import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../lib/errors';
import { resolveRankTrackingApi } from '../../../../lib/rankTracking/apiAuth';
import { triggerManualCheck } from '../../../../lib/rankTracking/service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveRankTrackingApi(req, res, { requireRunner: true });
  if (!ctx) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configId = Number((req.body as { configId?: unknown })?.configId);
  if (!Number.isFinite(configId)) return res.status(400).json({ error: 'configId is required' });

  try {
    const result = await triggerManualCheck(ctx.domainId, configId);
    if (!result.ok) return res.status(409).json(result);
    return res.status(202).json(result);
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}
