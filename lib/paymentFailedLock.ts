import type { OrgBillingState } from './orgBilling';

export function isPaymentFailedLocked(billing: OrgBillingState | null | undefined): boolean {
  return billing?.paymentFailedLockedAt != null;
}

export function isFrontendRouteAllowedDuringPaymentLock(url: string): boolean {
  const pathname = url.split('?')[0]?.split('#')[0] ?? '';
  if (pathname === '/plans') return true;
  if (pathname.startsWith('/billing/checkout/')) return true;
  if (pathname === '/settings/billing_subscription') return true;
  return false;
}

const ALLOWED_API = new Set([
  'GET:/api/session/bootstrap',
  'GET:/api/health',
  'GET:/api/ready',
  'GET:/api/billing/subscription',
  'GET:/api/billing/status',
  'GET:/api/billing/plan-summary',
  'POST:/api/billing/upgrade-preview',
  'POST:/api/billing/create-subscription',
  'POST:/api/billing/checkout-session',
  'POST:/api/billing/upgrade-subscription',
  'POST:/api/billing/portal',
  'POST:/api/billing/cancel',
  'POST:/api/billing/update-customer',
]);

/** Expects `METHOD:/path` (optional query stripped). Default deny. */
export function isApiRouteAllowedDuringPaymentLock(url: string): boolean {
  const trimmed = url.trim().split('?')[0] ?? '';
  const m = trimmed.match(/^(GET|POST|PUT|DELETE|PATCH)\s*[: ]\s*(\/.*)$/i);
  if (!m) return false;
  return ALLOWED_API.has(`${m[1].toUpperCase()}:${m[2]}`);
}
