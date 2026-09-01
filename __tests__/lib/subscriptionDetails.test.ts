import {
  formatMoney,
  formatUpcomingTotal,
} from '../../lib/subscriptionFormat';
import type { UpcomingPaymentDetails } from '../../lib/subscriptionFormat';

const sampleUpcoming: UpcomingPaymentDetails = {
  planName: 'Growth',
  planAmountCents: 5900,
  taxAmountCents: 1357,
  taxLabel: 'TAX (23%)',
  totalAmountCents: 7257,
  currency: 'eur',
  renewalDate: '2026-06-30T00:00:00.000Z',
  renewalDateLabel: '30 June 2026',
};

describe('subscriptionDetails helpers', () => {
  it('formatMoney renders euro amounts', () => {
    expect(formatMoney(7257, 'eur')).toBe('€72.57');
  });

  it('formatUpcomingTotal returns zero when canceled', () => {
    expect(formatUpcomingTotal(sampleUpcoming, true)).toBe('€0.00');
  });

  it('formatUpcomingTotal returns invoice total when active', () => {
    expect(formatUpcomingTotal(sampleUpcoming, false)).toBe('€72.57');
  });
});
