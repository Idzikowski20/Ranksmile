import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../lib/errors';
import { resolveRankTrackingApi } from '../../../../lib/rankTracking/apiAuth';
import { createConfigForDomain, getConfigsForDomain } from '../../../../lib/rankTracking/service';
import type { RankDevices, ScheduleInterval } from '../../../../lib/types/rankTracking';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveRankTrackingApi(req, res);
  if (!ctx) return;

  if (req.method === 'GET') {
    const configs = await getConfigsForDomain(ctx.domainId);
    return res.status(200).json({ configs });
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, unknown>;
    const locationCode = typeof body.locationCode === 'number' ? body.locationCode : Number(body.locationCode);
    const languageCode = typeof body.languageCode === 'string' ? body.languageCode.trim() : 'en';
    const devices = (typeof body.devices === 'string' ? body.devices : 'desktop') as RankDevices;
    if (!Number.isFinite(locationCode)) {
      return res.status(400).json({ error: 'locationCode is required' });
    }
    try {
      const id = await createConfigForDomain(ctx.domainId, {
        label: typeof body.label === 'string' ? body.label : undefined,
        locationCode,
        languageCode,
        devices,
        serpDepth: typeof body.serpDepth === 'number' ? body.serpDepth : undefined,
        scheduleInterval: (typeof body.scheduleInterval === 'string' ? body.scheduleInterval : 'weekly') as ScheduleInterval,
        scheduleEveryNDays: typeof body.scheduleEveryNDays === 'number' ? body.scheduleEveryNDays : null,
        locationName: typeof body.locationName === 'string' ? body.locationName : null,
      });
      return res.status(201).json({ id });
    } catch (e) {
      return res.status(500).json({ error: getErrorMessage(e) });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
