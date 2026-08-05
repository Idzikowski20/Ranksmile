import type { NextApiRequest, NextApiResponse } from 'next';
import { billingError } from '../../../../../lib/billing/billingErrors';
import {
  appendBillingDomainEvent,
} from '../../../../../lib/billing/domainEvents';
import { deletePaymentMethod } from '../../../../../lib/billing/paymentMethodService';
import { assertCanManage } from '../../../../../lib/members';
import { getOrgBillingState } from '../../../../../lib/orgBilling';
import { withOrgPaymentAccess } from '../../../../../lib/requireOrgPaymentAccess';
import { getStripe, isStripeConfigured } from '../../../../../lib/stripe';
import { ensureUserTenancy } from '../../../../../lib/tenancy';
import { getCurrentUserId } from '../../../../../utils/getUser';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { orgId } = await ensureUserTenancy(userId);
  try {
    await assertCanManage(userId);
  } catch {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  const paymentMethodId = typeof req.query.id === 'string' ? req.query.id.trim() : '';
  if (!paymentMethodId) {
    return res.status(400).json(
      billingError('PAYMENT_METHOD_NOT_FOUND', 'NOT_FOUND', 'Payment method id is required'),
    );
  }

  if (!isStripeConfigured()) {
    return res.status(503).json(
      billingError('BILLING_NOT_CONFIGURED', 'NO_CUSTOMER', 'Billing is not configured'),
    );
  }

  const billing = await getOrgBillingState(orgId);
  if (!billing?.stripeCustomerId) {
    return res.status(409).json(
      billingError('BILLING_NOT_CONFIGURED', 'NO_CUSTOMER', 'No Stripe customer on this organization'),
    );
  }

  const stripe = getStripe();
  let subscriptionDefaultId: string | null = null;
  if (billing.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
      const ref = sub.default_payment_method;
      subscriptionDefaultId = typeof ref === 'string' ? ref : ref?.id ?? null;
    } catch {
      subscriptionDefaultId = null;
    }
  }

  const result = await deletePaymentMethod(stripe, {
    orgId,
    customerId: billing.stripeCustomerId,
    paymentMethodId,
    subscriptionStatus: billing.subscriptionStatus,
    subscriptionId: billing.stripeSubscriptionId,
    subscriptionDefaultPaymentMethodId: subscriptionDefaultId,
  });

  if (!result.ok) {
    return res.status(result.status).json(result.error);
  }

  await appendBillingDomainEvent({
    orgId,
    type: 'CARD_REMOVED',
    source: 'manual',
    payload: { paymentMethodId, newDefaultId: result.newDefaultId },
  });
  if (result.newDefaultId) {
    await appendBillingDomainEvent({
      orgId,
      type: 'DEFAULT_CHANGED',
      source: 'manual',
      payload: { paymentMethodId: result.newDefaultId, removedId: paymentMethodId },
    });
  }

  return res.status(200).json({ ok: true, newDefaultId: result.newDefaultId });
}

export default withOrgPaymentAccess(handler);
