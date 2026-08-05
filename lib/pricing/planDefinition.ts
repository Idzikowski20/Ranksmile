/**
 * Single source of truth for pricing surfaces (cards, compare table, recommender, CTA).
 * UI never invents prices/limits/CTA labels — it reads this model.
 *
 * Starter is retired from sale; legacy orgs may still have plan_slug=starter in DB.
 */
import { getCheckoutPlan } from '../billingPlans';
import type { BillingPeriod } from '../billingPlans';

export type PlanSlug = 'growth' | 'scale' | 'agency';
/** DB / Stripe may still report Starter for existing subscriptions. */
export type KnownPlanSlug = PlanSlug | 'starter';

export const PLAN_HIERARCHY: readonly PlanSlug[] = ['growth', 'scale', 'agency'] as const;

export type CtaState = 'subscribe' | 'upgrade' | 'downgrade' | 'current' | 'contactSales';

export type BenefitState = 'included' | 'partial' | 'excluded';

export type CardBenefit = {
  label: string;
  state: BenefitState;
  /** Shown for partial (e.g. "30", "Unlimited*") — appended or replaces vague copy. */
  value?: string;
};

export type CompareCell =
  | { kind: 'check' }
  | { kind: 'text'; value: string }
  | { kind: 'dash' };

export type CompareSection = {
  id: string;
  title: string;
  rows: Array<{
    id: string;
    label: string;
    cells: Record<PlanSlug, CompareCell>;
  }>;
};

export type PlanDefinition = {
  slug: PlanSlug;
  name: string;
  rank: number;
  recommended?: boolean;
  priceMonthly: number;
  /** Per-month price when billed yearly. */
  priceYearly: number;
  yearlySavePct: number;
  desc: string;
  cardBenefits: CardBenefit[];
  footerHints?: string[];
};

function savePct(monthly: number, yearlyPerMonth: number): number {
  if (monthly <= 0) return 0;
  return Math.round((1 - yearlyPerMonth / monthly) * 100);
}

function def(
  slug: PlanSlug,
  partial: Omit<PlanDefinition, 'slug' | 'rank' | 'name' | 'priceMonthly' | 'priceYearly' | 'yearlySavePct'> & {
    name?: string;
  },
): PlanDefinition {
  const checkout = getCheckoutPlan(slug);
  const priceMonthly = checkout?.priceMonthly ?? 0;
  const priceYearly = checkout?.priceYearly ?? 0;
  return {
    slug,
    name: partial.name ?? checkout?.name ?? slug,
    rank: PLAN_HIERARCHY.indexOf(slug),
    priceMonthly,
    priceYearly,
    yearlySavePct: savePct(priceMonthly, priceYearly),
    recommended: partial.recommended,
    desc: partial.desc,
    cardBenefits: partial.cardBenefits,
    footerHints: partial.footerHints,
  };
}

export const PLAN_DEFINITIONS: Record<PlanSlug, PlanDefinition> = {
  growth: def('growth', {
    recommended: true,
    desc: 'Win the AI citation and close your content gaps — daily visibility tracking, coverage gaps, and competitor keyword research.',
    cardBenefits: [
      { label: 'Documents', state: 'partial', value: '30' },
      { label: 'AI Prompts (daily)', state: 'partial', value: '50' },
      { label: 'AI Visibility engines', state: 'partial', value: '4' },
      { label: 'Brand Spaces', state: 'partial', value: '5' },
      { label: 'Keyword Research / month', state: 'partial', value: '200' },
      { label: 'Competitor Keyword Gap', state: 'partial', value: '25 / mo' },
      { label: 'Content Ideas & Coverage Gap', state: 'included' },
      { label: 'API Access', state: 'excluded' },
    ],
    footerHints: ['7-day free trial', 'Cancel anytime', 'VAT excluded'],
  }),
  scale: def('scale', {
    desc: 'Scale optimization across brands with advanced SERP analysis, API access, and higher limits.',
    cardBenefits: [
      { label: 'Documents', state: 'partial', value: '100' },
      { label: 'AI Prompts (all 5 engines)', state: 'partial', value: '100' },
      { label: 'Brand Spaces', state: 'partial', value: '15' },
      { label: 'Keyword Research / month', state: 'partial', value: '500' },
      { label: 'Advanced SERP Analysis', state: 'included' },
      { label: 'API Access', state: 'included' },
      { label: 'White-label', state: 'excluded' },
    ],
    footerHints: ['Pay monthly or yearly', 'Cancel anytime', 'VAT excluded'],
  }),
  agency: def('agency', {
    desc: 'Run many brands and clients with uncapped optimization, white-label, and full API access.',
    cardBenefits: [
      { label: 'Documents', state: 'partial', value: 'Unlimited*' },
      { label: 'AI Prompts (daily)', state: 'partial', value: '250' },
      { label: 'Brand Spaces', state: 'partial', value: 'Unlimited*' },
      { label: 'Site Audit pages / crawl', state: 'partial', value: '1,000' },
      { label: 'Keyword Research / month', state: 'partial', value: '2,000' },
      { label: 'White-label & full API', state: 'included' },
      { label: 'Personalized Onboarding', state: 'included' },
      { label: 'Dedicated Success Manager', state: 'included' },
    ],
    footerHints: ['Pay monthly or yearly', 'Cancel anytime', 'VAT excluded'],
  }),
};

