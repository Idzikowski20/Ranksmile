/**
 * One analysis per domain at a time.
 *
 * The domain-setup pipeline (keywords → topics → competitors → recommendations) and the
 * AI Visibility scan both rewrite domain-level tables the rest of the product reads.
 * Content creation on top of a half-built domain, or two pipelines materialising into
 * the same rows, is what "nobody messes anything up" guards against — so while one runs,
 * the other and every content-creation entry point answer 409.
 */
import type { NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '@/database/database';

export type DomainBusyReason = 'domain_setup' | 'ai_visibility_scan';

const SETUP_ACTIVE = ['queued', 'running', 'finalizing'];
const SCAN_ACTIVE = ['queued', 'running'];

async function rows<T extends object>(sql: string, replacements: unknown[]): Promise<T[]> {
  const r = await db.query<T>(sql, { replacements, type: QueryTypes.SELECT });
  return (Array.isArray(r) ? r : []) as unknown as T[];
}

/** The domain-setup job is still working on this domain. */
export async function isDomainSetupRunning(domainId: number): Promise<boolean> {
  const r = await rows<{ status: string }>(
    'SELECT status FROM analysis_jobs WHERE id = ? LIMIT 1',
    [`dsetup_${domainId}`],
  );
  return !!r[0] && SETUP_ACTIVE.includes(r[0].status);
}

/** An AI Visibility scan is queued or running for this domain. */
export async function isAiVisScanRunning(domainId: number): Promise<boolean> {
  const r = await rows<{ id: number }>(
    `SELECT s.id FROM ai_vis_scans s
       JOIN ai_vis_configs c ON c.id = s.config_id
      WHERE c.domain_id = ? AND s.status IN ('queued','running')
      LIMIT 1`,
    [domainId],
  ).catch(() => []);
  return r.length > 0;
}

/** Which pipeline holds the domain, if any. Checked in the order a user would notice. */
export async function domainBusyReason(domainId: number): Promise<DomainBusyReason | null> {
  if (await isDomainSetupRunning(domainId)) return 'domain_setup';
  if (await isAiVisScanRunning(domainId)) return 'ai_visibility_scan';
  return null;
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
  const reason = only
    ? ((only === 'domain_setup' ? await isDomainSetupRunning(domainId) : await isAiVisScanRunning(domainId)) ? only : null)
    : await domainBusyReason(domainId);
  if (!reason) return false;
  res.status(409).json({ error: 'DOMAIN_BUSY', reason, message: DOMAIN_BUSY_MESSAGE[reason] });
  return true;
}

export { SCAN_ACTIVE, SETUP_ACTIVE };
