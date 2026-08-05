/**
 * Free trial policy: Growth only, once per organization.
 * Scale / Agency are always pay-upfront (monthly or yearly).
 */
import type { OrgBillingState } from './orgBilling';

export const TRIAL_PLAN_SLUG = 'growth' as const;
export const TRIAL_PERIOD_DAYS = 7;

export type CheckoutMode = 'trial' | 'upfront';

export function isTrialPlan(planSlug: string | null | undefined): boolean {
  return (planSlug ?? '').trim().toLowerCase() === TRIAL_PLAN_SLUG;
}

export function hasConsumedTrial(
  billing: Pick<OrgBillingState, 'trialConsumedAt'> | null | undefined,
): boolean {
  return Boolean(billing?.trialConsumedAt);
}

/** True when this org may still start a Growth trial. */
export function isTrialEligible(
  billing: Pick<OrgBillingState, 'trialConsumedAt'> | null | undefined,
): boolean {
  return !hasConsumedTrial(billing);
}

/**
 * Resolve checkout mode: non-Growth → always upfront;
 * Growth → trial unless explicitly upfront or trial already consumed.
 */
export function resolveCheckoutMode(
  planSlug: string,
  requested: CheckoutMode | undefined,
  billing: Pick<OrgBillingState, 'trialConsumedAt'> | null | undefined,
): CheckoutMode {
  if (!isTrialPlan(planSlug)) return 'upfront';
  if (requested === 'upfront') return 'upfront';
  if (!isTrialEligible(billing)) return 'upfront';
  return 'trial';
}

export type TrialGateResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** Server guard for mode=trial create / activate paths. */
export function assertTrialAllowed(
  planSlug: string,
  billing: Pick<OrgBillingState, 'trialConsumedAt'> | null | undefined,
): TrialGateResult {
  if (!isTrialPlan(planSlug)) {
    return {
      ok: false,
      status: 400,
      error: 'Free trial is only available on the Growth plan',
    };
  }
  if (!isTrialEligible(billing)) {
    return {
      ok: false,
      status: 409,
      error: 'This organization has already used its free trial',
    };
  }
  return { ok: true };
}
