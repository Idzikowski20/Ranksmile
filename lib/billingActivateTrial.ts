import type Stripe from 'stripe';
import type { BillingPeriod } from './billingPlans';
import { getCheckoutPlan } from './billingPlans';
import {
  BillingSource,
  emitBillingEvent,
  ensureCorrelationId,
} from './billingAudit';
import {
  appendBillingDomainEvent,
  type BillingDomainEventSource,
} from './billing/domainEvents';
import { assertTrialAllowed, TRIAL_PERIOD_DAYS } from './billingTrial';
import { claimTrialActivation, getOrgBillingState, updateOrgBillingState } from './orgBilling';
import { getStripePriceId, type PlanSlug } from './stripePrices';
import { syncSubscriptionToOrg } from './stripeBillingSync';

export type ActivateTrialResult =
  | { ok: true; subscriptionId: string }
  | { ok: false; status: number; error: string };

function domainEventSource(source: BillingSource): BillingDomainEventSource {
  if (source === BillingSource.WEBHOOK_SETUP || source === BillingSource.WEBHOOK_SUB) {
    return 'webhook';
  }
  if (source === BillingSource.RECONCILE) return 'reconcile';
  if (source === BillingSource.CHECKOUT || source === BillingSource.ACTIVATE_TRIAL) {
    return 'checkout';
  }
  return 'manual';
}

/**
 * After SetupIntent succeeds — dual-default PM + trial subscription (no PaymentIntent €0).
 * Idempotent per checkout_attempt_id.
 */
