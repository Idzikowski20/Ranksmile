import type Stripe from 'stripe';
import { BillingSource, newBillingCorrelationId } from '@/src/infrastructure/billing/billingAudit';
import { ensureBillingTables } from '@/src/infrastructure/persistence/schema/ensureBillingTables';
import { getStripe, isStripeConfigured } from '@/src/infrastructure/billing/stripe';
import { orgIdFromMetadata, syncSubscriptionToOrg } from '@/src/infrastructure/billing/stripeBillingSync';
import {
  getOrgBillingState,
  getOrgIdByStripeCustomerId,
  hasNonTerminalStripeSubscription,
  updateOrgBillingState,
  type OrgBillingState,
  type SubscriptionStatus,
} from '@/src/infrastructure/billing/orgBilling';
import { queryOne, queryRows } from '@/src/infrastructure/db/query';

/** Stripe renews a few minutes after the period boundary; don't hit it for that gap. */
const STALE_PERIOD_GRACE_MS = 60 * 60_000;
const STALE_REFRESH_THROTTLE_MS = 5 * 60_000;
// ponytail: per-process throttle, move to Redis if many app instances hammer Stripe.
const lastStaleRefreshAt = new Map<number, number>();
const staleRefreshInFlight = new Map<number, Promise<OrgBillingState | null>>();

/**
 * The row still grants access but its paid window is over — the renewal (or failure)
 * webhook never landed. Without this the row says `active` forever: renewals only
 * advance `current_period_end` through Stripe events.
 */
function isEntitlementProjectionStale(billing: OrgBillingState, now: number): boolean {
  const status = billing.subscriptionStatus;
  if (status !== 'active' && status !== 'trialing' && status !== 'past_due' && status !== 'unpaid') {
    return false;
  }
  const endIso = status === 'trialing'
    ? (billing.trialEndsAt ?? billing.currentPeriodEnd)
    : billing.currentPeriodEnd;
  if (!endIso) return false;
  const end = new Date(endIso).getTime();
  return !Number.isNaN(end) && end + STALE_PERIOD_GRACE_MS <= now;
}

function isMissingSubscriptionError(msg: string): boolean {
  return /No such subscription|resource_missing/i.test(msg);
}

/**
 * getOrgBillingState for access decisions: re-syncs from Stripe when the projection is
 * stale, so a lost webhook neither keeps an unpaid org entitled nor locks out a paid one.
 * Stripe unreachable → the stored row is returned unchanged (hourly reconcile retries).
 */
export async function getOrgBillingStateFresh(orgId: number): Promise<OrgBillingState | null> {
  const billing = await getOrgBillingState(orgId);
  const now = Date.now();
  if (!billing?.stripeSubscriptionId || !isEntitlementProjectionStale(billing, now) || !isStripeConfigured()) {
    return billing;
  }
  // Concurrent callers share one refresh: returning the stale row meanwhile would still
  // project it as entitled.
  const inFlight = staleRefreshInFlight.get(orgId);
  if (inFlight) return inFlight;
  if (now - (lastStaleRefreshAt.get(orgId) ?? 0) < STALE_REFRESH_THROTTLE_MS) return billing;

  const refresh = refreshStaleOrgBilling(orgId, billing, billing.stripeSubscriptionId).finally(() => {
    staleRefreshInFlight.delete(orgId);
    lastStaleRefreshAt.set(orgId, Date.now());
  });
  staleRefreshInFlight.set(orgId, refresh);
  return refresh;
}

async function refreshStaleOrgBilling(
  orgId: number,
  billing: OrgBillingState,
  subscriptionId: string,
): Promise<OrgBillingState | null> {
  const audit = {
    source: BillingSource.RECONCILE,
    reason: 'reconcile.stale_on_access',
    correlationId: newBillingCorrelationId(),
    stripeSubscriptionId: subscriptionId,
  };
  try {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    await syncSubscriptionToOrg(orgId, sub, undefined, audit);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isMissingSubscriptionError(msg)) {
      console.warn('[stripe-reconcile] stale refresh failed, keeping stored row', orgId, msg);
      return billing;
    }
    await updateOrgBillingState(orgId, {
      subscriptionStatus: 'canceled',
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
    }, { ...audit, reason: 'reconcile.missing_subscription' });
  }
  return getOrgBillingState(orgId);
}

export type BillingReconcileResult = {
  scannedDb: number;
  synced: number;
  orphansRecovered: number;
  staleCleared: number;
  errors: number;
};

