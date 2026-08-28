// Thin access wrapper over the shared Stripe client. Keeps the SDK entry point
// in one infrastructure spot so repositories don't reach into lib directly.
// (Transitional: lib/stripe itself moves under src/infrastructure in a later phase —
// see docs/superpowers/plans, "Phase N: lib/ infrastructure extraction".)
export { getStripe as getStripeClient, isStripeConfigured } from '@/src/infrastructure/stripe';
