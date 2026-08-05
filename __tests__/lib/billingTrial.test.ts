import {
  assertTrialAllowed,
  isTrialEligible,
  isTrialPlan,
  resolveCheckoutMode,
} from '../../lib/billingTrial';

describe('billingTrial policy', () => {
  it('allows trial only on Growth', () => {
    expect(isTrialPlan('growth')).toBe(true);
    expect(isTrialPlan('Growth')).toBe(true);
    expect(isTrialPlan('scale')).toBe(false);
    expect(isTrialPlan('agency')).toBe(false);
  });

  it('treats missing trialConsumedAt as eligible', () => {
    expect(isTrialEligible(null)).toBe(true);
    expect(isTrialEligible({ trialConsumedAt: null })).toBe(true);
    expect(isTrialEligible({ trialConsumedAt: '2026-01-01T00:00:00.000Z' })).toBe(false);
  });

  it('forces Scale/Agency to upfront', () => {
    expect(resolveCheckoutMode('scale', 'trial', null)).toBe('upfront');
    expect(resolveCheckoutMode('agency', undefined, null)).toBe('upfront');
  });

  it('keeps Growth trial when eligible', () => {
    expect(resolveCheckoutMode('growth', undefined, null)).toBe('trial');
    expect(resolveCheckoutMode('growth', 'trial', { trialConsumedAt: null })).toBe('trial');
  });

  it('forces Growth upfront when trial already consumed', () => {
    expect(resolveCheckoutMode('growth', 'trial', {
      trialConsumedAt: '2026-01-01T00:00:00.000Z',
    })).toBe('upfront');
  });

  it('still allows explicit Growth upfront purchase', () => {
    expect(resolveCheckoutMode('growth', 'upfront', null)).toBe('upfront');
  });

  it('gates trial activation by plan + consumption', () => {
    expect(assertTrialAllowed('scale', null)).toEqual({
      ok: false,
      status: 400,
      error: 'Free trial is only available on the Growth plan',
    });
    expect(assertTrialAllowed('growth', { trialConsumedAt: '2026-01-01T00:00:00.000Z' })).toEqual({
      ok: false,
      status: 409,
      error: 'This organization has already used its free trial',
    });
    expect(assertTrialAllowed('growth', null)).toEqual({ ok: true });
  });
});
