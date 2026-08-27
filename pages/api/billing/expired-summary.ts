import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import { getCheckoutPlan } from '../../../lib/billing/billingPlans';
import { getOrgBillingState } from '../../../lib/orgBilling';
import { countActionableRecommendations, type RecFilterable } from '../../../lib/recommendations';
import { ensurePipelineTables } from '../../../lib/ensurePipelineTables';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUserId } from '../../../utils/getUser';
import { getUserDomainIds } from '../articles/index';

export type ExpiredSummary = {
  sites: string[];
  articles: number;
  recommendations: number;
  plan: { slug: string; name: string; priceMonthly: number; priceYearly: number } | null;
};

/**
 * Counts for the plan-expired block — deliberately NOT behind withOrgPaymentAccess.
 *
 * The screen exists to tell a lapsed account what it built, and every endpoint it
 * would naturally read (/api/domains, /api/articles, /api/billing/plan-summary) is
 * payment-gated, so they all 402 for exactly the user this screen is for. The cards
 * rendered "No sites yet" and two zeros.
 *
 * Scope is kept to what the block renders: site names and two integers. No article
 * bodies, no recommendation text — losing access still means losing the content.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ExpiredSummary | { error: string }>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { orgId } = await ensureUserTenancy(userId);
  const domainIds = await getUserDomainIds(userId, req);

  let sites: string[] = [];
  let articles = 0;
  let recommendations = 0;

  if (domainIds.length > 0) {
    const placeholders = domainIds.map(() => '?').join(',');

    // Quoted: the column is `"ID"`, and unquoted Postgres folds it to `id`, which does
    // not exist — the whole summary request failed for any expired account with a site.
    // Every other query in the codebase quotes it (lib/domainLanguage, lib/domainPipeline).
    const domainRows = await db.query(
      `SELECT domain FROM domain WHERE "ID" IN (${placeholders}) ORDER BY domain`,
      { replacements: domainIds, type: QueryTypes.SELECT },
    ) as Array<{ domain: string }>;
    sites = domainRows.map((r) => r.domain).filter(Boolean);

    // COUNT, not the row list: /api/articles caps at a page size, so counting the
    // returned array would have under-reported anyone past the first page.
    const articleRows = await db.query(
      `SELECT COUNT(*) AS total FROM articles WHERE domain_id IN (${placeholders})`,
      { replacements: domainIds, type: QueryTypes.SELECT },
    ) as Array<{ total: number | string }>;
    articles = Number(articleRows[0]?.total ?? 0);

    // domain_recommendations is created by ensurePipelineTables, which nothing on this
    // path calls: an account that added a site but never ran the pipeline hit a missing
    // relation and lost the entire summary, sites and article count included.
    await ensurePipelineTables();
    const recRows = await db.query(
      `SELECT type, score FROM domain_recommendations WHERE domain_id IN (${placeholders})`,
      { replacements: domainIds, type: QueryTypes.SELECT },
    ) as RecFilterable[];
    // Same predicate as the sidebar badge, so the two can never disagree.
    recommendations = countActionableRecommendations(recRows);
  }

  const billing = await getOrgBillingState(orgId);
  const plan = getCheckoutPlan(billing?.planSlug ?? 'growth') ?? null;

  return res.status(200).json({
    sites,
    articles,
    recommendations,
    plan: plan
      ? {
        slug: plan.slug,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
      }
      : null,
  });
}

export default handler;
