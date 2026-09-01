jest.mock('../../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn(async () => [[], undefined]) },
}));

jest.mock('../../../lib/ensureBillingTables', () => ({
  ensureBillingTables: jest.fn(async () => undefined),
}));

jest.mock('../../../lib/stripe', () => ({
  getStripe: jest.fn(),
  isStripeConfigured: jest.fn(() => false),
}));

jest.mock('../../../lib/orgBilling', () => ({
  getOrgBillingState: jest.fn(async () => null),
}));

jest.mock('../../../lib/billingInvoices', () => ({
  listOrgBillingInvoices: jest.fn(async () => []),
}));

import { billingError } from '../../../lib/billing/billingErrors';
import { projectTimeline, type BillingDomainEvent } from '../../../lib/billing/domainEvents';
import { BILLING_SNAPSHOT_SCHEMA_VERSION } from '../../../lib/billing/buildBillingSnapshot';
import { enrichPaymentMethodViewModels } from '../../../lib/billing/paymentMethodService';

describe('billing domain events → timeline', () => {
  it('projects enum type + SOURCE without human labels', () => {
    const events: BillingDomainEvent[] = [
      {
        id: '1',
        orgId: 1,
        type: 'TRIAL_STARTED',
        source: 'checkout',
        at: '2026-08-03T12:00:00.000Z',
        payload: { subscriptionId: 'sub_1' },
      },
    ];
    const timeline = projectTimeline(events);
    expect(timeline).toEqual([
      {
        type: 'TRIAL_STARTED',
        source: 'checkout',
        at: '2026-08-03T12:00:00.000Z',
        payload: { subscriptionId: 'sub_1' },
      },
    ]);
    expect(JSON.stringify(timeline)).not.toMatch(/Trial Started/i);
  });
});

describe('billing snapshot contract pieces', () => {
  it('exposes schemaVersion constant for envelope', () => {
    expect(BILLING_SNAPSHOT_SCHEMA_VERSION).toBe(1);
  });

  it('ViewModel uses brand/last4 not Stripe card object keys', () => {
    const vms = enrichPaymentMethodViewModels({
      drafts: [{
        id: 'pm_1',
        brand: 'visa',
        last4: '4242',
        expMonth: 4,
        expYear: 2031,
        created: 1,
        lastSuccessAt: null,
      }],
      customerDefaultId: 'pm_1',
      subscriptionDefaultId: 'pm_1',
      subscriptionStatus: 'trialing',
    });
    expect(vms[0]).toMatchObject({
      id: 'pm_1',
      brand: 'visa',
      last4: '4242',
      roles: expect.arrayContaining(['default', 'trial_card']),
    });
    expect(vms[0]).toHaveProperty('capabilities.canDelete');
    expect(vms[0]).not.toHaveProperty('card');
    expect(vms[0]).not.toHaveProperty('object');
  });
});

describe('structured billing errors', () => {
  it('returns code + reason for locked last card', () => {
    expect(billingError(
      'PAYMENT_METHOD_REQUIRED',
      'LAST_DEFAULT_CARD',
      'This payment method cannot be removed while your trial or plan is active',
    )).toEqual({
      code: 'PAYMENT_METHOD_REQUIRED',
      reason: 'LAST_DEFAULT_CARD',
      message: 'This payment method cannot be removed while your trial or plan is active',
    });
  });
});
