import type { BillingPeriod } from './billingPlans';
import db from '../database/database';
import { ensureBillingTables } from './ensureBillingTables';
import { queryOne } from './db/query';
import type { PlanSlug } from './stripePrices';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export interface OrgBillingState {
  orgId: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planSlug: PlanSlug | null;
  billingPeriod: BillingPeriod | null;
  subscriptionStatus: SubscriptionStatus | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

type OrgBillingRow = {
  id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_slug: string | null;
  billing_period: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

function mapRow(row: OrgBillingRow): OrgBillingState {
  const billingPeriod = row.billing_period === 'monthly' || row.billing_period === 'yearly'
    ? row.billing_period
    : null;
  const planSlug = row.plan_slug === 'starter'
    || row.plan_slug === 'growth'
    || row.plan_slug === 'scale'
    || row.plan_slug === 'agency'
    ? row.plan_slug
    : null;
  const subscriptionStatus = row.subscription_status as SubscriptionStatus | null;

  return {
    orgId: row.id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    planSlug,
    billingPeriod,
    subscriptionStatus,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
  };
}

export async function getOrgBillingState(orgId: number): Promise<OrgBillingState | null> {
  await ensureBillingTables();
  const row = await queryOne<OrgBillingRow>(
    `SELECT id, stripe_customer_id, stripe_subscription_id, plan_slug, billing_period,
            subscription_status, trial_ends_at, current_period_end
       FROM organizations WHERE id = ? LIMIT 1`,
    [orgId],
  );
  return row ? mapRow(row) : null;
}

export interface OrgBillingPatch {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  planSlug?: PlanSlug | null;
  billingPeriod?: BillingPeriod | null;
  subscriptionStatus?: SubscriptionStatus | null;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
}

export async function updateOrgBillingState(orgId: number, patch: OrgBillingPatch): Promise<void> {
  await ensureBillingTables();
  const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const replacements: unknown[] = [];

  if (patch.stripeCustomerId !== undefined) {
    sets.push('stripe_customer_id = ?');
    replacements.push(patch.stripeCustomerId);
  }
  if (patch.stripeSubscriptionId !== undefined) {
    sets.push('stripe_subscription_id = ?');
    replacements.push(patch.stripeSubscriptionId);
  }
  if (patch.planSlug !== undefined) {
    sets.push('plan_slug = ?');
    replacements.push(patch.planSlug);
  }
  if (patch.billingPeriod !== undefined) {
    sets.push('billing_period = ?');
    replacements.push(patch.billingPeriod);
  }
  if (patch.subscriptionStatus !== undefined) {
    sets.push('subscription_status = ?');
    replacements.push(patch.subscriptionStatus);
  }
  if (patch.trialEndsAt !== undefined) {
    sets.push('trial_ends_at = ?');
    replacements.push(patch.trialEndsAt ? patch.trialEndsAt.toISOString() : null);
  }
  if (patch.currentPeriodEnd !== undefined) {
    sets.push('current_period_end = ?');
    replacements.push(patch.currentPeriodEnd ? patch.currentPeriodEnd.toISOString() : null);
  }

  replacements.push(orgId);
  await db.query(`UPDATE organizations SET ${sets.join(', ')} WHERE id = ?`, { replacements });
}
