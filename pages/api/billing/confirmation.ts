import type { NextApiRequest, NextApiResponse } from 'next';
import { getBillingConfirmation } from '../../../lib/billingConfirmation';
import { verifyBillingConfirmationToken } from '../../../lib/billingConfirmationToken';
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
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) {
    return res.status(403).json({
      error: 'Missing confirmation token',
      code: 'CONFIRMATION_TOKEN_REQUIRED',
    });
  }

  const payload = verifyBillingConfirmationToken(token, { orgId });
  if (!payload) {
    return res.status(403).json({
      error: 'Confirmation link expired or invalid',
      code: 'CONFIRMATION_TOKEN_INVALID',
    });
  }

  try {
    const confirmation = await getBillingConfirmation(orgId, {
      planSlug: payload.planSlug,
      subscriptionId: payload.subscriptionId,
    });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ confirmation });
  } catch (e) {
    if (e instanceof Error && e.message === 'SUBSCRIPTION_MISMATCH') {
      return res.status(403).json({
        error: 'Confirmation does not match current subscription',
        code: 'CONFIRMATION_TOKEN_INVALID',
      });
    }
    throw e;
  }
}

export default withOrgPaymentAccess(handler);
