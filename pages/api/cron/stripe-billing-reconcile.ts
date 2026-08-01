import type { NextApiRequest, NextApiResponse } from 'next';
import { reconcileStripeBilling } from '../../../lib/stripeBillingReconcile';
import { getErrorMessage } from '../../../lib/errors';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { withCronWatchdog } from '../../../lib/cronWatchdog';

export const config = { maxDuration: 60 };

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const result = await reconcileStripeBilling();
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(withCronWatchdog('stripe-billing-reconcile', handler));
