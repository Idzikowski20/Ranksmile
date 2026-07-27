export type EmailJobStatus = 'queued' | 'running' | 'sent' | 'failed' | 'dlq' | 'skipped';

export type EmailJobSkipReason = 'smtp_not_configured' | 'invalid_recipient';

export const EMAIL_JOB_TYPE_KEYWORD_POSITIONS = 'keyword_positions_update';
export const EMAIL_JOB_TYPE_PAYMENT_FAILED = 'payment_failed';
export const EMAIL_JOB_TYPE_ABANDONED_CHECKOUT = 'abandoned_checkout';
export const EMAIL_JOB_TYPE_STARTER_NUDGE = 'starter_nudge';

export type BillingEmailEventType =
  | typeof EMAIL_JOB_TYPE_PAYMENT_FAILED
  | typeof EMAIL_JOB_TYPE_ABANDONED_CHECKOUT
  | typeof EMAIL_JOB_TYPE_STARTER_NUDGE;

export function billingEmailIdempotencyKey(
  eventType: BillingEmailEventType,
  orgId: number,
  stripeObjectId: string,
): string {
  return `billing:${eventType}:org:${orgId}:${stripeObjectId}`;
}

/** Stale running recovery window — must be ≫ sendMail timeout (30s). */
export const EMAIL_STALE_RUNNING_MS = 15 * 60 * 1000;

export const EMAIL_SEND_TIMEOUT_MS = 30_000;

export const EMAIL_MAX_ATTEMPTS = 5;

export type EmailJobRow = {
  id: number;
  idempotency_key: string;
  type: string;
  org_id: number;
  domain_id: number;
  domain: string;
  to_email: string;
  status: EmailJobStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  skip_reason: string | null;
  provider_msg_id: string | null;
  payload_json: string | null;
  next_attempt_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
  sent_at: string | Date | null;
  dlq_at: string | Date | null;
};

export type EnqueueNotifyResult = {
  enqueued: number;
  skipped: number;
  existing: number;
  periodKey: string;
};

/** UTC daily `YYYY-MM-DD` or ISO week `YYYY-Www`. */
export function periodKeyFromInterval(interval: string, now = new Date()): string {
  const kind = String(interval || 'daily').toLowerCase();
  if (kind === 'weekly' || kind === 'week') return isoWeekPeriodKey(now);
  // daily / never / unknown → calendar day UTC
  return now.toISOString().slice(0, 10);
}

export function isoWeekPeriodKey(now = new Date()): string {
  // ISO week date (UTC)
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const year = d.getUTCFullYear();
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function keywordPositionsIdempotencyKey(domainId: number, periodKey: string): string {
  return `keyword_positions:domain:${domainId}:${periodKey}`;
}

export function backoffMs(attempts: number): number {
  return Math.min(15 * 60_000, 30_000 * (2 ** Math.max(0, attempts)));
}
