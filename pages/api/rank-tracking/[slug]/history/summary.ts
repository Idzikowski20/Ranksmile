import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../../lib/errors';
import { resolveRankTrackingApi } from '../../../../../lib/rankTracking/apiAuth';
import { getConfig, listKeywords } from '../../../../../lib/rankTracking/service';
import { getHistorySummaryForConfig } from '../../../../../lib/rankTracking/snapshotQueries';
import { withOrgPaymentAccess } from '../../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveRankTrackingApi(req, res);
  if (!ctx) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configId = Number(req.query.configId);
  if (!Number.isFinite(configId)) return res.status(400).json({ error: 'configId is required' });

  const config = await getConfig(configId, ctx.domainId);
  if (!config) return res.status(404).json({ error: 'Config not found' });

  try {
    const keywords = await listKeywords(configId);
    const summaries = await getHistorySummaryForConfig(configId, keywords.map((k) => k.id));
    return res.status(200).json({ summaries });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(handler);
