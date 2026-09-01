import { createHash } from 'crypto';
import type Stripe from 'stripe';
import { listOrgBillingInvoices, type BillingInvoice } from '../billingInvoices';
import { getOrgBillingState, type SubscriptionStatus } from '../orgBilling';
import { getStripe, isStripeConfigured } from '../stripe';
import {
  listBillingDomainEvents,
  projectTimeline,
  type TimelineItem,
} from './domainEvents';
import { listPaymentMethods } from './paymentMethodService';
import type { PaymentMethodViewModel } from './paymentMethodViewModel';

export const BILLING_SNAPSHOT_SCHEMA_VERSION = 1;

export type BillingSnapshotCustomer = {
  id: string | null;
  email: string | null;
  defaultPaymentMethodId: string | null;
};

export type BillingSnapshotSubscription = {
  id: string | null;
  status: SubscriptionStatus | null;
  planSlug: string | null;
  billingPeriod: string | null;
  trialEndsAt: string | null;
  defaultPaymentMethodId: string | null;
};

export type BillingSnapshot = {
  schemaVersion: number;
  generatedAt: string;
  etag: string;
  payment_method_count: number;
  customer: BillingSnapshotCustomer;
  subscription: BillingSnapshotSubscription;
  paymentMethods: PaymentMethodViewModel[];
  invoices: BillingInvoice[];
  timeline: TimelineItem[];
};

function emptySnapshot(): BillingSnapshot {
  const generatedAt = new Date().toISOString();
  return {
    schemaVersion: BILLING_SNAPSHOT_SCHEMA_VERSION,
    generatedAt,
    etag: createHash('sha1').update(`empty:${generatedAt}`).digest('hex').slice(0, 16),
    payment_method_count: 0,
    customer: { id: null, email: null, defaultPaymentMethodId: null },
    subscription: {
      id: null,
      status: null,
      planSlug: null,
      billingPeriod: null,
      trialEndsAt: null,
      defaultPaymentMethodId: null,
    },
    paymentMethods: [],
    invoices: [],
    timeline: [],
  };
}

function pmRefId(ref: string | Stripe.PaymentMethod | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref.id;
}

export async function buildBillingSnapshot(orgId: number): Promise<BillingSnapshot> {
  const generatedAt = new Date().toISOString();
  const billing = await getOrgBillingState(orgId);
  const timelineEvents = await listBillingDomainEvents(orgId, 40);
  const timeline = projectTimeline(timelineEvents);

  if (!isStripeConfigured() || !billing?.stripeCustomerId) {
    const snap = emptySnapshot();
    snap.generatedAt = generatedAt;
    snap.timeline = timeline;
    if (billing) {
      snap.subscription = {
        id: billing.stripeSubscriptionId,
        status: billing.subscriptionStatus,
        planSlug: billing.planSlug,
        billingPeriod: billing.billingPeriod,
        trialEndsAt: billing.trialEndsAt,
        defaultPaymentMethodId: null,
      };
    }
    snap.etag = createHash('sha1')
      .update(JSON.stringify({ orgId, generatedAt, timeline: timeline.length }))
      .digest('hex')
      .slice(0, 16);
    return snap;
  }

  const stripe = getStripe();
  const customerId = billing.stripeCustomerId;

  let subscriptionDefaultId: string | null = null;
  if (billing.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
      subscriptionDefaultId = pmRefId(sub.default_payment_method);
    } catch {
      subscriptionDefaultId = null;
    }
  }

  const [pmList, invoices, customer] = await Promise.all([
    listPaymentMethods(stripe, {
      customerId,
      subscriptionStatus: billing.subscriptionStatus,
      subscriptionDefaultPaymentMethodId: subscriptionDefaultId,
    }),
    listOrgBillingInvoices(orgId, 20),
    stripe.customers.retrieve(customerId),
  ]);

  const email = !customer.deleted && typeof customer.email === 'string' ? customer.email : null;

  const snapshot: BillingSnapshot = {
    schemaVersion: BILLING_SNAPSHOT_SCHEMA_VERSION,
    generatedAt,
    etag: '',
    payment_method_count: pmList.paymentMethods.length,
    customer: {
      id: customerId,
      email,
      defaultPaymentMethodId: pmList.customerDefaultId,
    },
    subscription: {
      id: billing.stripeSubscriptionId,
      status: billing.subscriptionStatus,
      planSlug: billing.planSlug,
      billingPeriod: billing.billingPeriod,
      trialEndsAt: billing.trialEndsAt,
      defaultPaymentMethodId: subscriptionDefaultId,
    },
    paymentMethods: pmList.paymentMethods,
    invoices,
    timeline,
  };

  snapshot.etag = createHash('sha1')
    .update(JSON.stringify({
      orgId,
      pm: snapshot.payment_method_count,
      def: snapshot.customer.defaultPaymentMethodId,
      status: snapshot.subscription.status,
      inv: snapshot.invoices.length,
      tl: snapshot.timeline[0]?.at ?? null,
    }))
    .digest('hex')
    .slice(0, 16);

  return snapshot;
}
