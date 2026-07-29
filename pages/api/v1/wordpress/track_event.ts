// POST /api/v1/wordpress/track_event — accept and ignore plugin analytics.
import type { NextApiRequest, NextApiResponse } from 'next';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

function handler(_req: NextApiRequest, res: NextApiResponse) {
   return res.status(200).json({ ok: true });
}

export default withOrgPaymentAccess(handler);
