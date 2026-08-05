import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { activateTrialFromSetupIntent } from '../../../lib/billingActivateTrial';
import { BillingSource } from '../../../lib/billingAudit';
import { mintBillingConfirmationToken } from '../../../lib/billingConfirmationToken';
import { assertCanManage } from '../../../lib/members';
import { getStripe } from '../../../lib/stripe';
import { assertStripeModeOrThrow } from '../../../lib/stripeMode';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUser } from '../../../utils/getUser';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

const schema = z.object({
  setupIntentId: z.string().min(1),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    assertStripeModeOrThrow();
  } catch (e) {
    return res.status(503).json({ error: e instanceof Error ? e.message : 'Stripe mode misconfigured' });
  }

  const user = await getCurrentUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
  }

  const { orgId } = await ensureUserTenancy(user.id);
  try { await assertCanManage(user.id); } catch { return res.status(403).json({ error: 'FORBIDDEN' }); }

  const stripe = getStripe();
  const setupIntent = await stripe.setupIntents.retrieve(parsed.data.setupIntentId);
  const result = await activateTrialFromSetupIntent(stripe, {
    orgId,
    userId: user.id,
    setupIntent,
    source: BillingSource.ACTIVATE_TRIAL,
  });

  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  const meta = setupIntent.metadata ?? {};
  const planSlug = (meta.plan_slug ?? '').trim().toLowerCase() || 'growth';
  const billingPeriod = meta.billing_period === 'yearly' ? 'yearly' : 'monthly';

  let confirmationToken: string | null = null;
  try {
    confirmationToken = mintBillingConfirmationToken({
      orgId,
      subscriptionId: result.subscriptionId,
      planSlug,
      billingPeriod,
    });
  } catch (e) {
    console.warn('[billing] confirmation token mint failed:', e instanceof Error ? e.message : e);
  }

  return res.status(200).json({
    subscriptionId: result.subscriptionId,
    confirmationToken,
    planSlug,
    billing: billingPeriod,
  });
}

export default withOrgPaymentAccess(handler);
