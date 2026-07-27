/**
 * Stateful in-memory mock — email outbox claim / retry / poller without live Postgres.
 */
jest.mock('../../lib/ensureNotificationEmailTables', () => ({
  ensureNotificationEmailTables: jest.fn().mockResolvedValue(undefined),
}));

type Job = {
  id: number;
  idempotency_key: string;
  type: string;
  org_id: number;
  domain_id: number;
  domain: string;
  to_email: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  skip_reason: string | null;
  provider_msg_id: string | null;
  next_attempt_at: string;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  dlq_at: string | null;
};

const store: { jobs: Map<number, Job>; nextId: number } = {
  jobs: new Map(),
  nextId: 1,
};

function resetStore(): void {
  store.jobs.clear();
  store.nextId = 1;
}

const mockProcessEmailJob = jest.fn(async (dbJobId: number) => {
  const j = store.jobs.get(dbJobId);
  if (j && ['queued', 'failed'].includes(j.status)) {
    j.status = 'sent';
    j.sent_at = new Date().toISOString();
  }
});

jest.mock('../../lib/notifications/emailWorker', () => ({
  processEmailJob: (...args: unknown[]) => mockProcessEmailJob(...(args as [number])),
}));

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(async (sql: string, opts?: { replacements?: unknown[] }) => {
      const s = String(sql);
      const r = opts?.replacements ?? [];

      if (s.includes('INSERT INTO notification_email_jobs') && s.includes('ON CONFLICT')) {
        const [key, type, orgId, domainId, domain, toEmail, maxAttempts] = r as [
          string, string, number, number, string, string, number,
        ];
        for (const j of store.jobs.values()) {
          if (j.idempotency_key === key) return [[], {}];
        }
        const id = store.nextId++;
        const now = new Date().toISOString();
        store.jobs.set(id, {
          id,
          idempotency_key: key,
          type,
          org_id: orgId,
          domain_id: domainId,
          domain,
          to_email: toEmail,
          status: 'queued',
          attempts: 0,
          max_attempts: maxAttempts,
          last_error: null,
          skip_reason: null,
          provider_msg_id: null,
          next_attempt_at: now,
          created_at: now,
          updated_at: now,
          sent_at: null,
          dlq_at: null,
        });
        return [[{ id }], {}];
      }

      if (s.includes("SET status = 'running'") && s.includes('RETURNING')) {
        const id = Number(r[0]);
        const j = store.jobs.get(id);
        if (!j) return [[], {}];
        const due = new Date(j.next_attempt_at).getTime() <= Date.now();
        if (!['queued', 'failed'].includes(j.status) || !due || j.attempts >= j.max_attempts) {
          return [[], {}];
        }
        j.status = 'running';
        j.attempts += 1;
        j.updated_at = new Date().toISOString();
        return [[j], {}];
      }

      if (s.includes("SET status = 'sent'")) {
        const id = Number(r[r.length - 1]);
        const j = store.jobs.get(id);
        if (j) {
          j.status = 'sent';
          j.sent_at = new Date().toISOString();
          j.updated_at = j.sent_at;
          j.provider_msg_id = (r[0] as string | null) ?? j.provider_msg_id;
          j.last_error = null;
        }
        return [[], {}];
      }

      if (s.includes("SET status = 'failed'")) {
        const [error, nextAt, id] = r as [string, string, number];
        const j = store.jobs.get(id);
        if (j) {
          j.status = 'failed';
          j.last_error = error;
          j.next_attempt_at = nextAt;
          j.updated_at = new Date().toISOString();
        }
        return [[], {}];
      }

      if (s.includes("SET status = 'dlq'")) {
        const [error, id] = r as [string, number];
        const j = store.jobs.get(id);
        if (j) {
          j.status = 'dlq';
          j.last_error = error;
          j.dlq_at = new Date().toISOString();
          j.updated_at = j.dlq_at;
        }
        return [[], {}];
      }

      if (s.includes("SET status = 'skipped'")) {
        const [reason, id] = r as [string, number];
        const j = store.jobs.get(id);
        if (j) {
          j.status = 'skipped';
          j.skip_reason = reason;
          j.updated_at = new Date().toISOString();
        }
        return [[], {}];
      }

      if (s.includes('stale running recovered') || (s.includes("CASE WHEN attempts >= max_attempts") && s.includes('running'))) {
        const cutoff = String(r[0]);
        const out: Job[] = [];
        for (const j of store.jobs.values()) {
          if (j.status !== 'running') continue;
          if (j.updated_at >= cutoff) continue;
          if (j.attempts >= j.max_attempts) {
            j.status = 'dlq';
            j.dlq_at = new Date().toISOString();
          } else {
            j.status = 'queued';
            j.next_attempt_at = new Date().toISOString();
          }
          j.last_error = j.last_error || 'stale running recovered';
          j.updated_at = new Date().toISOString();
          out.push(j);
        }
        return [out.map((j) => ({ id: j.id, idempotency_key: j.idempotency_key, status: j.status })), {}];
      }

      if (s.includes('FROM notification_email_jobs') && s.includes("status IN ('queued', 'failed')")) {
        const due = [...store.jobs.values()]
          .filter(
            (j) =>
              ['queued', 'failed'].includes(j.status)
              && new Date(j.next_attempt_at).getTime() <= Date.now()
              && j.attempts < j.max_attempts,
          )
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .slice(0, Number(r[0] ?? 100));
        return [due.map((j) => ({ id: j.id, idempotency_key: j.idempotency_key })), {}];
      }

      if (s.includes('SELECT * FROM notification_email_jobs WHERE id')) {
        const j = store.jobs.get(Number(r[0]));
        return [j ? [j] : [], {}];
      }

      return [[], {}];
    }),
  },
}));

