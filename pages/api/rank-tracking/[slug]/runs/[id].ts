import type { NextApiRequest, NextApiResponse } from 'next';
import { queryOne } from '../../../../../lib/db/query';
import type { RankCheckRunRow } from '../../../../../lib/types/rankTracking';
import { resolveRankTrackingApi } from '../../../../../lib/rankTracking/apiAuth';
import { getConfig } from '../../../../../lib/rankTracking/service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveRankTrackingApi(req, res);
  if (!ctx) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const runId = Number(req.query.id);
  const configId = Number(req.query.configId);
  if (!Number.isFinite(runId) || !Number.isFinite(configId)) {
    return res.status(400).json({ error: 'id and configId are required' });
  }

  const config = await getConfig(configId, ctx.domainId);
  if (!config) return res.status(404).json({ error: 'Config not found' });

  const run = await queryOne<RankCheckRunRow>(
    'SELECT * FROM rank_check_runs WHERE id = ? AND config_id = ? LIMIT 1',
    [runId, configId],
  );
  if (!run) return res.status(404).json({ error: 'Run not found' });
  return res.status(200).json({ run });
}
