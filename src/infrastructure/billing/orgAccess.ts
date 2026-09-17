import { projectBillingState } from '@/src/infrastructure/appAccess/resolveAppState';
import { isPaymentFailedLocked } from '@/src/infrastructure/billing/paymentFailedLock';
import { getOrgBillingStateFresh } from '@/src/infrastructure/billing/stripeBillingReconcile';
import { queryOne } from '@/src/infrastructure/db/query';

/** The billing verdict the API gate gives a signed-in member: only TRIAL / ACTIVE may use the product. */
export async function orgHasBillingAccess(orgId: number): Promise<boolean> {
  const billing = await getOrgBillingStateFresh(orgId);
  const state = projectBillingState({
    subscriptionStatus: billing?.subscriptionStatus ?? null,
    paymentFailedLocked: isPaymentFailedLocked(billing),
    currentPeriodEnd: billing?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: billing?.cancelAtPeriodEnd ?? false,
    trialEndsAt: billing?.trialEndsAt ?? null,
  });
  return state === 'TRIAL' || state === 'ACTIVE';
}

async function orgIdOfDomain(domainId: number): Promise<number | null> {
  const row = await queryOne<{ org_id: number | string | null }>(
    'SELECT w.org_id FROM domain d JOIN workspaces w ON w.id = d.workspace_id WHERE d."ID" = ? LIMIT 1',
    [domainId],
  );
  const orgId = Number(row?.org_id);
  return Number.isFinite(orgId) && orgId > 0 ? orgId : null;
}

/**
 * Billing check for cron sweeps and other session-less work. withOrgPaymentAccess lets
 * cron-secret requests through (it has no org to check), so every job that acts on an
 * org's data must ask here. Fails closed: no org, or a lookup error, skips the work —
 * the next tick retries. Memoized per instance; create one per sweep.
 */
export function createBillingAccessCheck() {
  const byOrg = new Map<number, Promise<boolean>>();

  const forOrg = (orgId: number | null | undefined): Promise<boolean> => {
    if (orgId == null) return Promise.resolve(false);
    let verdict = byOrg.get(orgId);
    if (!verdict) {
      verdict = orgHasBillingAccess(orgId).catch((err: unknown) => {
        console.warn('[billing] access check failed, skipping org', orgId, err);
        return false;
      });
      byOrg.set(orgId, verdict);
    }
    return verdict;
  };

  const forDomain = async (domainId: number | null | undefined): Promise<boolean> => {
    if (domainId == null) return false;
    const orgId = await orgIdOfDomain(domainId).catch((err: unknown) => {
      console.warn('[billing] domain org lookup failed, skipping domain', domainId, err);
      return null;
    });
    return forOrg(orgId);
  };

  return { forOrg, forDomain };
}

/**
 * Pages a cron candidate query until `limit` rows pass `keep`. A LIMIT applied before the
 * billing filter lets unpaid orgs' rows — which never change status — fill every batch
 * and starve paid ones. `denied` counts rows `keep` rejected.
 */
// ponytail: OFFSET paging capped at maxPages; move the org filter into SQL if unpaid rows
// ever outnumber limit × maxPages.
export async function collectAllowed<T>(
  fetchPage: (offset: number, pageSize: number) => Promise<T[]>,
  keep: (row: T) => Promise<boolean>,
  limit: number,
  maxPages = 10,
): Promise<{ rows: T[]; denied: number }> {
  const rows: T[] = [];
  let denied = 0;
  for (let page = 0; page < maxPages && rows.length < limit; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const batch = await fetchPage(page * limit, limit);
    for (const row of batch) {
      if (rows.length >= limit) break;
      // eslint-disable-next-line no-await-in-loop
      if (await keep(row)) rows.push(row);
      else denied += 1;
    }
    if (batch.length < limit) break;
  }
  return { rows, denied };
}
