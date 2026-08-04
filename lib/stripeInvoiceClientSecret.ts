/**
 * Extract Payment Element client_secret from a Subscription's latest invoice.
 *
 * Stripe API 2025-03-31.basil+ removed Invoice.payment_intent in favor of
 * Invoice.confirmation_secret (stripe-node ≥22 pins that API). Keep a legacy
 * payment_intent fallback for older account/API pins.
 */
export function clientSecretFromSubscriptionInvoice(
  subscription: { latest_invoice?: unknown },
): { clientSecret: string; intentType: 'payment' } | null {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice !== 'object') return null;

  const conf = (invoice as {
    confirmation_secret?: { client_secret?: string | null } | null;
  }).confirmation_secret;
  if (conf && typeof conf.client_secret === 'string' && conf.client_secret) {
    return { clientSecret: conf.client_secret, intentType: 'payment' };
  }

  const paymentIntent = (invoice as {
    payment_intent?: { client_secret?: string | null } | string | null;
  }).payment_intent;
  if (
    paymentIntent
    && typeof paymentIntent === 'object'
    && typeof paymentIntent.client_secret === 'string'
    && paymentIntent.client_secret
  ) {
    return { clientSecret: paymentIntent.client_secret, intentType: 'payment' };
  }

  return null;
}
