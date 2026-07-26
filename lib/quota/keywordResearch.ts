import { queryOne } from '../db/query';
import {
  commitReservation,
  ensureOrgQuotaBalances,
  findActiveReservationByRef,
  getOrgIdForDomain,
  releaseReservation,
  reserveQuota,
} from './index';
import { calendarPeriodKey } from './period';

const REF_TYPE = 'keyword_research';
const EXPIRE_MS = 2 * 60 * 60 * 1000;

/** Reserve 1 KW run for the period after enqueue; release if reserve fails (caller should fail the run). */
export async function reserveKeywordResearchQuota(
  domainId: number,
  researchId: number,
  userId?: string | null,
): Promise<void> {
  const orgId = await getOrgIdForDomain(domainId);
  if (!orgId) throw new Error('Domain has no organization');
  await ensureOrgQuotaBalances(orgId);
  const run = await queryOne<{ created_at: string }>(
    'SELECT created_at FROM keyword_research_runs WHERE id = ? LIMIT 1',
    [researchId],
  );
  const createdAt = run?.created_at ? String(run.created_at) : String(researchId);
  const periodKey = calendarPeriodKey();
  const idempotencyKey = `kw:${researchId}:${createdAt}`;
  await reserveQuota({
    orgId,
    meter: 'keywordResearch',
    quantity: 1,
    idempotencyKey,
    periodKey,
    ref: { type: REF_TYPE, id: String(researchId) },
    userId,
    expiresAt: new Date(Date.now() + EXPIRE_MS),
  });
}

export async function settleKeywordResearchQuota(
  domainId: number,
  researchId: number,
  outcome: 'commit' | 'release',
): Promise<void> {
  const orgId = await getOrgIdForDomain(domainId);
  if (!orgId) return;
  const res = await findActiveReservationByRef(orgId, REF_TYPE, String(researchId));
  if (!res) return;
  if (outcome === 'commit') await commitReservation(res.id);
  else await releaseReservation(res.id);
}