export async function activateTrialFromSetupIntent(
  stripe: Stripe,
  args: {
    orgId: number;
    userId: string;
    setupIntent: Stripe.SetupIntent;
    /** WEBHOOK_SETUP vs ACTIVATE_TRIAL */
    source?: BillingSource;
  },
): Promise<ActivateTrialResult> {
  const { orgId, userId, setupIntent } = args;
  const source = args.source ?? BillingSource.ACTIVATE_TRIAL;
  const domainSource = domainEventSource(source);

  if (setupIntent.status !== 'succeeded') {
    await emitBillingEvent({
      kind: 'SETUP_INTENT_SUCCEEDED',
      source,
      reason: 'setup_intent_not_succeeded',
      decision: 'DENY',
      correlationId: ensureCorrelationId(setupIntent.metadata?.checkout_attempt_id || setupIntent.id),
      orgId,
      setupIntentId: setupIntent.id,
      actorUserId: userId,
      meta: { status: setupIntent.status },
    });
    return { ok: false, status: 409, error: 'Payment method is not confirmed yet' };
  }

  const meta = setupIntent.metadata ?? {};
  const correlationId = ensureCorrelationId(meta.checkout_attempt_id?.trim() || setupIntent.id);

  await emitBillingEvent({
    kind: 'SETUP_INTENT_SUCCEEDED',
    source,
    reason: 'setup_intent.succeeded',
    decision: 'ALLOW',
    correlationId,
    orgId,
    setupIntentId: setupIntent.id,
    actorUserId: userId,
  });

  if (meta.org_id && meta.org_id !== String(orgId)) {
    return { ok: false, status: 403, error: 'SetupIntent does not belong to this organization' };
  }
  if (meta.checkout_mode && meta.checkout_mode !== 'trial') {
    return { ok: false, status: 400, error: 'SetupIntent is not a trial checkout' };
  }

  const planSlug = (meta.plan_slug ?? '').trim().toLowerCase();
  const billing = meta.billing_period === 'yearly' ? 'yearly' : meta.billing_period === 'monthly' ? 'monthly' : null;
  if (!planSlug || !billing) {
    return { ok: false, status: 400, error: 'SetupIntent is missing plan metadata' };
  }

  const plan = getCheckoutPlan(planSlug);
  if (!plan) return { ok: false, status: 400, error: 'Unknown plan' };

  const attemptId = meta.checkout_attempt_id?.trim() || setupIntent.id;

  const billingState = await getOrgBillingState(orgId);
  const trialGate = assertTrialAllowed(plan.slug, billingState);
  if (!trialGate.ok) {
    await emitBillingEvent({
      kind: 'TRIAL_ACTIVATED',
      source,
      reason: trialGate.error,
      decision: 'DENY',
      correlationId,
      orgId,
      setupIntentId: setupIntent.id,
      actorUserId: userId,
      meta: { planSlug: plan.slug },
    });
    return { ok: false, status: trialGate.status, error: trialGate.error };
  }

  const priceId = getStripePriceId(plan.slug as PlanSlug, billing as BillingPeriod);
  if (!priceId) return { ok: false, status: 503, error: 'Stripe price is not configured for this plan' };

  const paymentMethodId = typeof setupIntent.payment_method === 'string'
    ? setupIntent.payment_method
    : setupIntent.payment_method?.id;
  if (!paymentMethodId) {
    await emitBillingEvent({
      kind: 'TRIAL_ACTIVATED',
      source,
      reason: 'missing_payment_method',
      decision: 'DENY',
      correlationId,
      orgId,
      setupIntentId: setupIntent.id,
      actorUserId: userId,
    });
    return { ok: false, status: 409, error: 'No payment method on SetupIntent' };
  }

  const customerId = typeof setupIntent.customer === 'string'
    ? setupIntent.customer
    : setupIntent.customer?.id;
  if (!customerId) {
    return { ok: false, status: 409, error: 'SetupIntent has no customer' };
  }

  if (!await claimTrialActivation(orgId, attemptId)) {
    return { ok: false, status: 409, error: 'This organization has already started a trial activation' };
  }

  // Dual default: customer invoice_settings + subscription.default_payment_method (no PI €0).
  await stripe.customers.update(
    customerId,
    { invoice_settings: { default_payment_method: paymentMethodId } },
    { idempotencyKey: `org-${orgId}-trial-customer-default-${attemptId}` },
  );

  await appendBillingDomainEvent({
    orgId,
    type: 'CARD_ADDED',
    source: domainSource,
    payload: { paymentMethodId, setupIntentId: setupIntent.id, correlationId },
  });
  await appendBillingDomainEvent({
    orgId,
    type: 'DEFAULT_CHANGED',
    source: domainSource,
    payload: { paymentMethodId, scope: 'customer', correlationId },
  });

  const subscription = await stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      trial_period_days: TRIAL_PERIOD_DAYS,
      trial_settings: {
        end_behavior: { missing_payment_method: 'cancel' },
      },
      payment_settings: { save_default_payment_method: 'on_subscription' },
      automatic_tax: { enabled: true },
      metadata: {
        org_id: String(orgId),
        user_id: userId,
        plan_slug: plan.slug,
        billing_period: billing,
        checkout_mode: 'trial',
        checkout_attempt_id: attemptId,
        setup_intent_id: setupIntent.id,
      },
    },
    { idempotencyKey: `org-${orgId}-trial-activate-${attemptId}` },
  );

  await appendBillingDomainEvent({
    orgId,
    type: 'SUBSCRIPTION_CREATED',
    source: domainSource,
    payload: {
      subscriptionId: subscription.id,
      planSlug: plan.slug,
      billingPeriod: billing,
      correlationId,
    },
  });
  await appendBillingDomainEvent({
    orgId,
    type: 'TRIAL_STARTED',
    source: domainSource,
    payload: {
      subscriptionId: subscription.id,
      paymentMethodId,
      trialPeriodDays: TRIAL_PERIOD_DAYS,
      correlationId,
    },
  });
  await appendBillingDomainEvent({
    orgId,
    type: 'DEFAULT_CHANGED',
    source: domainSource,
    payload: { paymentMethodId, scope: 'subscription', subscriptionId: subscription.id, correlationId },
  });

  await emitBillingEvent({
    kind: 'TRIAL_ACTIVATED',
    source,
    reason: 'subscriptions.create_trial',
    decision: 'ALLOW',
    correlationId,
    orgId,
    setupIntentId: setupIntent.id,
    stripeSubscriptionId: subscription.id,
    actorUserId: userId,
    newPlanSlug: plan.slug,
    newStatus: subscription.status,
  });

  // Consume trial entitlement before sync — survives cancel / webhook races.
  await updateOrgBillingState(orgId, {
    trialConsumedAt: new Date(),
  }, {
    source,
    reason: 'activateTrialFromSetupIntent_consume',
    correlationId,
    actorUserId: userId,
    setupIntentId: setupIntent.id,
    stripeSubscriptionId: subscription.id,
  });

  await syncSubscriptionToOrg(
    orgId,
    subscription,
    { slug: plan.slug as PlanSlug, billing: billing as BillingPeriod },
    {
      source,
      reason: 'activateTrialFromSetupIntent',
      correlationId,
      actorUserId: userId,
      setupIntentId: setupIntent.id,
    },
  );
  await updateOrgBillingState(orgId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
  }, {
    source,
    reason: 'activateTrialFromSetupIntent.customer_link',
    correlationId,
    actorUserId: userId,
    setupIntentId: setupIntent.id,
    stripeSubscriptionId: subscription.id,
  });

  return { ok: true, subscriptionId: subscription.id };
}

/** Cancel incomplete / cardless-trial leftovers so checkout can restart cleanly. */
export async function cancelDanglingCheckouts(
  stripe: Stripe,
  customerId: string,
  keepSubscriptionId?: string,
): Promise<void> {
  const open = await stripe.subscriptions.list({ customer: customerId, limit: 20 });
  for (const other of open.data) {
    if (keepSubscriptionId && other.id === keepSubscriptionId) continue;
    const dangling = other.status === 'incomplete'
      || (other.status === 'trialing' && !other.default_payment_method);
    if (!dangling) continue;
    await stripe.subscriptions.cancel(other.id).catch((err) => {
      console.warn('[billing] cancel dangling', other.id, err);
    });
  }
}
