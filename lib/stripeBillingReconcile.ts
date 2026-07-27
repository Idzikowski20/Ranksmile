import type Stripe from 'stripe';
import db from '../database/database';
import { ensureBillingTables } from './ensureBillingTables';
import { getStripe, isStripeConfigured } from './stripe';
import { orgIdFromMetadata, syncSubscriptionToOrg } from './stripeBillingSync';
import { getOrgIdByStripeCustomerId, updateOrgBillingState } from './orgBilling';
import { queryRows } from './db/query';

export type BillingReconcileResult = {
  scannedDb: number;
  synced: number;
  orphansRecovered: number;
  staleCleared: number;
  errors: number;
};

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
      const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      await syncSubscriptionToOrg(org.id, sub);
      result.synced += 1;
      if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
        // Keep projection; entitlement helper handles access. Optionally clear current id when deleted-like
        if (sub.status === 'canceled' && !sub.cancel_at_period_end) {
          await updateOrgBillingState(org.id, {
            subscriptionStatus: 'canceled',
            stripeSubscriptionId: null,
            cancelAtPeriodEnd: false,
          });
          result.staleCleared += 1;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/No such subscription|resource_missing/i.test(msg)) {
        await updateOrgBillingState(org.id, {
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: null,
          cancelAtPeriodEnd: false,
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
      const orgId = orgIdFromMetadata(sub.metadata)
        ?? (await getOrgIdByStripeCustomerId(
          typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || '',
        ));
      if (!orgId) continue;

      const [rows] = await db.query(
        `SELECT stripe_subscription_id FROM organizations WHERE id = ? LIMIT 1`,
        { replacements: [orgId] },
      );
      const current = (rows as Array<{ stripe_subscription_id: string | null }>)[0]?.stripe_subscription_id;
      if (current === sub.id) continue;
      // Recover if DB has no sub, or different incomplete
      if (!current || current !== sub.id) {
        await syncSubscriptionToOrg(orgId, sub as Stripe.Subscription);
        result.orphansRecovered += 1;
      }
    }
  } catch (err) {
    result.errors += 1;
    console.warn('[stripe-reconcile] orphan scan', err);
  }

  return result;
}
