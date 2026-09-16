import {
  closePerRunReservation,
  ensureOrgQuotaBalances,
  findActiveReservationByRef,
  findReservationByIdempotency,
  getOrgIdForDomain,
  releaseReservation,
  reserveQuota,
} from '@/src/infrastructure/quota/index';
import { getOrgBillingState } from '@/src/infrastructure/billing/orgBilling';
import { getSiteAuditPageLimit, resolvePlanSlug } from '@/src/infrastructure/billing/planLimits';

const EXPIRE_MS = 6 * 60 * 60 * 1000;
const REF_TYPE = 'domain_setup';

/**
 * Per-run key so each campaign (including a rerun of the same deterministic jobId) makes
 * its own reservation and re-checks the plan limit — a stable `site-audit:${jobId}` key
 * would reuse a prior closed/released reservation and skip the limit on every rerun.
 */
export function siteAuditIdempotencyKey(jobId: string, runKey: string): string {
  return `site-audit:${jobId}:${runKey}`;
}

export async function reserveSiteAuditRun(
  domainId: number,
  jobId: string,
  runKey: string,
  userId?: string | null,
): Promise<{ pageLimit: number; reservationId: number }> {
  const orgId = await getOrgIdForDomain(domainId);
  if (!orgId) throw new Error('Domain has no organization');
  await ensureOrgQuotaBalances(orgId);
  const billing = await getOrgBillingState(orgId);
  const pageLimit = getSiteAuditPageLimit(resolvePlanSlug(billing?.planSlug));
  const key = siteAuditIdempotencyKey(jobId, runKey);
  const existing = await findReservationByIdempotency(orgId, key);
  if (existing) {
    return { pageLimit: Number(existing.quantity), reservationId: existing.id };
  }
  const row = await reserveQuota({
    orgId,
    meter: 'siteAuditPages',
    quantity: pageLimit,
    idempotencyKey: key,
    ref: { type: REF_TYPE, id: jobId },
    userId,
    expiresAt: new Date(Date.now() + EXPIRE_MS),
  });
  return { pageLimit, reservationId: row.id };
}

// close/release look up the active reservation by ref (the run's per-run key is not known
// here) — the latest 'reserved' one for this jobId is the current run's.
export async function closeSiteAuditRun(domainId: number, jobId: string): Promise<void> {
  const orgId = await getOrgIdForDomain(domainId);
  if (!orgId) return;
  const existing = await findActiveReservationByRef(orgId, REF_TYPE, jobId);
  if (existing && existing.status === 'reserved') {
    await closePerRunReservation(existing.id);
  }
}

export async function releaseSiteAuditRun(domainId: number, jobId: string): Promise<void> {
  const orgId = await getOrgIdForDomain(domainId);
  if (!orgId) return;
  const existing = await findActiveReservationByRef(orgId, REF_TYPE, jobId);
  if (existing && existing.status === 'reserved') {
    await releaseReservation(existing.id);
  }
}
