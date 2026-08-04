import { clientSecretFromSubscriptionInvoice } from '../../lib/stripeInvoiceClientSecret';

describe('clientSecretFromSubscriptionInvoice', () => {
  it('reads basil+ confirmation_secret', () => {
    expect(clientSecretFromSubscriptionInvoice({
      latest_invoice: {
        confirmation_secret: { client_secret: 'pi_secret_basil', type: 'payment_intent' },
      },
    })).toEqual({ clientSecret: 'pi_secret_basil', intentType: 'payment' });
  });

  it('falls back to legacy payment_intent', () => {
    expect(clientSecretFromSubscriptionInvoice({
      latest_invoice: {
        payment_intent: { client_secret: 'pi_secret_legacy' },
      },
    })).toEqual({ clientSecret: 'pi_secret_legacy', intentType: 'payment' });
  });

  it('returns null when invoice has neither (current 502 cause)', () => {
    expect(clientSecretFromSubscriptionInvoice({
      latest_invoice: { id: 'in_123', object: 'invoice' },
    })).toBeNull();
  });

  it('returns null when latest_invoice is an id string', () => {
    expect(clientSecretFromSubscriptionInvoice({
      latest_invoice: 'in_123',
    })).toBeNull();
  });
});