import {
  claimEmailJob,
  markEmailSent,
  markEmailFailed,
  markEmailDlq,
  recoverStaleEmailJobs,
} from '../../lib/notifications/emailJobState';
import { enqueueKeywordPositionEmails } from '../../lib/notifications/emailQueue';
import { reconcileEmailOutbox } from '../../lib/notifications/emailOutboxReconciler';

describe('email outbox queue + state', () => {
  beforeEach(() => {
    resetStore();
    mockProcessEmailJob.mockClear();
  });

  it('idempotent enqueue — second call counts existing', async () => {
    const domains = [{
      domainId: 42, domain: 'a.com', orgId: 1, notification: true, notificationEmails: 'a@x.com',
    }];
    const r1 = await enqueueKeywordPositionEmails({
      domains, defaultToEmail: '', notificationInterval: 'daily',
    });
    const r2 = await enqueueKeywordPositionEmails({
      domains, defaultToEmail: '', notificationInterval: 'daily',
    });
    expect(r1.enqueued).toBe(1);
    expect(r2.existing).toBe(1);
    expect(store.jobs.size).toBe(1);
  });

  it('pre-INSERT skips disabled / missing recipient / missing org', async () => {
    const r = await enqueueKeywordPositionEmails({
      domains: [
        { domainId: 1, domain: 'a.com', orgId: 1, notification: false, notificationEmails: 'a@x.com' },
        { domainId: 2, domain: 'b.com', orgId: 1, notification: true, notificationEmails: '' },
        { domainId: 3, domain: 'c.com', orgId: null, notification: true, notificationEmails: 'c@x.com' },
      ],
      defaultToEmail: '',
      notificationInterval: 'daily',
    });
    expect(r.skipped).toBe(3);
    expect(r.enqueued).toBe(0);
    expect(store.jobs.size).toBe(0);
  });

  it('INSERT enqueues; poll processes due jobs', async () => {
    const r = await enqueueKeywordPositionEmails({
      domains: [{
        domainId: 42, domain: 'a.com', orgId: 1, notification: true, notificationEmails: 'a@x.com',
      }],
      defaultToEmail: '',
      notificationInterval: 'daily',
    });
    expect(r.enqueued).toBe(1);
    expect([...store.jobs.values()][0]?.status).toBe('queued');
    const recon = await reconcileEmailOutbox();
    expect(recon.processed).toBeGreaterThanOrEqual(1);
    expect(mockProcessEmailJob).toHaveBeenCalled();
  });

  it('atomic claim — second claim returns null', async () => {
    await enqueueKeywordPositionEmails({
      domains: [{
        domainId: 42, domain: 'a.com', orgId: 1, notification: true, notificationEmails: 'a@x.com',
      }],
      defaultToEmail: '',
      notificationInterval: 'daily',
    });
    const id = [...store.jobs.keys()][0];
    const a = await claimEmailJob(id);
    const b = await claimEmailJob(id);
    expect(a?.status).toBe('running');
    expect(a?.attempts).toBe(1);
    expect(b).toBeNull();
  });

  it('DLQ after max attempts', async () => {
    await enqueueKeywordPositionEmails({
      domains: [{
        domainId: 42, domain: 'a.com', orgId: 1, notification: true, notificationEmails: 'a@x.com',
      }],
      defaultToEmail: '',
      notificationInterval: 'daily',
    });
    const id = [...store.jobs.keys()][0];
    store.jobs.get(id)!.max_attempts = 2;
    await claimEmailJob(id);
    await markEmailFailed(id, 'boom', new Date(Date.now() - 1000));
    await claimEmailJob(id);
    await markEmailDlq(id, 'boom');
    expect(store.jobs.get(id)?.status).toBe('dlq');
  });

  /**
   * Accepted at-least-once: crash after SMTP accept before markSent → stale recover → second claim.
   * Duplicate delivery is expected (plan invariant #1).
   */
  it('crash-after-send: stale recover allows second claim (duplicate SMTP accepted)', async () => {
    await enqueueKeywordPositionEmails({
      domains: [{
        domainId: 42, domain: 'a.com', orgId: 1, notification: true, notificationEmails: 'a@x.com',
      }],
      defaultToEmail: '',
      notificationInterval: 'daily',
    });
    const id = [...store.jobs.keys()][0];
    await claimEmailJob(id);
    store.jobs.get(id)!.updated_at = new Date(Date.now() - 16 * 60_000).toISOString();
    const recovered = await recoverStaleEmailJobs(15 * 60_000);
    expect(recovered[0]?.status).toBe('queued');
    const again = await claimEmailJob(id);
    expect(again?.attempts).toBe(2);
    await markEmailSent(id, 'msg-2');
    expect(store.jobs.get(id)?.status).toBe('sent');
    expect(store.jobs.get(id)?.attempts).toBe(2);
  });
});
