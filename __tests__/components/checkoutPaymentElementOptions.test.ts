import { CHECKOUT_PAYMENT_ELEMENT_OPTIONS } from '../../components/billing/CheckoutStripeProvider';

/**
 * Stripe throws IntegrationError on confirmSetup when Payment Element sets
 * fields.billingDetails.*.never without payment_method_data.billing_details.
 * Checkout does not currently pass those confirmParams — keep fields on auto.
 */
describe('CHECKOUT_PAYMENT_ELEMENT_OPTIONS', () => {
  it('does not set billingDetails fields to never', () => {
    const { billingDetails } = CHECKOUT_PAYMENT_ELEMENT_OPTIONS.fields;
    expect(billingDetails.email).not.toBe('never');
    expect(billingDetails.name).not.toBe('never');
    expect(billingDetails.address).not.toBe('never');
  });

  it('keeps Link wallet disabled', () => {
    expect(CHECKOUT_PAYMENT_ELEMENT_OPTIONS.wallets.link).toBe('never');
  });
});
