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
  getOrgBillingState: jest.fn(async () => ({
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    planSlug: null,
    billingPeriod: null,
    trialEndsAt: null,
    trialConsumedAt: null,
  })),
}));

jest.mock('../../../lib/billingInvoices', () => ({
  listOrgBillingInvoices: jest.fn(async () => []),
}));

import { buildBillingSnapshot, BILLING_SNAPSHOT_SCHEMA_VERSION } from '../../../lib/billing/buildBillingSnapshot';

describe('buildBillingSnapshot envelope', () => {
  it('returns schemaVersion, generatedAt, etag, payment_method_count', async () => {
    const snap = await buildBillingSnapshot(42);
    expect(snap.schemaVersion).toBe(BILLING_SNAPSHOT_SCHEMA_VERSION);
    expect(snap.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof snap.etag).toBe('string');
    expect(snap.etag.length).toBeGreaterThan(0);
    expect(snap.payment_method_count).toBe(0);
    expect(Array.isArray(snap.paymentMethods)).toBe(true);
    expect(Array.isArray(snap.timeline)).toBe(true);
    expect(Array.isArray(snap.invoices)).toBe(true);
  });
});
