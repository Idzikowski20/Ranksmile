import { buildStripeAppearance, CHECKOUT_PAYMENT_ELEMENT_OPTIONS } from '../../components/billing/CheckoutStripeProvider';
import { darkTheme, lightTheme } from '../../components/koala/tokens/themes';

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

/**
 * Stripe Elements render in a cross-origin iframe that cannot resolve the parent
 * document's CSS vars, so the surrounding page following the theme is not enough —
 * the card/address fields stay light unless the appearance is derived in JS.
 */
describe('buildStripeAppearance', () => {
  it('derives surface and text from the theme rather than a fixed light palette', () => {
    const light = buildStripeAppearance(lightTheme);
    const dark = buildStripeAppearance(darkTheme);

    expect(light.variables?.colorBackground).toBe(lightTheme.background.primary);
    expect(light.variables?.colorText).toBe(lightTheme.text.primary);
    expect(dark.variables?.colorBackground).toBe(darkTheme.background.primary);
    expect(dark.variables?.colorText).toBe(darkTheme.text.primary);
    expect(dark.variables?.colorBackground).not.toBe(light.variables?.colorBackground);
  });

  it('themes the input rules too, not just the top-level variables', () => {
    const dark = buildStripeAppearance(darkTheme);
    // Serialized so a light hex hiding in any nested rule fails the check.
    expect(JSON.stringify(dark.rules)).not.toContain(lightTheme.border.primary);
    expect(JSON.stringify(dark.rules)).toContain(darkTheme.border.primary);
  });
});
