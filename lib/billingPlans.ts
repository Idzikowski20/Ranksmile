export type BillingPeriod = 'monthly' | 'yearly';

export interface CheckoutPlan {
  slug: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
}

export const CHECKOUT_PLANS: CheckoutPlan[] = [
  {
    slug: 'starter',
    name: 'Starter',
    priceMonthly: 29,
    priceYearly: 24,
    features: [
      'Create and Optimize 10 Documents',
      'Track 15 AI Prompts, refreshed weekly',
      'Keyword Research - 50 / month',
      '1 Brand Space',
    ],
  },
  {
    slug: 'growth',
    name: 'Growth',
    priceMonthly: 59,
    priceYearly: 49,
    features: [
      'Create and Optimize 30 Documents',
      'Track 50 AI Prompts, refreshed daily',
      'AI Visibility across 4 engines',
      '5 Brand Spaces',
    ],
  },
  {
    slug: 'scale',
    name: 'Scale',
    priceMonthly: 119,
    priceYearly: 99,
    features: [
      'Create and Optimize 100 Documents',
      'Track 100 AI Prompts, refreshed daily',
      'Advanced SERP Analysis',
      'API Access',
    ],
  },
  {
    slug: 'agency',
    name: 'Agency',
    priceMonthly: 249,
    priceYearly: 207,
    features: [
      'Unlimited* Documents',
      'Track 250 AI Prompts, refreshed daily',
      'Unlimited* Brand Spaces',
      'Dedicated Success Manager',
    ],
  },
];

const normalizePlan = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, '-');

export const getCheckoutPlan = (slugOrName: string): CheckoutPlan | undefined => {
  const normalized = normalizePlan(slugOrName);
  return CHECKOUT_PLANS.find((plan) => plan.slug === normalized || normalizePlan(plan.name) === normalized);
};

export const getPlanCheckoutHref = (slugOrName: string, billing: BillingPeriod): string => {
  const plan = getCheckoutPlan(slugOrName);
  const slug = plan?.slug ?? normalizePlan(slugOrName);
  return `/billing/checkout/${slug}?billing=${billing}`;
};

export const getPlanPeriodPrice = (plan: CheckoutPlan, billing: BillingPeriod): number => (
  billing === 'yearly' ? plan.priceYearly * 12 : plan.priceMonthly
);

export const getPlanMonthlyPrice = (plan: CheckoutPlan, billing: BillingPeriod): number => (
  billing === 'yearly' ? plan.priceYearly : plan.priceMonthly
);

export const formatEuro = (amount: number): string => `€${amount.toLocaleString('en-US')}`;

export const getTrialEndDateLabel = (from: Date = new Date()): string => {
  const date = new Date(from);
  date.setDate(date.getDate() + 7);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
