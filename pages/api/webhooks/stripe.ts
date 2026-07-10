import type { NextApiRequest, NextApiResponse } from 'next';
import { getStripe, getStripeWebhookSecret } from '../../../lib/stripe';
import { readRawBody } from '../../../lib/readRawBody';
import {
  orgIdFromMetadata,
  syncCheckoutSessionToOrg,
  syncSubscriptionToOrg,
} from '../../../lib/stripeBillingSync';
import { updateOrgBillingState } from '../../../lib/orgBilling';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET is not configured' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || Array.isArray(signature)) {
    return res.status(400).json({ error: 'Missing Stripe signature' });
  }

  const stripe = getStripe();
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid webhook signature';
    return res.status(400).json({ error: message });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orgId = orgIdFromMetadata(session.metadata)
          ?? (session.client_reference_id ? Number(session.client_reference_id) : null);
        if (orgId) {
          await syncCheckoutSessionToOrg(orgId, session);
          if (session.subscription && typeof session.subscription === 'string') {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            await syncSubscriptionToOrg(orgId, subscription);
          }
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object;
        const orgId = orgIdFromMetadata(subscription.metadata);
        if (orgId) await syncSubscriptionToOrg(orgId, subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const orgId = orgIdFromMetadata(subscription.metadata);
        if (orgId) {
          await updateOrgBillingState(orgId, {
            subscriptionStatus: 'canceled',
            stripeSubscriptionId: null,
            currentPeriodEnd: subscription.ended_at
              ? new Date(subscription.ended_at * 1000)
              : null,
          });
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as { subscription?: string | null };
        if (invoice.subscription && typeof invoice.subscription === 'string') {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          const orgId = orgIdFromMetadata(subscription.metadata);
          if (orgId) await syncSubscriptionToOrg(orgId, subscription);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('[stripe webhook]', event.type, err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  return res.status(200).json({ received: true });
}
