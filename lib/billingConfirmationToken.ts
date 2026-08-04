import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_TTL_SEC = 15 * 60;

export type BillingConfirmationTokenPayload = {
  orgId: number;
  subscriptionId: string;
  planSlug: string;
  billingPeriod: string;
  exp: number;
};

function signingSecret(): string {
  const secret = process.env.BILLING_CONFIRMATION_SECRET?.trim()
    || process.env.STRIPE_WEBHOOK_SECRET?.trim()
    || process.env.NEON_AUTH_COOKIE_SECRET?.trim()
    || '';
  if (!secret) {
    throw new Error('BILLING_CONFIRMATION_SECRET (or STRIPE_WEBHOOK_SECRET) is not configured');
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function sign(body: string): string {
  return createHmac('sha256', signingSecret()).update(body).digest('base64url');
}

export function mintBillingConfirmationToken(
  args: Omit<BillingConfirmationTokenPayload, 'exp'>,
  ttlSec = DEFAULT_TTL_SEC,
  nowSec = Math.floor(Date.now() / 1000),
): string {
  const payload: BillingConfirmationTokenPayload = {
    orgId: args.orgId,
    subscriptionId: args.subscriptionId,
    planSlug: args.planSlug,
    billingPeriod: args.billingPeriod,
    exp: nowSec + Math.max(60, ttlSec),
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyBillingConfirmationToken(
  token: string,
  opts: { orgId: number; nowSec?: number },
): BillingConfirmationTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [body, sig] = parts;
  let expected: string;
  try {
    expected = sign(body);
  } catch {
    return null;
  }

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const raw = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<BillingConfirmationTokenPayload>;
    if (
      typeof raw.orgId !== 'number'
      || typeof raw.subscriptionId !== 'string'
      || typeof raw.planSlug !== 'string'
      || typeof raw.billingPeriod !== 'string'
      || typeof raw.exp !== 'number'
    ) {
      return null;
    }
    const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
    if (raw.exp < now) return null;
    if (raw.orgId !== opts.orgId) return null;
    return {
      orgId: raw.orgId,
      subscriptionId: raw.subscriptionId,
      planSlug: raw.planSlug,
      billingPeriod: raw.billingPeriod,
      exp: raw.exp,
    };
  } catch {
    return null;
  }
}
