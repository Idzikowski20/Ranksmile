// GET /api/v1/wordpress/get_organization_credits — we don't meter credits; report unlimited.
import type { NextApiRequest, NextApiResponse } from 'next';
import { authPluginRequest } from '../../../../lib/wpConnection';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });
   return res.status(200).json({
      total_credits: 999999,
      used_credits: 0,
      available_credits: 999999,
      subscription: { active: true, plan: 'unlimited' },
   });
}

export default withOrgPaymentAccess(handler);
