import { getCheckoutPlan } from '../billingPlans';
import { getOrgBillingState } from '../orgBilling';
import { getSiteAuditPageLimit, resolvePlanSlug } from '../planLimits';
import { ensureUserTenancy } from '../tenancy';

export type SiteAuditLimitInfo = {
  pagesLimit: number;
  planSlug: string;
  planName: string;
  canUpgradeForMore: boolean;
  upgradePlanSlug: string | null;
  upgradePlanName: string | null;
  upgradePagesLimit: number | null;
};

export async function resolveSiteAuditPageLimit(userId: string): Promise<SiteAuditLimitInfo> {
  const { orgId } = await ensureUserTenancy(userId);
  const billing = await getOrgBillingState(orgId);
  const planSlug = resolvePlanSlug(billing?.planSlug);
  const plan = getCheckoutPlan(planSlug);
  const pagesLimit = getSiteAuditPageLimit(planSlug);
  const canUpgradeForMore = planSlug !== 'agency';
  const upgradePlan = canUpgradeForMore ? getCheckoutPlan('agency') : null;

  return {
    pagesLimit,
    planSlug,
    planName: plan?.name ?? 'Growth',
    canUpgradeForMore,
    upgradePlanSlug: upgradePlan?.slug ?? null,
    upgradePlanName: upgradePlan?.name ?? null,
    upgradePagesLimit: canUpgradeForMore ? getSiteAuditPageLimit('agency') : null,
  };
}
