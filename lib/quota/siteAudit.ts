import {
  closePerRunReservation,
  ensureOrgQuotaBalances,
  findReservationByIdempotency,
  getOrgIdForDomain,
  releaseReservation,
  reserveQuota,
} from './index';
import { getOrgBillingState } from '../orgBilling';
import { getSiteAuditPageLimit, resolvePlanSlug } from '../planLimits';

const EXPIRE_MS = 6 * 60 * 60 * 1000;

export function siteAuditIdempotencyKey(jobId: string): string {
  return `site-audit:${jobId}`;
}

export async function reserveSiteAuditRun(
  domainId: number,
  jobId: string,
  userId?: string | null,
): Promise<{ pageLimit: number; reservationId: number }> {
  const orgId = await getOrgIdForDomain(domainId);
  if (!orgId) throw new Error('Domain has no organization');
  await ensureOrgQuotaBalances(orgId);
  const billing = await getOrgBillingState(orgId);
  const pageLimit = getSiteAuditPageLimit(resolvePlanSlug(billing?.planSlug));
  const existing = await findReservationByIdempotency(orgId, siteAuditIdempotencyKey(jobId));
  if (existing) {
    return { pageLimit: Number(existing.quantity), reservationId: existing.id };
  }
  const row = await reserveQuota({
    orgId,
    meter: 'siteAuditPages',
    quantity: pageLimit,
    idempotencyKey: siteAuditIdempotencyKey(jobId),
    ref: { type: 'domain_setup', id: jobId },
    userId,
    expiresAt: new Date(Date.now() + EXPIRE_MS),
  });
  return { pageLimit, reservationId: row.id };
}

export async function closeSiteAuditRun(domainId: number, jobId: string): Promise<void> {
  const orgId = await getOrgIdForDomain(domainId);
  if (!orgId) return;
  const existing = await findReservationByIdempotency(orgId, siteAuditIdempotencyKey(jobId));
  if (!existing) return;
  if (existing.status === 'reserved') {
    await closePerRunReservation(existing.id);
  }
}

export async function releaseSiteAuditRun(domainId: number, jobId: string): Promise<void> {
  const orgId = await getOrgIdForDomain(domainId);
  if (!orgId) return;
  const existing = await findReservationByIdempotency(orgId, siteAuditIdempotencyKey(jobId));
  if (!existing || existing.status !== 'reserved') return;
  await releaseReservation(existing.id);
}
