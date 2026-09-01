import type { NextApiRequest, NextApiResponse } from 'next';
import { getCheckoutPlan } from '@/src/core/domain/billing/plans';
import { hasActiveBillingEntitlement } from '@/src/infrastructure/billing/billingEntitlement';
import { getOrgBillingState } from '@/src/infrastructure/billing/orgBilling';
import {
  buildPlanMetrics,
  DEFAULT_PLAN_SLUG,
  formatPlanStatus,
  overallUsagePct,
  resolvePlanSlug,
  type PlanSummaryData,
} from '@/src/infrastructure/billing/planLimits';
import { getOrgPlanUsage } from '@/src/infrastructure/billing/planUsage';
import { ensureUserTenancy } from '@/src/infrastructure/identity/tenancy';
import { getCurrentUserId } from '../../../utils/getUser';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { orgId } = await ensureUserTenancy(userId);
  const billing = await getOrgBillingState(orgId);
  const entitled = hasActiveBillingEntitlement(billing);
  const planSlug = entitled ? resolvePlanSlug(billing?.planSlug) : DEFAULT_PLAN_SLUG;
  const plan = getCheckoutPlan(planSlug);
  const usage = await getOrgPlanUsage(orgId);
  const metrics = buildPlanMetrics(planSlug, usage);

  const summary: PlanSummaryData = {
    planSlug,
    planName: plan?.name ?? 'Growth',
    billingPeriod: entitled ? (billing?.billingPeriod ?? null) : null,
    subscriptionStatus: billing?.subscriptionStatus ?? null,
    trialEndsAt: billing?.trialEndsAt ?? null,
    currentPeriodEnd: billing?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: billing?.cancelAtPeriodEnd ?? false,
    metrics,
    overallPct: overallUsagePct(metrics),
  };

  return res.status(200).json({
    summary,
    statusLine: formatPlanStatus(summary.subscriptionStatus, summary.trialEndsAt, summary.billingPeriod),
  });
}

export default withOrgPaymentAccess(handler);
