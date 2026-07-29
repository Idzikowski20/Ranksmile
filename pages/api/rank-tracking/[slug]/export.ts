import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../lib/errors';
import { resolveRankTrackingApi } from '../../../../lib/rankTracking/apiAuth';
import { exportRankRows } from '../../../../lib/rankTracking/exporter';
import { getConfig, getResults } from '../../../../lib/rankTracking/service';
import type { ComparePeriod, ExportFormat } from '../../../../lib/types/rankTracking';
import { devicesList } from '../../../../lib/types/rankTracking';
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

  const format = (req.query.format === 'json' ? 'json' : 'csv') as ExportFormat;
  const comparePeriod = (typeof req.query.comparePeriod === 'string' ? req.query.comparePeriod : '7d') as ComparePeriod;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  try {
    const { rows } = await getResults(ctx.domainId, configId, {
      comparePeriod,
      search,
      pageSize: 10000,
    });
    const config = await getConfig(configId, ctx.domainId);
    const devices = config ? devicesList(config.devices) : ['desktop' as const];
    const body = exportRankRows(rows, format, devices);
    const contentType = format === 'json' ? 'application/json' : 'text/csv';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="rank-tracking-${configId}.${format}"`);
    return res.status(200).send(body);
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(handler);
