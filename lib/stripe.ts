import Stripe from 'stripe';

let client: Stripe | null = null;

export function getStripeSecretKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return key || null;
}

export function getStripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return secret || null;
}

export function getStripe(): Stripe {
  const key = getStripeSecretKey();
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  if (!client) {
    client = new Stripe(key);
  }
  return client;
}

export function isStripeConfigured(): boolean {
  return getStripeSecretKey() !== null;
}
