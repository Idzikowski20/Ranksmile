// POST /api/v1/wordpress/update_last_sync_date — acknowledge sync (no-op on our side).
import type { NextApiRequest, NextApiResponse } from 'next';
import { authPluginRequest } from '../../../../lib/wpConnection';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });
   return res.status(200).json({ ok: true });
}

export default withOrgPaymentAccess(handler);
