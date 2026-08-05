import { chooseReplacement } from '../../../lib/billing/chooseReplacement';
import type { PaymentMethodViewModel } from '../../../lib/billing/paymentMethodViewModel';

function pm(partial: Partial<PaymentMethodViewModel> & { id: string }): PaymentMethodViewModel {
  return {
    brand: 'visa',
    last4: '1111',
    expMonth: 1,
    expYear: 2030,
    roles: [],
    capabilities: {
      canDelete: true,
      canDetach: true,
      canReplace: true,
      canSetDefault: true,
      canBeTrialCard: false,
      canBeBackup: true,
    },
    rankingHint: 'created',
    created: 100,
    lastSuccessAt: null,
    ...partial,
  };
}

describe('chooseReplacement', () => {
  it('prefers rankingHint preferred over newer created', () => {
    const list = [
      pm({ id: 'pm_old', created: 1, rankingHint: 'preferred' }),
      pm({ id: 'pm_new', created: 999 }),
      pm({ id: 'pm_remove', created: 50 }),
    ];
    expect(chooseReplacement(list, 'pm_remove', 'pm_remove')?.id).toBe('pm_old');
  });

  it('falls back to previous default when still present', () => {
    const list = [
      pm({ id: 'pm_a', created: 1 }),
      pm({ id: 'pm_b', created: 2 }),
      pm({ id: 'pm_remove', created: 3 }),
    ];
    expect(chooseReplacement(list, 'pm_remove', 'pm_a')?.id).toBe('pm_a');
  });

  it('uses most_recent_success when no preferred/default', () => {
    const list = [
      pm({ id: 'pm_a', created: 10, lastSuccessAt: 100 }),
      pm({ id: 'pm_b', created: 20, lastSuccessAt: 200 }),
      pm({ id: 'pm_remove', created: 1 }),
    ];
    expect(chooseReplacement(list, 'pm_remove', null)?.id).toBe('pm_b');
  });

  it('falls back to newest created', () => {
    const list = [
      pm({ id: 'pm_a', created: 10 }),
      pm({ id: 'pm_b', created: 30 }),
      pm({ id: 'pm_remove', created: 1 }),
    ];
    expect(chooseReplacement(list, 'pm_remove', 'pm_remove')?.id).toBe('pm_b');
  });

  it('returns null when no candidates', () => {
    expect(chooseReplacement([pm({ id: 'only' })], 'only', 'only')).toBeNull();
  });

  it('never promotes an expired card and retains another default', () => {
    const list = [
      pm({ id: 'expired', roles: ['expired'], created: 999 }),
      pm({ id: 'default', roles: ['default'], created: 1 }),
      pm({ id: 'remove', created: 2 }),
    ];
    expect(chooseReplacement(list, 'remove', null)?.id).toBe('default');
  });
});
