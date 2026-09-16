/**
 * One analysis per domain at a time.
 *
 * The domain-setup pipeline (keywords → topics → competitors → recommendations) and the
 * AI Visibility scan both rewrite domain-level tables the rest of the product reads.
 * Content creation on top of a half-built domain, or two pipelines materialising into
 * the same rows, is what "nobody messes anything up" guards against — so while one runs,
 * the other and every content-creation entry point answer 409.
 *
 * This is a best-effort preflight, not a lock: the setup job's own atomic claim
 * (claimJob) and the scan's status row are the real mutual exclusion. A stale row from a
 * crashed worker must not pin the domain busy forever, so a running/queued row past the
 * stale window is treated as free — the same window the pipelines reclaim on.
 */
import type { NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '@/database/database';

export type DomainBusyReason = 'domain_setup' | 'ai_visibility_scan';

const SETUP_ACTIVE = ['queued', 'running', 'finalizing'];
const SCAN_ACTIVE = ['queued', 'running'];
/** A running/queued row older than this is a crashed worker, not live work. */
const STALE_MS = 15 * 60 * 1000;

/** A dialect-agnostic "table not provisioned yet" — dev SQLite, a fresh DB. */
function isMissingTable(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  // A missing *column* also says "does not exist" — that is a schema/query bug, not an
  // absent table, so it must fail closed (busy) rather than read as "never ran, free".
  if (m.includes('column')) return false;
  return m.includes('no such table') || m.includes('does not exist') || m.includes("doesn't exist") || m.includes('undefined table');
}

async function rows<T extends object>(sql: string, replacements: unknown[]): Promise<T[]> {
  const r = await db.query<T>(sql, { replacements, type: QueryTypes.SELECT });
  return (Array.isArray(r) ? r : []) as unknown as T[];
}

const isPg = !!process.env.DATABASE_URL;

/**
 * Stale-window cutoff, matched to how the dialect stores timestamps. Postgres columns are
 * timestamptz, so ISO compares correctly. SQLite's CURRENT_TIMESTAMP writes offset-less
 * 'YYYY-MM-DD HH:MM:SS' (UTC), and comparing that against ISO 'YYYY-MM-DDTHH:MM:SSZ' fails
 * lexically (space < 'T'), reading fresh rows as stale — so pass the SQLite shape and wrap
 * both sides in datetime().
 */
function staleCutoff(): string {
  const d = new Date(Date.now() - STALE_MS);
  return isPg ? d.toISOString() : d.toISOString().slice(0, 19).replace('T', ' ');
}

/** The domain-setup job is still working on this domain (and has not gone stale). */
export async function isDomainSetupRunning(domainId: number): Promise<boolean> {
  const cutoff = staleCutoff();
  try {
    const r = await rows<{ status: string }>(
      `SELECT status FROM analysis_jobs
        WHERE id = ? AND ${isPg ? 'updated_at >= ?' : 'datetime(updated_at) >= datetime(?)'} LIMIT 1`,
      [`dsetup_${domainId}`, cutoff],
    );
    return !!r[0] && SETUP_ACTIVE.includes(r[0].status);
  } catch (err) {
    // A missing table means no pipeline has ever run here — free. Any other DB error is
    // real: fail closed (treat as busy) rather than let two pipelines race.
    if (isMissingTable(err)) return false;
    throw err;
  }
}

/** An AI Visibility scan is queued or running (and not stale) for this domain. */
export async function isAiVisScanRunning(domainId: number): Promise<boolean> {
  const cutoff = staleCutoff();
  try {
    const r = await rows<{ id: number }>(
      // ai_vis_scans has no updated_at; started_at is null while queued, so fall back to
      // created_at for the stale-window check.
      `SELECT s.id FROM ai_vis_scans s
         JOIN ai_vis_configs c ON c.id = s.config_id
        WHERE c.domain_id = ? AND s.status IN ('queued','running')
          AND ${isPg
            ? 'COALESCE(s.started_at, s.created_at) >= ?'
            : 'datetime(COALESCE(s.started_at, s.created_at)) >= datetime(?)'}
        LIMIT 1`,
      [domainId, cutoff],
    );
    return r.length > 0;
  } catch (err) {
    if (isMissingTable(err)) return false;
    throw err;
  }
}

/** Which pipeline holds the domain, if any. Checked in the order a user would notice. */
export async function domainBusyReason(domainId: number): Promise<DomainBusyReason | null> {
  if (await isDomainSetupRunning(domainId)) return 'domain_setup';
  if (await isAiVisScanRunning(domainId)) return 'ai_visibility_scan';
  return null;
}

/** Same as domainBusyReason, narrowed to one pipeline when `only` is given. */
export async function isDomainBusy(domainId: number, only?: DomainBusyReason): Promise<DomainBusyReason | null> {
  if (only === 'domain_setup') return (await isDomainSetupRunning(domainId)) ? 'domain_setup' : null;
  if (only === 'ai_visibility_scan') return (await isAiVisScanRunning(domainId)) ? 'ai_visibility_scan' : null;
  return domainBusyReason(domainId);
}

export const DOMAIN_BUSY_MESSAGE: Record<DomainBusyReason, string> = {
  domain_setup: 'Domain analysis is still running. Wait for it to finish, then try again.',
  ai_visibility_scan: 'An AI Visibility scan is still running. Wait for it to finish, then try again.',
};

/**
 * Answer 409 and return true when the domain is held by a pipeline the caller must not
 * run alongside. `only` narrows the check — run-setup, for instance, is blocked by a scan
 * but not by itself.
 */
export async function rejectIfDomainBusy(
  res: NextApiResponse,
  domainId: number,
  only?: DomainBusyReason,
): Promise<boolean> {
  const reason = await isDomainBusy(domainId, only);
  if (!reason) return false;
  res.status(409).json({ error: 'DOMAIN_BUSY', reason, message: DOMAIN_BUSY_MESSAGE[reason] });
  return true;
}

export { SCAN_ACTIVE, SETUP_ACTIVE, STALE_MS };
