import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { markInboxRead } from '../../../lib/notifications/inboxService';
import { getErrorMessage } from '../../../lib/errors';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

const MAX_EVENT_IDS = 100;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body as { eventIds?: unknown; all?: unknown };
  const all = body.all === true;
  const eventIds = Array.isArray(body.eventIds)
    ? body.eventIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : undefined;

  if (all && eventIds?.length) {
    return res.status(400).json({ error: 'Cannot combine all=true with eventIds' });
  }
  if (!all && (!eventIds || eventIds.length === 0)) {
    return res.status(400).json({ error: 'eventIds or all=true required' });
  }
  if (eventIds && eventIds.length > MAX_EVENT_IDS) {
    return res.status(400).json({ error: `eventIds max ${MAX_EVENT_IDS}` });
  }

  try {
    await markInboxRead(userId, { all: all || undefined, eventIds });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
  }
}

export default withOrgPaymentAccess(handler);
