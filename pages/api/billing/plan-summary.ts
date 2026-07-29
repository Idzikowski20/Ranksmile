import type { NextApiRequest, NextApiResponse } from 'next';
import { getCheckoutPlan } from '../../../lib/billingPlans';
import { getOrgBillingState } from '../../../lib/orgBilling';
import {
  buildPlanMetrics,
  formatPlanStatus,
  overallUsagePct,
  resolvePlanSlug,
  type PlanSummaryData,
} from '../../../lib/planLimits';
import { getOrgPlanUsage } from '../../../lib/planUsage';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUserId } from '../../../utils/getUser';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { orgId } = await ensureUserTenancy(userId);
  const billing = await getOrgBillingState(orgId);
  const planSlug = resolvePlanSlug(billing?.planSlug);
  const plan = getCheckoutPlan(planSlug);
  const usage = await getOrgPlanUsage(orgId);
  const metrics = buildPlanMetrics(planSlug, usage);

  const summary: PlanSummaryData = {
    planSlug,
    planName: plan?.name ?? 'Growth',
    billingPeriod: billing?.billingPeriod ?? null,
    subscriptionStatus: billing?.subscriptionStatus ?? null,
    trialEndsAt: billing?.trialEndsAt ?? null,
    currentPeriodEnd: billing?.currentPeriodEnd ?? null,
    metrics,
    overallPct: overallUsagePct(metrics),
  };

  return res.status(200).json({
    summary,
    statusLine: formatPlanStatus(summary.subscriptionStatus, summary.trialEndsAt, summary.billingPeriod),
  });
}

export default withOrgPaymentAccess(handler);
