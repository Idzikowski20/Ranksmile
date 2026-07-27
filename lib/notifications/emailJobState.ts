import db from '../../database/database';
import type { EmailJobRow, EmailJobSkipReason } from './emailTypes';
import { EMAIL_STALE_RUNNING_MS } from './emailTypes';

function asRow(r: Record<string, unknown>): EmailJobRow {
  return {
    id: Number(r.id),
    idempotency_key: String(r.idempotency_key),
    type: String(r.type),
    org_id: Number(r.org_id),
    domain_id: Number(r.domain_id),
    domain: String(r.domain),
    to_email: String(r.to_email),
    status: r.status as EmailJobRow['status'],
    attempts: Number(r.attempts),
    max_attempts: Number(r.max_attempts),
    last_error: r.last_error == null ? null : String(r.last_error),
    skip_reason: r.skip_reason == null ? null : String(r.skip_reason),
    provider_msg_id: r.provider_msg_id == null ? null : String(r.provider_msg_id),
    payload_json: r.payload_json == null ? null : String(r.payload_json),
    next_attempt_at: r.next_attempt_at as string | Date,
    created_at: r.created_at as string | Date,
    updated_at: r.updated_at as string | Date,
    sent_at: (r.sent_at as string | Date | null) ?? null,
    dlq_at: (r.dlq_at as string | Date | null) ?? null,
  };
}

/** Atomic claim: queued|failed + due → running, attempts++. 0 rows = already claimed. */
export async function claimEmailJob(id: number): Promise<EmailJobRow | null> {
  const [rows] = await db.query(
    `UPDATE notification_email_jobs
        SET status = 'running',
            attempts = attempts + 1,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status IN ('queued', 'failed')
        AND next_attempt_at <= CURRENT_TIMESTAMP
        AND attempts < max_attempts
      RETURNING *`,
    { replacements: [id] },
  );
  const list = rows as Record<string, unknown>[];
  return list[0] ? asRow(list[0]) : null;
}

export async function markEmailSent(id: number, providerMsgId?: string | null): Promise<void> {
  await db.query(
    `UPDATE notification_email_jobs
        SET status = 'sent',
            sent_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP,
            provider_msg_id = COALESCE(?, provider_msg_id),
            last_error = NULL
      WHERE id = ?`,
    { replacements: [providerMsgId ?? null, id] },
  );
}

export async function markEmailFailed(
  id: number,
  error: string,
  nextAttemptAt: Date,
): Promise<void> {
  await db.query(
    `UPDATE notification_email_jobs
        SET status = 'failed',
            last_error = ?,
            next_attempt_at = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    { replacements: [error.slice(0, 2000), nextAttemptAt.toISOString(), id] },
  );
}

export async function markEmailDlq(id: number, error: string): Promise<void> {
  await db.query(
    `UPDATE notification_email_jobs
        SET status = 'dlq',
            last_error = ?,
            dlq_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    { replacements: [error.slice(0, 2000), id] },
  );
}

export async function markEmailSkipped(id: number, skipReason: EmailJobSkipReason): Promise<void> {
  await db.query(
    `UPDATE notification_email_jobs
        SET status = 'skipped',
            skip_reason = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    { replacements: [skipReason, id] },
  );
}

/**
 * Recover crashed workers. May re-send after SMTP accept before markSent —
 * accepted at-least-once SMTP semantics (plan invariant #1).
 */
export async function recoverStaleEmailJobs(
  olderThanMs: number = EMAIL_STALE_RUNNING_MS,
): Promise<Array<{ id: number; idempotency_key: string; status: string }>> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const [rows] = await db.query(
    `UPDATE notification_email_jobs
        SET status = CASE WHEN attempts >= max_attempts THEN 'dlq' ELSE 'queued' END,
            next_attempt_at = CURRENT_TIMESTAMP,
            dlq_at = CASE WHEN attempts >= max_attempts THEN CURRENT_TIMESTAMP ELSE dlq_at END,
            last_error = COALESCE(last_error, 'stale running recovered'),
            updated_at = CURRENT_TIMESTAMP
      WHERE status = 'running'
        AND updated_at < ?
      RETURNING id, idempotency_key, status`,
    { replacements: [cutoff] },
  );
  return (rows as Array<{ id: number; idempotency_key: string; status: string }>).map((r) => ({
    id: Number(r.id),
    idempotency_key: String(r.idempotency_key),
    status: String(r.status),
  }));
}

export async function listDueEmailJobs(limit = 100): Promise<Array<{ id: number; idempotency_key: string }>> {
  const [rows] = await db.query(
    `SELECT id, idempotency_key
       FROM notification_email_jobs
      WHERE status IN ('queued', 'failed')
        AND next_attempt_at <= CURRENT_TIMESTAMP
        AND attempts < max_attempts
      ORDER BY created_at ASC
      LIMIT ?`,
    { replacements: [limit] },
  );
  return (rows as Array<{ id: number; idempotency_key: string }>).map((r) => ({
    id: Number(r.id),
    idempotency_key: String(r.idempotency_key),
  }));
}

export async function getEmailJobById(id: number): Promise<EmailJobRow | null> {
  const [rows] = await db.query(
    'SELECT * FROM notification_email_jobs WHERE id = ? LIMIT 1',
    { replacements: [id] },
  );
  const list = rows as Record<string, unknown>[];
  return list[0] ? asRow(list[0]) : null;
}
