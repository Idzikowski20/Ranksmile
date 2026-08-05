/**
 * Payment-failed helpers — Access Snapshot projects FAILED → PAYMENT_FAILED.
 * Frontend allowlist delegates to AccessPolicy for PAYMENT_FAILED.
 * API allowlist kept for transitional callers; prefer allowsApi(appState, route).
 */
import type { OrgBillingState } from './orgBilling';
import { allowsFrontend } from './appAccess';

export function isPaymentFailedLocked(billing: OrgBillingState | null | undefined): boolean {
  return billing?.paymentFailedLockedAt != null;
}

export function isFrontendRouteAllowedDuringPaymentLock(url: string): boolean {
  return allowsFrontend('PAYMENT_FAILED', url);
}

const ALLOWED_API = new Set([
  'GET:/api/session/bootstrap',
  'GET:/api/health',
  'GET:/api/ready',
  'GET:/api/billing/subscription',
  'GET:/api/billing/status',
  'GET:/api/billing/plan-summary',
  'GET:/api/billing/invoices',
  'GET:/api/billing/confirmation',
  'GET:/api/billing/snapshot',
  'POST:/api/billing/upgrade-preview',
  'POST:/api/billing/create-subscription',
  'POST:/api/billing/checkout-session',
  'POST:/api/billing/upgrade-subscription',
  'POST:/api/billing/portal',
  'POST:/api/billing/cancel',
  'POST:/api/billing/update-customer',
  'POST:/api/billing/audit-beacon',
  'POST:/api/billing/tax-preview',
  'POST:/api/billing/issue-confirmation',
  'POST:/api/billing/activate-trial',
]);

/** Expects `METHOD:/path` (optional query stripped). Default deny. */
export function isApiRouteAllowedDuringPaymentLock(url: string): boolean {
  const trimmed = url.trim().split('?')[0] ?? '';
  const m = trimmed.match(/^(GET|POST|PUT|DELETE|PATCH)\s*[: ]\s*(\/.*)$/i);
  if (!m) return false;
  const method = m[1].toUpperCase();
  const path = m[2];
  if (ALLOWED_API.has(`${method}:${path}`)) return true;
  if (method === 'DELETE' && /^\/api\/billing\/payment-methods\/[^/]+$/.test(path)) return true;
  if (method === 'POST' && /^\/api\/billing\/payment-methods\/[^/]+\/default$/.test(path)) return true;
  return false;
}
