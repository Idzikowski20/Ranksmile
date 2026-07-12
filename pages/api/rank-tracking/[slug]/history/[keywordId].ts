import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../../lib/errors';
import { resolveRankTrackingApi } from '../../../../../lib/rankTracking/apiAuth';
import { getConfig } from '../../../../../lib/rankTracking/service';
import { getKeywordHistory } from '../../../../../lib/rankTracking/snapshotQueries';
import type { RankDevice } from '../../../../../lib/types/rankTracking';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveRankTrackingApi(req, res);
  if (!ctx) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keywordId = Number(req.query.keywordId);
  const configId = Number(req.query.configId);
  if (!Number.isFinite(keywordId)) return res.status(400).json({ error: 'keywordId is required' });
  if (!Number.isFinite(configId)) return res.status(400).json({ error: 'configId is required' });

  const config = await getConfig(configId, ctx.domainId);
  if (!config) return res.status(404).json({ error: 'Config not found' });

  const device = (req.query.device === 'mobile' ? 'mobile' : 'desktop') as RankDevice;
  const rawLimit = req.query.limit ? Number(req.query.limit) : 100;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(500, Math.floor(rawLimit)) : 100;

  try {
    const snapshots = await getKeywordHistory(configId, keywordId, device, limit);
    return res.status(200).json({ snapshots });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}
