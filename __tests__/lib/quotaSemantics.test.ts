import {
  ACTIVE_PERIOD_KEY,
  getMeterKind,
  getPlanMeterLimit,
  isQuotaMeter,
  METER_KIND,
} from '../../lib/planLimits';
import { calendarPeriodKey, periodKeyForMeter } from '../../lib/quota/period';
import { PlanLimitError, isPlanLimitError } from '../../lib/quota/errors';

describe('plan quota meter semantics', () => {
  it('classifies meters by kind', () => {
    expect(getMeterKind('documents')).toBe('active_resource');
    expect(getMeterKind('keywordResearch')).toBe('period_usage');
    expect(getMeterKind('siteAuditPages')).toBe('per_run_cap');
    expect(METER_KIND.brandSpaces).toBe('active_resource');
  });

  it('isQuotaMeter narrows keys', () => {
    expect(isQuotaMeter('documents')).toBe(true);
    expect(isQuotaMeter('nope')).toBe(false);
  });

  it('resolves limits from PLAN_LIMITS not balances', () => {
    expect(getPlanMeterLimit('growth', 'documents')).toBe(30);
    expect(getPlanMeterLimit('agency', 'documents')).toBeNull();
    expect(getPlanMeterLimit('starter', 'siteAuditPages')).toBe(100);
  });

  it('period_key is calendar month for KW and _ for active', () => {
    expect(periodKeyForMeter('documents')).toBe(ACTIVE_PERIOD_KEY);
    expect(periodKeyForMeter('keywordResearch')).toMatch(/^\d{4}-\d{2}$/);
    expect(calendarPeriodKey(new Date(Date.UTC(2026, 6, 15)))).toBe('2026-07');
  });

  it('PlanLimitError carries 402 payload', () => {
    const err = new PlanLimitError({
      plan: 'growth',
      meter: 'documents',
      used: 30,
      reserved: 0,
      requested: 1,
      limit: 30,
      remaining: 0,
    });
    expect(isPlanLimitError(err)).toBe(true);
    expect(err.status).toBe(402);
    expect(err.payload.code).toBe('plan_limit');
    expect(err.payload.plan).toBe('growth');
    expect(err.payload.remaining).toBe(0);
  });
});
