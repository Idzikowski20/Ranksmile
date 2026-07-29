import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../../lib/errors';
import { resolveRankTrackingApi } from '../../../../../lib/rankTracking/apiAuth';
import { archiveConfig, getConfig, updateConfig } from '../../../../../lib/rankTracking/service';
import type { RankDevices, ScheduleInterval } from '../../../../../lib/types/rankTracking';
import { withOrgPaymentAccess } from '../../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveRankTrackingApi(req, res);
  if (!ctx) return;

  const configId = Number(req.query.id);
  if (!Number.isFinite(configId)) return res.status(400).json({ error: 'Invalid config id' });

  if (req.method === 'GET') {
    const config = await getConfig(configId, ctx.domainId);
    if (!config) return res.status(404).json({ error: 'Config not found' });
    return res.status(200).json({ config });
  }

  if (req.method === 'PATCH') {
    const body = (req.body || {}) as Record<string, unknown>;
    if (body.archive === true) {
      try {
        await archiveConfig(configId, ctx.domainId);
        return res.status(200).json({ ok: true });
      } catch (e) {
        return res.status(500).json({ error: getErrorMessage(e) });
      }
    }
    try {
      await updateConfig(configId, ctx.domainId, {
        label: typeof body.label === 'string' ? body.label : undefined,
        devices: typeof body.devices === 'string' ? body.devices as RankDevices : undefined,
        serp_depth: typeof body.serpDepth === 'number' ? body.serpDepth : undefined,
        schedule_interval: typeof body.scheduleInterval === 'string' ? body.scheduleInterval as ScheduleInterval : undefined,
        schedule_every_n_days: typeof body.scheduleEveryNDays === 'number' ? body.scheduleEveryNDays : undefined,
        is_active: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        location_name: typeof body.locationName === 'string' ? body.locationName : undefined,
      });
      const config = await getConfig(configId, ctx.domainId);
      return res.status(200).json({ config });
    } catch (e) {
      return res.status(500).json({ error: getErrorMessage(e) });
    }
  }

  if (req.method === 'POST' && req.query.action === 'archive') {
    try {
      await archiveConfig(configId, ctx.domainId);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: getErrorMessage(e) });
    }
  }

  res.setHeader('Allow', 'GET, PATCH, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default withOrgPaymentAccess(handler);
