import type { BillingPeriod } from './billingPlans';

/** Sellable plan slugs (Starter removed). */
export type PlanSlug = 'growth' | 'scale' | 'agency';

/** Includes legacy Starter for DB / Stripe price reverse-lookup. */
export type LegacyPlanSlug = PlanSlug | 'starter';

const PRICE_ENV_KEYS: Record<LegacyPlanSlug, Record<BillingPeriod, string>> = {
  starter: {
    monthly: 'STRIPE_PRICE_STARTER_MONTHLY',
    yearly: 'STRIPE_PRICE_STARTER_YEARLY',
  },
  growth: {
    monthly: 'STRIPE_PRICE_GROWTH_MONTHLY',
    yearly: 'STRIPE_PRICE_GROWTH_YEARLY',
  },
  scale: {
    monthly: 'STRIPE_PRICE_SCALE_MONTHLY',
    yearly: 'STRIPE_PRICE_SCALE_YEARLY',
  },
  agency: {
    monthly: 'STRIPE_PRICE_AGENCY_MONTHLY',
    yearly: 'STRIPE_PRICE_AGENCY_YEARLY',
  },
};

export function getStripePriceId(slug: LegacyPlanSlug, billing: BillingPeriod): string | null {
  const envKey = PRICE_ENV_KEYS[slug]?.[billing];
  if (!envKey) return null;
  const value = process.env[envKey]?.trim();
  return value || null;
}

export function getPlanFromPriceId(priceId: string): { slug: LegacyPlanSlug; billing: BillingPeriod } | null {
  for (const slug of Object.keys(PRICE_ENV_KEYS) as LegacyPlanSlug[]) {
    for (const billing of ['monthly', 'yearly'] as const) {
      if (getStripePriceId(slug, billing) === priceId) {
        return { slug, billing };
      }
    }
  }
  return null;
}

export function isStripeCheckoutConfigured(slug: PlanSlug, billing: BillingPeriod): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && getStripePriceId(slug, billing));
}

export function isSellablePlanSlug(value: string | null | undefined): value is PlanSlug {
  return value === 'growth' || value === 'scale' || value === 'agency';
}
