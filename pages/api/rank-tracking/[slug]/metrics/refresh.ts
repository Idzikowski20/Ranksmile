import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../../lib/errors';
import { resolveRankTrackingApi } from '../../../../../lib/rankTracking/apiAuth';
import { getConfig, listKeywords } from '../../../../../lib/rankTracking/service';
import { refreshMetricsForKeys } from '../../../../../lib/rankTracking/keywordMetricsCache';
import { withOrgPaymentAccess } from '../../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveRankTrackingApi(req, res);
  if (!ctx) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configId = Number((req.body as { configId?: unknown })?.configId);
  if (!Number.isFinite(configId)) return res.status(400).json({ error: 'configId is required' });

  const config = await getConfig(configId, ctx.domainId);
  if (!config) return res.status(404).json({ error: 'Config not found' });

  try {
    const keywords = await listKeywords(configId);
    const metrics = await refreshMetricsForKeys(
      keywords.map((k) => ({
        keyword: k.keyword,
        locationCode: config.location_code,
        languageCode: config.language_code,
      })),
    );
    return res.status(200).json({ refreshed: metrics.size });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(handler);
