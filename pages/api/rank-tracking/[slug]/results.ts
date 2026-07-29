import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../lib/errors';
import { resolveRankTrackingApi } from '../../../../lib/rankTracking/apiAuth';
import { getResults } from '../../../../lib/rankTracking/service';
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
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const page = req.query.page ? Number(req.query.page) : undefined;
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : req.query.limit ? Number(req.query.limit) : undefined;
  const sort = typeof req.query.sort === 'string' ? req.query.sort as 'keyword' | 'position' | 'volume' | 'kd' | 'cpc' : undefined;
  const order = req.query.order === 'desc' ? 'desc' : 'asc';
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  try {
    const data = await getResults(ctx.domainId, configId, {
      comparePeriod,
      cursor,
      page,
      pageSize,
      sort,
      order,
      search,
    });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(handler);
