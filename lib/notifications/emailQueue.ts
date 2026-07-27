import db from '../../database/database';
import { ensureNotificationEmailTables } from '../ensureNotificationEmailTables';
import {
  EMAIL_JOB_TYPE_KEYWORD_POSITIONS,
  EMAIL_MAX_ATTEMPTS,
  keywordPositionsIdempotencyKey,
  periodKeyFromInterval,
  type EnqueueNotifyResult,
} from './emailTypes';

export type DomainNotifyCandidate = {
  domainId: number;
  domain: string;
  orgId: number | null;
  notification: boolean | null;
  notificationEmails: string | null;
};

async function insertEmailJob(opts: {
  idempotencyKey: string;
  orgId: number;
  domainId: number;
  domain: string;
  toEmail: string;
}): Promise<number | null> {
  const [rows] = await db.query(
    `INSERT INTO notification_email_jobs (
       idempotency_key, type, org_id, domain_id, domain, to_email,
       status, attempts, max_attempts, next_attempt_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    {
      replacements: [
        opts.idempotencyKey,
        EMAIL_JOB_TYPE_KEYWORD_POSITIONS,
        opts.orgId,
        opts.domainId,
        opts.domain,
        opts.toEmail,
        EMAIL_MAX_ATTEMPTS,
      ],
    },
  );
  const list = rows as Array<{ id: number }>;
  return list[0] ? Number(list[0].id) : null;
}

/**
 * Enqueue keyword-position emails for candidates.
 * Pre-INSERT skips: notification=false, missing recipient, missing org.
 * Delivery is DB-polled by pipeline-workers reconciler (no BullMQ).
 */
export async function enqueueKeywordPositionEmails(opts: {
  domains: DomainNotifyCandidate[];
  defaultToEmail: string;
  notificationInterval: string;
}): Promise<EnqueueNotifyResult> {
  await ensureNotificationEmailTables();
  const periodKey = periodKeyFromInterval(opts.notificationInterval);
  let enqueued = 0;
  let skipped = 0;
  let existing = 0;

  for (const d of opts.domains) {
    if (d.notification === false) {
      skipped += 1;
      continue;
    }
    const toEmail = (d.notificationEmails || opts.defaultToEmail || '').trim();
    if (!toEmail) {
      skipped += 1;
      continue;
    }
    if (d.orgId == null || !Number.isFinite(d.orgId) || d.orgId <= 0) {
      skipped += 1;
      continue;
    }

    const idempotencyKey = keywordPositionsIdempotencyKey(d.domainId, periodKey);
    const id = await insertEmailJob({
      idempotencyKey,
      orgId: d.orgId,
      domainId: d.domainId,
      domain: d.domain,
      toEmail,
    });

    if (id == null) {
      existing += 1;
      continue;
    }
    enqueued += 1;
  }

  return { enqueued, skipped, existing, periodKey };
}
