import {
  BillingSource,
  decideBillingChange,
  ensureCorrelationId,
  isEntitledStatus,
} from '../../lib/billingAuditShared';

describe('decideBillingChange', () => {
  it('SKIP when plan/status not touched', () => {
    expect(decideBillingChange({
      oldPlan: 'growth',
      newPlan: undefined,
      oldStatus: 'trialing',
      newStatus: undefined,
      planTouched: false,
      statusTouched: false,
    })).toEqual({ changed: false, decision: 'SKIP' });
  });

  it('SKIP when touched values equal old', () => {
    expect(decideBillingChange({
      oldPlan: 'growth',
      newPlan: 'growth',
      oldStatus: 'trialing',
      newStatus: 'trialing',
      planTouched: true,
      statusTouched: true,
    })).toEqual({ changed: false, decision: 'SKIP' });
  });

  it('ALLOW when granting entitled status', () => {
    expect(decideBillingChange({
      oldPlan: null,
      newPlan: 'growth',
      oldStatus: null,
      newStatus: 'trialing',
      planTouched: true,
      statusTouched: true,
    })).toEqual({ changed: true, decision: 'ALLOW' });
  });

  it('ROLLBACK when clearing plan slug', () => {
    expect(decideBillingChange({
      oldPlan: 'growth',
      newPlan: null,
      oldStatus: 'trialing',
      newStatus: undefined,
      planTouched: true,
      statusTouched: false,
    })).toEqual({ changed: true, decision: 'ROLLBACK' });
  });

  it('ROLLBACK when clearing to incomplete', () => {
    expect(decideBillingChange({
      oldPlan: 'growth',
      newPlan: null,
      oldStatus: 'trialing',
      newStatus: 'incomplete',
      planTouched: true,
      statusTouched: true,
    })).toEqual({ changed: true, decision: 'ROLLBACK' });
  });
});

describe('billing audit helpers', () => {
  it('isEntitledStatus covers paid-like statuses', () => {
    expect(isEntitledStatus('trialing')).toBe(true);
    expect(isEntitledStatus('active')).toBe(true);
    expect(isEntitledStatus('incomplete')).toBe(false);
    expect(isEntitledStatus(null)).toBe(false);
  });

  it('ensureCorrelationId keeps non-empty ids', () => {
    expect(ensureCorrelationId('checkout-abc')).toBe('checkout-abc');
    expect(ensureCorrelationId('  ')).toMatch(/./);
  });

  it('BillingSource enum is stable for ledger writers', () => {
    expect(BillingSource.CHECKOUT).toBe('CHECKOUT');
    expect(BillingSource.ONBOARDING).toBe('ONBOARDING');
    expect(BillingSource.WEBHOOK_SETUP).toBe('WEBHOOK_SETUP');
  });
});
