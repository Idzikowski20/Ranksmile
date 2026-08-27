jest.mock('../../../../lib/stripe', () => ({
  getStripe: jest.fn(),
  isStripeConfigured: jest.fn(() => true),
}));
jest.mock('../../../../lib/orgBilling', () => ({
  getOrgBillingState: jest.fn(async () => ({ stripeCustomerId: 'cus_1' })),
}));

import { createStripeInvoiceRepository } from '../../../../src/infrastructure/billing/stripe/stripeInvoiceRepository';
import { isStripeConfigured } from '../../../../lib/stripe';
import { getOrgBillingState } from '../../../../lib/orgBilling';

describe('stripeInvoiceRepository', () => {
  it('reports configuration from the stripe client', () => {
    expect(createStripeInvoiceRepository().isConfigured()).toBe(true);
    expect(isStripeConfigured).toHaveBeenCalled();
  });

  it('resolves the org stripe customer id, or null when absent', async () => {
    const repo = createStripeInvoiceRepository();
    expect(await repo.getCustomerId(1)).toBe('cus_1');

    (getOrgBillingState as jest.Mock).mockResolvedValueOnce(null);
    expect(await repo.getCustomerId(2)).toBeNull();
  });
});