async function isOwnSubscription(
  orgId: number,
  orgCustomerId: string | null,
  subCustomerId: string,
  subUserId: string | undefined,
): Promise<boolean> {
  if (orgCustomerId) return orgCustomerId === subCustomerId;
  if (!subUserId) return false;
  const member = await queryOne<{ one: number }>(
    "SELECT 1 AS one FROM organization_members WHERE org_id = ? AND user_id = ? AND status = 'active' LIMIT 1",
    [orgId, subUserId],
  );
  return Boolean(member);
}

/**
 * Stripe ↔ DB projection repair (A/B/C). Does not wipe quota usage.
 */
export async function reconcileStripeBilling(opts?: {
  orphanLimit?: number;
}): Promise<BillingReconcileResult> {
  const result: BillingReconcileResult = {
    scannedDb: 0,
    synced: 0,
    orphansRecovered: 0,
    staleCleared: 0,
    errors: 0,
  };
  if (!isStripeConfigured()) return result;

  await ensureBillingTables();
  const stripe = getStripe();
  const orphanLimit = opts?.orphanLimit ?? 50;

  // Case A + C: orgs with a tracked subscription id
  const orgs = await queryRows<{
    id: number;
    stripe_subscription_id: string;
  }>(
    `SELECT id, stripe_subscription_id FROM organizations
      WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id <> ''`,
  );
  result.scannedDb = orgs.length;

  for (const org of orgs) {
    try {
      const corr = newBillingCorrelationId();
      const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      await syncSubscriptionToOrg(org.id, sub, undefined, {
        source: BillingSource.RECONCILE,
        reason: 'reconcile.tracked_subscription',
        correlationId: corr,
      });
      result.synced += 1;
      if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
        // Keep projection; entitlement helper handles access. Optionally clear current id when deleted-like
        if (sub.status === 'canceled' && !sub.cancel_at_period_end) {
          await updateOrgBillingState(org.id, {
            subscriptionStatus: 'canceled',
            stripeSubscriptionId: null,
            cancelAtPeriodEnd: false,
          }, {
            source: BillingSource.RECONCILE,
            reason: 'reconcile.clear_canceled',
            correlationId: corr,
            stripeSubscriptionId: sub.id,
          });
          result.staleCleared += 1;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isMissingSubscriptionError(msg)) {
        await updateOrgBillingState(org.id, {
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: null,
          cancelAtPeriodEnd: false,
        }, {
          source: BillingSource.RECONCILE,
          reason: 'reconcile.missing_subscription',
          correlationId: newBillingCorrelationId(),
        });
        result.staleCleared += 1;
      } else {
        result.errors += 1;
        console.warn('[stripe-reconcile] org', org.id, err);
      }
    }
  }

  // Case B: recent Stripe incompletes/actives missing from DB (orphan after persist fail)
  try {
    const listed = await stripe.subscriptions.list({
      status: 'incomplete',
      limit: orphanLimit,
      expand: ['data.customer'],
    });
    const activeListed = await stripe.subscriptions.list({
      status: 'active',
      limit: orphanLimit,
    });
    const trialingListed = await stripe.subscriptions.list({
      status: 'trialing',
      limit: orphanLimit,
    });
    const candidates = [...listed.data, ...activeListed.data, ...trialingListed.data];

    for (const sub of candidates) {
      const subCustomer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || '';
      // The customer mapping is exact; metadata.org_id is only a fallback for an org whose
      // customer id was never stored.
      const orgId = (subCustomer ? await getOrgIdByStripeCustomerId(subCustomer) : null)
        ?? orgIdFromMetadata(sub.metadata);
      if (!orgId) continue;

      const org = await queryOne<{
        stripe_subscription_id: string | null;
        stripe_customer_id: string | null;
        subscription_status: SubscriptionStatus | null;
      }>(
        'SELECT stripe_subscription_id, stripe_customer_id, subscription_status FROM organizations WHERE id = ? LIMIT 1',
        [orgId],
      );
      if (!org || org.stripe_subscription_id === sub.id) continue;
      // Only fill a gap — Case A already keeps a tracked, live subscription in sync.
      if (hasNonTerminalStripeSubscription({
        stripeSubscriptionId: org.stripe_subscription_id,
        subscriptionStatus: org.subscription_status,
      })) continue;
      // metadata.org_id is a local row id: environments sharing one Stripe account reuse
      // it, so it only counts when the subscription is provably this org's.
      if (!(await isOwnSubscription(orgId, org.stripe_customer_id, subCustomer, sub.metadata?.user_id))) continue;

      await syncSubscriptionToOrg(orgId, sub as Stripe.Subscription, undefined, {
        source: BillingSource.RECONCILE,
        reason: 'reconcile.orphan_recover',
        correlationId: newBillingCorrelationId(),
      });
      result.orphansRecovered += 1;
    }
  } catch (err) {
    result.errors += 1;
    console.warn('[stripe-reconcile] orphan scan', err);
  }

  return result;
}