/** Paid cards shown in the main pricing grid. */
export const PRICING_GRID_SLUGS: readonly PlanSlug[] = ['growth', 'scale', 'agency'] as const;

export function getPlanDefinition(slug: PlanSlug): PlanDefinition {
  return PLAN_DEFINITIONS[slug];
}

export function isPlanSlug(value: string | null | undefined): value is PlanSlug {
  return value === 'growth' || value === 'scale' || value === 'agency';
}

export function isKnownPlanSlug(value: string | null | undefined): value is KnownPlanSlug {
  return value === 'starter' || isPlanSlug(value);
}

function rankOf(slug: KnownPlanSlug): number {
  if (slug === 'starter') return -1;
  return PLAN_HIERARCHY.indexOf(slug);
}

export function previousPlan(slug: PlanSlug): PlanSlug | null {
  const i = PLAN_HIERARCHY.indexOf(slug);
  return i > 0 ? PLAN_HIERARCHY[i - 1] : null;
}

export function nextPlan(slug: PlanSlug): PlanSlug | null {
  const i = PLAN_HIERARCHY.indexOf(slug);
  return i >= 0 && i < PLAN_HIERARCHY.length - 1 ? PLAN_HIERARCHY[i + 1] : null;
}

export function resolveCtaState(current: KnownPlanSlug | null, target: PlanSlug): CtaState {
  if (current == null) return 'subscribe';
  if (!isKnownPlanSlug(current)) return 'subscribe';
  if (current === target) return 'current';
  const cur = rankOf(current);
  const tgt = rankOf(target);
  if (tgt > cur) return 'upgrade';
  if (tgt < cur) return 'downgrade';
  return 'current';
}

export type CtaLabelOptions = {
  planSlug?: PlanSlug;
  /** Growth free trial still available for this org (default true when unknown). */
  trialEligible?: boolean;
};

export function ctaLabel(state: CtaState, planName: string, opts?: CtaLabelOptions): string {
  switch (state) {
    case 'subscribe':
      if (opts?.planSlug === 'growth' && opts.trialEligible !== false) {
        return 'Get 7 days free trial';
      }
      return `Start ${planName}`;
    case 'upgrade':
      return `Upgrade to ${planName}`;
    case 'downgrade':
      return `Downgrade to ${planName}`;
    case 'current':
      return 'Current plan';
    case 'contactSales':
      return 'Contact sales';
    default:
      return `Start ${planName}`;
  }
}

export function planDisplayPrice(plan: PlanDefinition, billing: BillingPeriod): number {
  return billing === 'yearly' ? plan.priceYearly : plan.priceMonthly;
}

/** Shared yearly-save message for billing switch (use Growth as reference). */
export function billingSavePercentLabel(): number {
  return PLAN_DEFINITIONS.growth.yearlySavePct;
}

