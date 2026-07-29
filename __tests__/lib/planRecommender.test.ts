import {
  AI_PROMPT_SLIDER_STEPS,
  getPromptSliderStep,
  getYearlySavePercent,
  promptSliderValueAt,
} from '../../lib/pricing/planRecommender';
import { getCheckoutPlan } from '../../lib/billingPlans';

describe('planRecommender', () => {
  it('maps slider steps to the expected plans', () => {
    expect(getPromptSliderStep(50).planSlug).toBe('growth');
    expect(getPromptSliderStep(100).planSlug).toBe('scale');
    expect(getPromptSliderStep(200).planSlug).toBe('agency');
    expect(getPromptSliderStep('inf').planSlug).toBe('agency');
  });

  it('exposes four discrete steps including infinity', () => {
    expect(AI_PROMPT_SLIDER_STEPS.map((s) => s.value)).toEqual([50, 100, 200, 'inf']);
    expect(promptSliderValueAt(3)).toBe('inf');
    expect(promptSliderValueAt(99)).toBe('inf');
  });

  it('computes yearly save percent from checkout prices', () => {
    const growth = getCheckoutPlan('growth');
    expect(growth).toBeDefined();
    if (!growth) return;
    expect(getYearlySavePercent(growth)).toBe(
      Math.round((1 - growth.priceYearly / growth.priceMonthly) * 100),
    );
  });
});
