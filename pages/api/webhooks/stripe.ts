import type { NextApiRequest, NextApiResponse } from 'next';
import type Stripe from 'stripe';
import { getStripe, getStripeWebhookSecret } from '../../../lib/stripe';
import { readRawBody } from '../../../lib/readRawBody';
import {
  orgIdFromMetadata,
  syncCheckoutSessionToOrg,
  syncSubscriptionToOrg,
} from '../../../lib/stripeBillingSync';
import { getOrgIdByStripeCustomerId, updateOrgBillingState } from '../../../lib/orgBilling';
import { getCheckoutPlan } from '../../../lib/billingPlans';
import { getAppOrigin } from '../../../lib/appOrigin';
import { claimBillingEmailAndEnqueue } from '../../../lib/billingEmailClaim';
import { shouldSendAbandonedForSubscription } from '../../../lib/billingAbandoned';
import {
  EMAIL_JOB_TYPE_ABANDONED_CHECKOUT,
  EMAIL_JOB_TYPE_PAYMENT_FAILED,
} from '../../../lib/notifications/emailTypes';
import { ABANDONED_CHECKOUT_SUBJECT } from '../../../lib/emails/abandonedCheckoutEmail';
import { paymentFailedEmailSubject } from '../../../lib/emails/paymentFailedEmail';

export const config = {
  api: { bodyParser: false },
};

function customerIdOf(customer: string | { id?: string } | null | undefined): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  return customer.id ?? null;
}

async function resolveOrgId(
  stripe: Stripe,
  metadata: Stripe.Metadata | null | undefined,
  customer: string | { id?: string } | null | undefined,
): Promise<number | null> {
  const fromMeta = orgIdFromMetadata(metadata);
  if (fromMeta) return fromMeta;
  const customerId = customerIdOf(customer);
  if (!customerId) return null;
  return getOrgIdByStripeCustomerId(customerId);
}

async function resolveCustomerEmail(
  stripe: Stripe,
  email: string | null | undefined,
  customer: string | { id?: string } | null | undefined,
): Promise<string | null> {
  if (email) return email;
  const customerId = customerIdOf(customer);
  if (!customerId) return null;
  const c = await stripe.customers.retrieve(customerId);
  if (!('deleted' in c && c.deleted) && 'email' in c && c.email) return c.email;
  return null;
}

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

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid webhook signature';
    return res.status(400).json({ error: message });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = await resolveOrgId(stripe, session.metadata, session.customer)
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
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = await resolveOrgId(stripe, subscription.metadata, subscription.customer);
        if (orgId) await syncSubscriptionToOrg(orgId, subscription);

        if (subscription.status === 'incomplete_expired' && orgId) {
          const fresh = await stripe.subscriptions.retrieve(subscription.id);
          if (await shouldSendAbandonedForSubscription(stripe, fresh)) {
            const to = await resolveCustomerEmail(stripe, null, fresh.customer);
            if (to) {
              const origin = getAppOrigin();
              await claimBillingEmailAndEnqueue({
                orgId,
                eventType: EMAIL_JOB_TYPE_ABANDONED_CHECKOUT,
                stripeObjectId: fresh.id,
                toEmail: to,
                payload: {
                  subject: ABANDONED_CHECKOUT_SUBJECT,
                  checkoutUrl: `${origin}/billing/checkout/starter?billing=monthly&mode=trial`,
                },
              });
            }
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const fresh = await stripe.subscriptions.retrieve(subscription.id).catch(() => subscription);
        const orgId = await resolveOrgId(stripe, fresh.metadata, fresh.customer);
        if (orgId) {
          await syncSubscriptionToOrg(orgId, fresh);
          // Deleted → no paid access; clear current sub id when this was the tracked one
          await updateOrgBillingState(orgId, {
            subscriptionStatus: 'canceled',
            stripeSubscriptionId: null,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: fresh.ended_at ? new Date(fresh.ended_at * 1000) : null,
          });
        }
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id?: string } | null;
        };
        const subRef = invoice.subscription;
        const subId = typeof subRef === 'string' ? subRef : subRef?.id;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          const orgId = await resolveOrgId(stripe, subscription.metadata, subscription.customer);
          if (orgId) await syncSubscriptionToOrg(orgId, subscription);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & {
          id: string;
          subscription?: string | { id?: string } | null;
          customer_email?: string | null;
        };
        const subRef = invoice.subscription;
        const subId = typeof subRef === 'string' ? subRef : subRef?.id;
        let orgId: number | null = null;
        let planName = 'subscription';
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          orgId = await resolveOrgId(stripe, subscription.metadata, subscription.customer);
          if (orgId) await syncSubscriptionToOrg(orgId, subscription);
          const slug = subscription.metadata?.plan_slug;
          if (slug) {
            const plan = getCheckoutPlan(slug);
            planName = plan?.name ?? slug;
          }
        }
        if (!orgId) break;

        const to = await resolveCustomerEmail(stripe, invoice.customer_email, invoice.customer);
        if (!to) break;

        const origin = getAppOrigin();
        let updateUrl = `${origin}/settings/billing_subscription`;
        const customerId = customerIdOf(invoice.customer);
        if (customerId) {
          try {
            const portal = await stripe.billingPortal.sessions.create({
              customer: customerId,
              return_url: updateUrl,
            });
            if (portal.url) updateUrl = portal.url;
          } catch (err) {
            console.warn('[stripe webhook] billing portal for payment_failed', err);
          }
        }

        await claimBillingEmailAndEnqueue({
          orgId,
          eventType: EMAIL_JOB_TYPE_PAYMENT_FAILED,
          stripeObjectId: invoice.id,
          toEmail: to,
          payload: {
            subject: paymentFailedEmailSubject(planName),
            planName,
            updateUrl,
          },
        });
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = await resolveOrgId(stripe, session.metadata, session.customer)
          ?? (session.client_reference_id ? Number(session.client_reference_id) : null);
        if (!orgId) break;
        const to = await resolveCustomerEmail(
          stripe,
          session.customer_email || session.customer_details?.email,
          session.customer,
        );
        if (!to) break;
        const origin = getAppOrigin();
        await claimBillingEmailAndEnqueue({
          orgId,
          eventType: EMAIL_JOB_TYPE_ABANDONED_CHECKOUT,
          stripeObjectId: session.id,
          toEmail: to,
          payload: {
            subject: ABANDONED_CHECKOUT_SUBJECT,
            checkoutUrl: `${origin}/billing/checkout/starter?billing=monthly&mode=trial`,
          },
        });
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