export const COMPARE_SECTIONS: CompareSection[] = [
  {
    id: 'documents-ai',
    title: 'Documents & AI',
    rows: [
      {
        id: 'documents',
        label: 'Documents to create & optimize',
        cells: {
          growth: { kind: 'text', value: '30' },
          scale: { kind: 'text', value: '100' },
          agency: { kind: 'text', value: 'Unlimited*' },
        },
      },
      {
        id: 'ai-prompts',
        label: 'AI prompts tracked',
        cells: {
          growth: { kind: 'text', value: '50 / day' },
          scale: { kind: 'text', value: '100 / day' },
          agency: { kind: 'text', value: '250 / day' },
        },
      },
      {
        id: 'ai-engines',
        label: 'AI Visibility engines',
        cells: {
          growth: { kind: 'text', value: '4' },
          scale: { kind: 'text', value: '5' },
          agency: { kind: 'text', value: '5' },
        },
      },
      {
        id: 'ai-writing',
        label: 'Content Score & AI Writing',
        cells: {
          growth: { kind: 'check' },
          scale: { kind: 'check' },
          agency: { kind: 'check' },
        },
      },
    ],
  },
  {
    id: 'usage',
    title: 'Usage',
    rows: [
      {
        id: 'keyword-research',
        label: 'Keyword Research / month',
        cells: {
          growth: { kind: 'text', value: '200' },
          scale: { kind: 'text', value: '500' },
          agency: { kind: 'text', value: '2,000' },
        },
      },
      {
        id: 'competitor-gap',
        label: 'Competitor Keyword Gap / month',
        cells: {
          growth: { kind: 'text', value: '25' },
          scale: { kind: 'text', value: '60' },
          agency: { kind: 'text', value: '250' },
        },
      },
      {
        id: 'site-audit',
        label: 'Site Audit pages / crawl',
        cells: {
          growth: { kind: 'text', value: '100' },
          scale: { kind: 'text', value: '100' },
          agency: { kind: 'text', value: '1,000' },
        },
      },
    ],
  },
  {
    id: 'workspace',
    title: 'Workspace',
    rows: [
      {
        id: 'brand-spaces',
        label: 'Brand Spaces',
        cells: {
          growth: { kind: 'text', value: '5' },
          scale: { kind: 'text', value: '15' },
          agency: { kind: 'text', value: 'Unlimited*' },
        },
      },
      {
        id: 'templates',
        label: 'Templates & Custom Voices',
        cells: {
          growth: { kind: 'check' },
          scale: { kind: 'check' },
          agency: { kind: 'check' },
        },
      },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    rows: [
      {
        id: 'api',
        label: 'API Access',
        cells: {
          growth: { kind: 'dash' },
          scale: { kind: 'check' },
          agency: { kind: 'check' },
        },
      },
      {
        id: 'white-label',
        label: 'White-label',
        cells: {
          growth: { kind: 'dash' },
          scale: { kind: 'dash' },
          agency: { kind: 'check' },
        },
      },
      {
        id: 'serp',
        label: 'Advanced SERP Analysis',
        cells: {
          growth: { kind: 'dash' },
          scale: { kind: 'check' },
          agency: { kind: 'check' },
        },
      },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    rows: [
      {
        id: 'priority',
        label: 'Priority Support',
        cells: {
          growth: { kind: 'dash' },
          scale: { kind: 'check' },
          agency: { kind: 'check' },
        },
      },
      {
        id: 'onboarding',
        label: 'Personalized Onboarding',
        cells: {
          growth: { kind: 'dash' },
          scale: { kind: 'dash' },
          agency: { kind: 'check' },
        },
      },
      {
        id: 'success-manager',
        label: 'Dedicated Success Manager',
        cells: {
          growth: { kind: 'dash' },
          scale: { kind: 'dash' },
          agency: { kind: 'check' },
        },
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    rows: [
      {
        id: 'cancel',
        label: 'Cancel anytime',
        cells: {
          growth: { kind: 'check' },
          scale: { kind: 'check' },
          agency: { kind: 'check' },
        },
      },
      {
        id: 'yearly',
        label: 'Yearly billing discount',
        cells: {
          growth: { kind: 'text', value: `${PLAN_DEFINITIONS.growth.yearlySavePct}%` },
          scale: { kind: 'text', value: `${PLAN_DEFINITIONS.scale.yearlySavePct}%` },
          agency: { kind: 'text', value: `${PLAN_DEFINITIONS.agency.yearlySavePct}%` },
        },
      },
    ],
  },
];

/** Analytics contract — stub; wire to real telemetry later. */
export type PricingAnalyticsEvent =
  | { type: 'billing_toggle'; billing: BillingPeriod }
  | { type: 'compare_section_expand'; sectionId: string; open: boolean }
  | { type: 'cta_click'; slug: PlanSlug; ctaState: CtaState; billing: BillingPeriod }
  | { type: 'recommended_click'; slug: PlanSlug }
  | { type: 'compare_cta_click'; slug: PlanSlug; ctaState: CtaState; billing: BillingPeriod }
  | { type: 'plan_visible'; slug: PlanSlug };

export function trackPricingEvent(_event: PricingAnalyticsEvent): void {
  // ponytail: no-op until product analytics sink exists
}
