import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { mintBillingConfirmationToken } from '../../../lib/billingConfirmationToken';
import { assertCanManage } from '../../../lib/members';
import { getOrgBillingState, hasNonTerminalStripeSubscription } from '../../../lib/orgBilling';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUserId } from '../../../utils/getUser';

const schema = z.object({
  planSlug: z.string().min(1),
  billing: z.enum(['monthly', 'yearly']),
  subscriptionId: z.string().min(1).optional(),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
  }

  const { orgId } = await ensureUserTenancy(userId);
  try {
    await assertCanManage(userId);
  } catch {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  const billing = await getOrgBillingState(orgId);
  if (!hasNonTerminalStripeSubscription(billing) || !billing?.stripeSubscriptionId) {
    return res.status(409).json({ error: 'No active subscription to confirm' });
  }

  if (
    parsed.data.subscriptionId
    && parsed.data.subscriptionId !== billing.stripeSubscriptionId
  ) {
    return res.status(403).json({ error: 'Subscription mismatch' });
  }

  try {
    const confirmationToken = mintBillingConfirmationToken({
      orgId,
      subscriptionId: billing.stripeSubscriptionId,
      planSlug: parsed.data.planSlug.trim().toLowerCase(),
      billingPeriod: parsed.data.billing,
    });
    return res.status(200).json({ confirmationToken });
  } catch (e) {
    return res.status(503).json({
      error: e instanceof Error ? e.message : 'Could not issue confirmation token',
    });
  }
}

export default withOrgPaymentAccess(handler);
