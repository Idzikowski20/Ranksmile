/**
 * Client-safe billing audit types + helpers (no DB imports).
 */
export enum BillingSource {
  CHECKOUT = 'CHECKOUT',
  ACTIVATE_TRIAL = 'ACTIVATE_TRIAL',
  WEBHOOK_SETUP = 'WEBHOOK_SETUP',
  WEBHOOK_SUB = 'WEBHOOK_SUB',
  RECONCILE = 'RECONCILE',
  STRIPE_CUSTOMER = 'STRIPE_CUSTOMER',
  ADMIN = 'ADMIN',
  STARTER_NUDGE = 'STARTER_NUDGE',
  ONBOARDING = 'ONBOARDING',
  UNKNOWN = 'UNKNOWN',
}

export type BillingDecision = 'ALLOW' | 'DENY' | 'SKIP' | 'ROLLBACK';

export type BillingEventKind =
  | 'SETUP_INTENT_CREATED'
  | 'SETUP_INTENT_SUCCEEDED'
  | 'TRIAL_ACTIVATED'
  | 'SUBSCRIPTION_SYNCED'
  | 'PLAN_CHANGED'
  | 'ENTITLEMENT_GRANTED'
  | 'ONBOARDING_REDIRECT'
  | 'BILLING_EVENT';

export type BillingAuditContext = {
  source: BillingSource;
  reason: string;
  correlationId?: string;
  actorUserId?: string;
  setupIntentId?: string;
  stripeSubscriptionId?: string;
  meta?: Record<string, unknown>;
};

export type BillingEventPayload = {
  kind: BillingEventKind;
  source: BillingSource;
  reason: string;
  decision: BillingDecision;
  correlationId: string;
  orgId?: number | null;
  actorUserId?: string | null;
  setupIntentId?: string | null;
  stripeSubscriptionId?: string | null;
  oldPlanSlug?: string | null;
  newPlanSlug?: string | null;
  oldStatus?: string | null;
  newStatus?: string | null;
  stack?: string | null;
  meta?: Record<string, unknown>;
};

const ENTITLED = new Set(['trialing', 'active', 'past_due', 'unpaid']);

export function isBillingAuditLogEnabled(): boolean {
  if (typeof process === 'undefined') return true;
  if (process.env.BILLING_AUDIT_LOG === '0' || process.env.BILLING_AUDIT_LOG === 'false') return false;
  if (process.env.BILLING_AUDIT_LOG === '1' || process.env.BILLING_AUDIT_LOG === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

export function newBillingCorrelationId(): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `corr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ensureCorrelationId(id?: string | null): string {
  const t = typeof id === 'string' ? id.trim() : '';
  return t || newBillingCorrelationId();
}

export function captureBillingStack(maxFrames = 8): string {
  const err = new Error('billing-audit');
  const lines = (err.stack || '').split('\n').slice(1);
  const filtered = lines
    .map((l) => l.trim())
    .filter((l) => l && !l.includes('billingAudit') && !l.includes('captureBillingStack'));
  return filtered.slice(0, maxFrames).join(' | ');
}

export function isEntitledStatus(status: string | null | undefined): boolean {
  return Boolean(status && ENTITLED.has(status));
}

export function decideBillingChange(args: {
  oldPlan: string | null;
  newPlan: string | null | undefined;
  oldStatus: string | null;
  newStatus: string | null | undefined;
  planTouched: boolean;
  statusTouched: boolean;
}): { changed: boolean; decision: BillingDecision } {
  const nextPlan = args.planTouched ? (args.newPlan ?? null) : args.oldPlan;
  const nextStatus = args.statusTouched ? (args.newStatus ?? null) : args.oldStatus;
  const planChanged = args.planTouched && nextPlan !== args.oldPlan;
  const statusChanged = args.statusTouched && nextStatus !== args.oldStatus;
  const changed = planChanged || statusChanged;
  if (!changed) return { changed: false, decision: 'SKIP' };

  const clearingPlan = args.planTouched && args.oldPlan != null && nextPlan == null;
  const clearingToNonEntitled = args.statusTouched
    && args.oldStatus != null
    && (nextStatus == null
      || nextStatus === 'incomplete'
      || nextStatus === 'canceled'
      || nextStatus === 'incomplete_expired');
  if (clearingPlan || (clearingToNonEntitled && !isEntitledStatus(nextStatus))) {
    return { changed: true, decision: 'ROLLBACK' };
  }
  return { changed: true, decision: 'ALLOW' };
}

/** Browser / guard: console + best-effort beacon to persist ONBOARDING_REDIRECT. */
export function logOnboardingRedirect(args: {
  from: string;
  to: string;
  reason: string;
  workspaces: number;
  pathname: string;
  correlationId?: string;
}): void {
  const correlationId = ensureCorrelationId(args.correlationId);
  const payload = {
    kind: 'ONBOARDING_REDIRECT' as const,
    source: BillingSource.ONBOARDING,
    reason: args.reason,
    decision: 'ALLOW' as const,
    correlationId,
    orgId: null as number | null,
    meta: {
      from: args.from,
      to: args.to,
      workspaces: args.workspaces,
      pathname: args.pathname,
    },
  };
  // eslint-disable-next-line no-console
  console.info('[BILLING_EVENT]', JSON.stringify(payload));
  if (typeof window !== 'undefined') {
    void fetch('/api/billing/audit-beacon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    }).catch(() => { /* best-effort */ });
  }
}
