import type { BillingPeriod } from './billingPlans';
import { CHECKOUT_PLANS } from './billingPlans';

export type PlanSlug = (typeof CHECKOUT_PLANS)[number]['slug'];

const PRICE_ENV_KEYS: Record<PlanSlug, Record<BillingPeriod, string>> = {
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

export function getStripePriceId(slug: PlanSlug, billing: BillingPeriod): string | null {
  const envKey = PRICE_ENV_KEYS[slug]?.[billing];
  if (!envKey) return null;
  const value = process.env[envKey]?.trim();
  return value || null;
}

export function getPlanFromPriceId(priceId: string): { slug: PlanSlug; billing: BillingPeriod } | null {
  for (const plan of CHECKOUT_PLANS) {
    for (const billing of ['monthly', 'yearly'] as const) {
      if (getStripePriceId(plan.slug as PlanSlug, billing) === priceId) {
        return { slug: plan.slug as PlanSlug, billing };
      }
    }
  }
  return null;
}

export function isStripeCheckoutConfigured(slug: PlanSlug, billing: BillingPeriod): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && getStripePriceId(slug, billing));
}
