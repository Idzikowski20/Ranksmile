import {
  type BillingPeriod,
  type CheckoutPlan,
  getCheckoutPlan,
  getPlanMonthlyPrice,
} from '../billingPlans';

/** Extensible axis id — v1 ships only AI prompts. */
export type RecommenderAxis = 'ai_prompts';

export type PromptSliderValue = 50 | 100 | 200 | 'inf';

export type RecommendedPlanSlug = 'growth' | 'scale' | 'agency';

export interface PromptSliderStep {
  value: PromptSliderValue;
  label: string;
  planSlug: RecommendedPlanSlug;
  hint: string;
}

export const AI_PROMPT_SLIDER_STEPS: readonly PromptSliderStep[] = [
  {
    value: 50,
    label: '50',
    planSlug: 'growth',
    hint: 'Daily tracking across 4 AI engines — enough to win your first citations.',
  },
  {
    value: 100,
    label: '100',
    planSlug: 'scale',
    hint: 'Higher prompt volume plus advanced SERP analysis and API access.',
  },
  {
    value: 200,
    label: '200',
    planSlug: 'agency',
    hint: 'Heavy prompt loads for multi-brand and client portfolios.',
  },
  {
    value: 'inf',
    label: '∞',
    planSlug: 'agency',
    hint: 'For agencies running many brands — Agency includes 250 prompts/day.',
  },
] as const;

export const DEFAULT_PROMPT_SLIDER_VALUE: PromptSliderValue = 50;

export function getPromptSliderStep(value: PromptSliderValue): PromptSliderStep {
  const step = AI_PROMPT_SLIDER_STEPS.find((s) => s.value === value);
  if (!step) {
    return AI_PROMPT_SLIDER_STEPS[0];
  }
  return step;
}

export function getRecommendedCheckoutPlan(planSlug: RecommendedPlanSlug): CheckoutPlan {
  const plan = getCheckoutPlan(planSlug);
  if (!plan) {
    throw new Error(`Missing checkout plan: ${planSlug}`);
  }
  return plan;
}

/** Yearly discount vs monthly list price, as whole percent (e.g. 17). */
export function getYearlySavePercent(plan: CheckoutPlan): number {
  if (plan.priceMonthly <= 0) return 0;
  return Math.round((1 - plan.priceYearly / plan.priceMonthly) * 100);
}

export function getRecommenderDisplayPrice(plan: CheckoutPlan, billing: BillingPeriod): number {
  return getPlanMonthlyPrice(plan, billing);
}

/** Highlight bullets for the recommender card (subset of checkout features). */
export function getRecommenderFeatureBullets(planSlug: RecommendedPlanSlug): string[] {
  const plan = getRecommendedCheckoutPlan(planSlug);
  return plan.features.slice(0, 4);
}

export function promptSliderIndex(value: PromptSliderValue): number {
  return AI_PROMPT_SLIDER_STEPS.findIndex((s) => s.value === value);
}

export function promptSliderValueAt(index: number): PromptSliderValue {
  const clamped = Math.max(0, Math.min(AI_PROMPT_SLIDER_STEPS.length - 1, index));
  return AI_PROMPT_SLIDER_STEPS[clamped].value;
}
