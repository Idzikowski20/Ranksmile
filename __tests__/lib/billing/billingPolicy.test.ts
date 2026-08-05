import { BillingPolicy } from '../../../lib/billing/billingPolicy';
import type { BillingContext, PaymentMethodViewModel } from '../../../lib/billing/paymentMethodViewModel';

function pm(partial: Partial<PaymentMethodViewModel> & { id: string }): PaymentMethodViewModel {
  return {
    brand: 'visa',
    last4: '4242',
    expMonth: 12,
    expYear: 2030,
    roles: [],
    capabilities: {
      canDelete: false,
      canDetach: false,
      canReplace: false,
      canSetDefault: false,
      canBeTrialCard: false,
      canBeBackup: false,
    },
    rankingHint: 'created',
    created: 1,
    lastSuccessAt: null,
    ...partial,
  };
}

function ctx(over: Partial<BillingContext> & Pick<BillingContext, 'paymentMethods' | 'targetPaymentMethodId'>): BillingContext {
  return {
    subscriptionStatus: 'trialing',
    customerDefaultId: 'pm_a',
    subscriptionDefaultId: 'pm_a',
    ...over,
  };
}

describe('BillingPolicy', () => {
  it('blocks delete of the only card while trialing', () => {
    const methods = [pm({ id: 'pm_a', roles: ['default', 'trial_card'] })];
    const c = ctx({ paymentMethods: methods, targetPaymentMethodId: 'pm_a' });
    expect(BillingPolicy.canDelete(c)).toBe(false);
    expect(BillingPolicy.capabilitiesFor(c).canDelete).toBe(false);
  });

  it('allows delete of a non-default backup while trialing', () => {
    const methods = [
      pm({ id: 'pm_a', roles: ['default'] }),
      pm({ id: 'pm_b', roles: ['backup'], created: 2 }),
    ];
    const c = ctx({ paymentMethods: methods, targetPaymentMethodId: 'pm_b' });
    expect(BillingPolicy.canDelete(c)).toBe(true);
  });

  it('allows delete of default when a successor exists', () => {
    const methods = [
      pm({ id: 'pm_a', roles: ['default'] }),
      pm({ id: 'pm_b', roles: ['backup'], created: 2 }),
    ];
    const c = ctx({ paymentMethods: methods, targetPaymentMethodId: 'pm_a' });
    expect(BillingPolicy.canDelete(c)).toBe(true);
  });

  it('canSetDefault is false for current customer default', () => {
    const methods = [pm({ id: 'pm_a' }), pm({ id: 'pm_b', created: 2 })];
    const c = ctx({
      paymentMethods: methods,
      targetPaymentMethodId: 'pm_a',
      customerDefaultId: 'pm_a',
    });
    expect(BillingPolicy.canSetDefault(c)).toBe(false);
    expect(BillingPolicy.canSetDefault({ ...c, targetPaymentMethodId: 'pm_b' })).toBe(true);
  });

  it('canBeTrialCard only when trialing and subscription default', () => {
    const methods = [pm({ id: 'pm_a' })];
    expect(BillingPolicy.canBeTrialCard(ctx({
      paymentMethods: methods,
      targetPaymentMethodId: 'pm_a',
      subscriptionStatus: 'trialing',
      subscriptionDefaultId: 'pm_a',
    }))).toBe(true);
    expect(BillingPolicy.canBeTrialCard(ctx({
      paymentMethods: methods,
      targetPaymentMethodId: 'pm_a',
      subscriptionStatus: 'active',
      subscriptionDefaultId: 'pm_a',
    }))).toBe(false);
  });
});
