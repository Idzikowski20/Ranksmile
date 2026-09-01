import type { NextApiRequest, NextApiResponse } from 'next';
import { listOrgBillingInvoices } from '../../../lib/billingInvoices';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUserId } from '../../../utils/getUser';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { orgId } = await ensureUserTenancy(userId);
  const invoices = await listOrgBillingInvoices(orgId);

  return res.status(200).json({ invoices });
}

export default withOrgPaymentAccess(handler);
