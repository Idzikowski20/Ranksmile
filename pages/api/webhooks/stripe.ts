import type { NextApiRequest, NextApiResponse } from 'next';
import type Stripe from 'stripe';
import { getStripe, getStripeWebhookSecret } from '../../../lib/stripe';
import { readRawBody } from '../../../lib/readRawBody';
import { claimStripeEvent, releaseStripeEvent } from '../../../lib/stripeWebhookEvents';
import {
  orgIdFromMetadata,
  syncCheckoutSessionToOrg,
  syncSubscriptionToOrg,
} from '../../../lib/stripeBillingSync';
import { getOrgBillingState, getOrgIdByStripeCustomerId, updateOrgBillingState } from '../../../lib/orgBilling';
import { BillingSource, ensureCorrelationId } from '../../../lib/billingAudit';
import db from '../../../database/database';
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

  // Stripe delivers at-least-once; duplicates must not re-run side effects.
  if (!(await claimStripeEvent(event))) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = await resolveOrgId(stripe, session.metadata, session.customer)
          ?? (session.client_reference_id ? Number(session.client_reference_id) : null);
        if (orgId) {
          const corr = ensureCorrelationId(
            session.metadata?.checkout_attempt_id || session.id,
          );
          await syncCheckoutSessionToOrg(orgId, session, {
            source: BillingSource.WEBHOOK_SUB,
            reason: 'checkout.session.completed',
            correlationId: corr,
            meta: { eventId: event.id },
          });
          if (session.subscription && typeof session.subscription === 'string') {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            await syncSubscriptionToOrg(orgId, subscription, undefined, {
              source: BillingSource.WEBHOOK_SUB,
              reason: 'checkout.session.completed',
              correlationId: corr,
              meta: { eventId: event.id },
            });
          }
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const eventSubscription = event.data.object as Stripe.Subscription;
        // Re-read: webhook delivery can be delayed/out of order, the event payload is a snapshot.
        const subscription = await stripe.subscriptions
          .retrieve(eventSubscription.id)
          .catch(() => eventSubscription);
        const orgId = await resolveOrgId(stripe, subscription.metadata, subscription.customer);
        if (orgId) {
          await syncSubscriptionToOrg(orgId, subscription, undefined, {
            source: BillingSource.WEBHOOK_SUB,
            reason: event.type,
            correlationId: ensureCorrelationId(
              subscription.metadata?.checkout_attempt_id || subscription.id,
            ),
            meta: { eventId: event.id },
          });
        }

        if (subscription.status === 'incomplete_expired' && orgId) {
          const fresh = subscription;
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
                  checkoutUrl: `${origin}/billing/checkout/growth?billing=monthly&mode=trial`,
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
          const corr = ensureCorrelationId(
            fresh.metadata?.checkout_attempt_id || fresh.id,
          );
          const billing = await getOrgBillingState(orgId);
          await syncSubscriptionToOrg(orgId, fresh, undefined, {
            source: BillingSource.WEBHOOK_SUB,
            reason: 'customer.subscription.deleted',
            correlationId: corr,
            meta: { eventId: event.id },
          });
          // Only clear tracked sub id when THIS subscription was the one on the org
          // (create-subscription cancels dangling trials — must not wipe a newer sub).
          const clearsTracked = !billing?.stripeSubscriptionId
            || billing.stripeSubscriptionId === fresh.id;
          await updateOrgBillingState(orgId, {
            subscriptionStatus: clearsTracked ? 'canceled' : billing?.subscriptionStatus ?? 'canceled',
            stripeSubscriptionId: clearsTracked ? null : billing?.stripeSubscriptionId,
            planSlug: clearsTracked ? null : undefined,
            billingPeriod: clearsTracked ? null : undefined,
            trialEndsAt: clearsTracked ? null : undefined,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: fresh.ended_at ? new Date(fresh.ended_at * 1000) : null,
          }, {
            source: BillingSource.WEBHOOK_SUB,
            reason: clearsTracked ? 'subscription.deleted.clear_tracked' : 'subscription.deleted.keep_newer',
            correlationId: corr,
            stripeSubscriptionId: fresh.id,
            meta: { eventId: event.id },
          });
        }
        break;
      }
      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        if (setupIntent.metadata?.checkout_mode !== 'trial') break;
        const orgId = await resolveOrgId(stripe, setupIntent.metadata, setupIntent.customer);
        const userId = setupIntent.metadata?.user_id;
        if (!orgId || !userId) break;
        const { activateTrialFromSetupIntent } = await import('../../../lib/billingActivateTrial');
        const result = await activateTrialFromSetupIntent(stripe, {
          orgId,
          userId,
          setupIntent,
          source: BillingSource.WEBHOOK_SETUP,
        });
        if (!result.ok) {
          console.warn('[stripe webhook] activate-trial', result.error);
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id?: string } | null;
        };
        const subRef = invoice.subscription;
        const subId = typeof subRef === 'string' ? subRef : subRef?.id;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          const orgId = await resolveOrgId(stripe, subscription.metadata, subscription.customer);
          if (orgId) {
            await syncSubscriptionToOrg(orgId, subscription, undefined, {
              source: BillingSource.WEBHOOK_SUB,
              reason: 'invoice.paid',
              correlationId: ensureCorrelationId(
                subscription.metadata?.checkout_attempt_id || subscription.id,
              ),
              meta: { eventId: event.id },
            });

            const customerId = customerIdOf(invoice.customer) ?? customerIdOf(subscription.customer);
            if (customerId) {
              const eventCreatedAtIso = new Date(event.created * 1000).toISOString();
              const eventId = event.id;

              await db.query(
                `UPDATE organizations
                   SET payment_failed_locked_at = NULL,
                       payment_failed_invoice_id = NULL,
                       payment_failed_subscription_id = NULL,
                       payment_failed_customer_id = NULL,
                       payment_lock_last_event_created_at = ?,
                       payment_lock_last_event_id = ?
                 WHERE id = ?
                   AND payment_failed_locked_at IS NOT NULL
                   AND payment_failed_subscription_id = ?
                   AND payment_failed_customer_id = ?
                   AND (
                     payment_lock_last_event_created_at IS NULL
                     OR payment_lock_last_event_created_at < ?
                     OR (
                       payment_lock_last_event_created_at = ?
                       AND (payment_lock_last_event_id IS NULL OR payment_lock_last_event_id <> ?)
                     )
                   )`,
                {
                  replacements: [
                    eventCreatedAtIso,
                    eventId,
                    orgId,
                    subscription.id,
                    customerId,
                    eventCreatedAtIso,
                    eventCreatedAtIso,
                    eventId,
                  ],
                },
              );
            }
          }
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id?: string } | null;
        };
        const subRef = invoice.subscription;
        const subId = typeof subRef === 'string' ? subRef : subRef?.id;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          const orgId = await resolveOrgId(stripe, subscription.metadata, subscription.customer);
          if (orgId) {
            await syncSubscriptionToOrg(orgId, subscription, undefined, {
              source: BillingSource.WEBHOOK_SUB,
              reason: 'invoice.payment_succeeded',
              correlationId: ensureCorrelationId(
                subscription.metadata?.checkout_attempt_id || subscription.id,
              ),
              meta: { eventId: event.id },
            });
          }
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
        let lockedSubscriptionId: string | null = null;
        let customerId: string | null = customerIdOf(invoice.customer);
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          lockedSubscriptionId = subscription.id;
          if (!customerId) customerId = customerIdOf(subscription.customer);
          orgId = await resolveOrgId(stripe, subscription.metadata, subscription.customer);
          if (orgId) {
            await syncSubscriptionToOrg(orgId, subscription, undefined, {
              source: BillingSource.WEBHOOK_SUB,
              reason: 'invoice.payment_failed',
              correlationId: ensureCorrelationId(
                subscription.metadata?.checkout_attempt_id || subscription.id,
              ),
              meta: { eventId: event.id },
            });
          }
          const slug = subscription.metadata?.plan_slug;
          if (slug) {
            const plan = getCheckoutPlan(slug);
            planName = plan?.name ?? slug;
          }
        }
        if (!orgId) break;

        // Lock first — email is best-effort and must not gate the projection.
        if (lockedSubscriptionId && customerId) {
          const paymentFailedLockedAtIso = invoice.created
            ? new Date(invoice.created * 1000).toISOString()
            : new Date(event.created * 1000).toISOString();
          const eventCreatedAtIso = new Date(event.created * 1000).toISOString();
          const eventId = event.id;

          await db.query(
            `UPDATE organizations
               SET payment_failed_locked_at = ?,
                   payment_failed_invoice_id = ?,
                   payment_failed_subscription_id = ?,
                   payment_failed_customer_id = ?,
                   payment_lock_last_event_created_at = ?,
                   payment_lock_last_event_id = ?
             WHERE id = ?
               AND (
                 payment_lock_last_event_created_at IS NULL
                 OR payment_lock_last_event_created_at < ?
                 OR (
                   payment_lock_last_event_created_at = ?
                   AND (payment_lock_last_event_id IS NULL OR payment_lock_last_event_id <> ?)
                 )
               )`,
            {
              replacements: [
                paymentFailedLockedAtIso,
                invoice.id,
                lockedSubscriptionId,
                customerId,
                eventCreatedAtIso,
                eventId,
                orgId,
                eventCreatedAtIso,
                eventCreatedAtIso,
                eventId,
              ],
            },
          );
        }

        const to = await resolveCustomerEmail(stripe, invoice.customer_email, invoice.customer ?? customerId);
        if (!to) break;

        const origin = getAppOrigin();
        let updateUrl = `${origin}/settings/billing_subscription`;
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
            checkoutUrl: `${origin}/billing/checkout/growth?billing=monthly&mode=trial`,
          },
        });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('[stripe webhook]', event.type, err);
    // Give the claim back — a 500 makes Stripe retry, and a kept claim would swallow it.
    await releaseStripeEvent(event.id).catch((e) => {
      console.error('[stripe webhook] release claim', event.id, e);
    });
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  return res.status(200).json({ received: true });
}
