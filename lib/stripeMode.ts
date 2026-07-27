/** Stripe test/live mode gate — refuse mismatched secret vs STRIPE_MODE. */

export type StripeMode = 'test' | 'live';

export function detectStripeKeyMode(secretKey: string): StripeMode | null {
  const k = secretKey.trim();
  if (k.startsWith('sk_test_') || k.startsWith('rk_test_')) return 'test';
  if (k.startsWith('sk_live_') || k.startsWith('rk_live_')) return 'live';
  return null;
}

export function getConfiguredStripeMode(): StripeMode | null {
  const raw = (process.env.STRIPE_MODE || '').trim().toLowerCase();
  if (raw === 'test' || raw === 'live') return raw;
  return null;
}

/** Returns error message if misconfigured; null if OK or Stripe unset. */
export function stripeModeMismatchError(): string | null {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) return null;
  const keyMode = detectStripeKeyMode(key);
  const configured = getConfiguredStripeMode();
  if (!keyMode) return 'STRIPE_SECRET_KEY has unrecognized prefix (expected sk_test_ / sk_live_)';
  if (configured && configured !== keyMode) {
    return `STRIPE_MODE=${configured} but STRIPE_SECRET_KEY is ${keyMode}`;
  }
  return null;
}

export function assertStripeModeOrThrow(): void {
  const err = stripeModeMismatchError();
  if (err) throw new Error(err);
}
