import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveRankTrackingApi } from '../../../../../lib/rankTracking/apiAuth';
import { getActiveRun } from '../../../../../lib/rankTracking/repository';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveRankTrackingApi(req, res);
  if (!ctx) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configId = Number(req.query.configId);
  if (!Number.isFinite(configId)) return res.status(400).json({ error: 'configId is required' });

  const run = await getActiveRun(configId);
  return res.status(200).json({ run: run ?? null });
}
