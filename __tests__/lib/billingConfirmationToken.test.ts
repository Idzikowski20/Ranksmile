import {
  mintBillingConfirmationToken,
  verifyBillingConfirmationToken,
} from '../../lib/billingConfirmationToken';

describe('billingConfirmationToken', () => {
  const prev = process.env.BILLING_CONFIRMATION_SECRET;

  beforeAll(() => {
    process.env.BILLING_CONFIRMATION_SECRET = 'test-confirmation-secret';
  });

  afterAll(() => {
    if (prev === undefined) delete process.env.BILLING_CONFIRMATION_SECRET;
    else process.env.BILLING_CONFIRMATION_SECRET = prev;
  });

  it('mints a token that verifies for the same org within TTL', () => {
    const now = 1_700_000_000;
    const token = mintBillingConfirmationToken(
      {
        orgId: 6,
        subscriptionId: 'sub_1',
        planSlug: 'growth',
        billingPeriod: 'yearly',
      },
      900,
      now,
    );
    expect(verifyBillingConfirmationToken(token, { orgId: 6, nowSec: now + 60 })).toEqual({
      orgId: 6,
      subscriptionId: 'sub_1',
      planSlug: 'growth',
      billingPeriod: 'yearly',
      exp: now + 900,
    });
  });

  it('rejects expired tokens and wrong org', () => {
    const now = 1_700_000_000;
    const token = mintBillingConfirmationToken(
      {
        orgId: 6,
        subscriptionId: 'sub_1',
        planSlug: 'growth',
        billingPeriod: 'yearly',
      },
      60,
      now,
    );
    expect(verifyBillingConfirmationToken(token, { orgId: 6, nowSec: now + 120 })).toBeNull();
    expect(verifyBillingConfirmationToken(token, { orgId: 99, nowSec: now + 10 })).toBeNull();
    expect(verifyBillingConfirmationToken('not-a-token', { orgId: 6, nowSec: now })).toBeNull();
  });
});
