import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../lib/errors';
import { resolveRankTrackingApi } from '../../../../lib/rankTracking/apiAuth';
import { getAnalytics } from '../../../../lib/rankTracking/service';
import type { ComparePeriod } from '../../../../lib/types/rankTracking';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveRankTrackingApi(req, res);
  if (!ctx) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configId = Number(req.query.configId);
  if (!Number.isFinite(configId)) return res.status(400).json({ error: 'configId is required' });
  const comparePeriod = (typeof req.query.comparePeriod === 'string' ? req.query.comparePeriod : '7d') as ComparePeriod;

  try {
    const summary = await getAnalytics(ctx.domainId, configId, comparePeriod);
    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(handler);
