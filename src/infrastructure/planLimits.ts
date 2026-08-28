import type { BillingPeriod } from '@/src/core/domain/billing/plans';
import type { PlanSlug } from '@/src/core/domain/billing/prices';
import type { OrgPlanUsage } from '@/src/infrastructure/planUsage';

/** Quota meter kinds — see docs/superpowers/specs/2026-07-26-plan-quotas-ledger-design.md */
export type MeterKind = 'active_resource' | 'period_usage' | 'per_run_cap';

export type QuotaMeter =
  | 'documents'
  | 'aiPrompts'
  | 'brandSpaces'
  | 'keywordResearch'
  | 'siteAuditPages';

export const METER_KIND: Record<QuotaMeter, MeterKind> = {
  documents: 'active_resource',
  aiPrompts: 'active_resource',
  brandSpaces: 'active_resource',
  keywordResearch: 'period_usage',
  siteAuditPages: 'per_run_cap',
};

export const ACTIVE_PERIOD_KEY = '_';

export interface PlanLimitDefinition {
  key: QuotaMeter | string;
  label: string;
  limit: number | null;
}

export interface PlanLimitMetric extends PlanLimitDefinition {
  used: number;
  pct: number | null;
}

export interface PlanSummaryData {
  planSlug: PlanSlug | 'starter';
  planName: string;
  billingPeriod: BillingPeriod | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  /** Subscription set to lapse at currentPeriodEnd — drives "Ends" vs "Renews". */
  cancelAtPeriodEnd: boolean;
  metrics: PlanLimitMetric[];
  overallPct: number;
}

export const PLAN_LIMITS: Record<PlanSlug | 'starter', PlanLimitDefinition[]> = {
  starter: [
    { key: 'documents', label: 'Documents', limit: 10 },
    { key: 'aiPrompts', label: 'AI Prompts', limit: 15 },
    { key: 'brandSpaces', label: 'Brand Spaces', limit: 1 },
    { key: 'keywordResearch', label: 'Keyword Research / mo', limit: 50 },
    { key: 'siteAuditPages', label: 'Site Audit pages / crawl', limit: 100 },
  ],
  growth: [
    { key: 'documents', label: 'Documents', limit: 30 },
    { key: 'aiPrompts', label: 'AI Prompts', limit: 50 },
    { key: 'brandSpaces', label: 'Brand Spaces', limit: 5 },
    { key: 'keywordResearch', label: 'Keyword Research / mo', limit: 200 },
    { key: 'siteAuditPages', label: 'Site Audit pages / crawl', limit: 100 },
  ],
  scale: [
    { key: 'documents', label: 'Documents', limit: 100 },
    { key: 'aiPrompts', label: 'AI Prompts', limit: 100 },
    { key: 'brandSpaces', label: 'Brand Spaces', limit: 15 },
    { key: 'keywordResearch', label: 'Keyword Research / mo', limit: 500 },
    { key: 'siteAuditPages', label: 'Site Audit pages / crawl', limit: 100 },
  ],
  agency: [
    { key: 'documents', label: 'Documents', limit: null },
    { key: 'aiPrompts', label: 'AI Prompts', limit: 250 },
    { key: 'brandSpaces', label: 'Brand Spaces', limit: null },
    { key: 'keywordResearch', label: 'Keyword Research / mo', limit: 2000 },
    { key: 'siteAuditPages', label: 'Site Audit pages / crawl', limit: 1000 },
  ],
};

export const DEFAULT_PLAN_SLUG: PlanSlug = 'growth';

export const SITE_AUDIT_PAGE_LIMITS: Record<PlanSlug | 'starter', number> = {
  starter: 100,
  growth: 100,
  scale: 100,
  agency: 1000,
};

export const DEFAULT_SITE_AUDIT_PAGE_LIMIT = 100;

export function getSiteAuditPageLimit(planSlug: PlanSlug | 'starter' | null | undefined): number {
  if (!planSlug) return DEFAULT_SITE_AUDIT_PAGE_LIMIT;
  return SITE_AUDIT_PAGE_LIMITS[planSlug] ?? DEFAULT_SITE_AUDIT_PAGE_LIMIT;
}

export function resolvePlanSlug(slug: string | null | undefined): PlanSlug | 'starter' {
  if (slug === 'starter' || slug === 'growth' || slug === 'scale' || slug === 'agency') return slug;
  return DEFAULT_PLAN_SLUG;
}

export function isQuotaMeter(key: string): key is QuotaMeter {
  return key in METER_KIND;
}

export function getMeterKind(meter: QuotaMeter): MeterKind {
  return METER_KIND[meter];
}

/** Limit for a meter from current plan — source of truth (never read from balances). */
export function getPlanMeterLimit(planSlug: PlanSlug | 'starter', meter: QuotaMeter): number | null {
  const def = PLAN_LIMITS[planSlug].find((d) => d.key === meter);
  return def?.limit ?? null;
}

export function buildPlanMetrics(
  planSlug: PlanSlug | 'starter',
  usage: OrgPlanUsage,
): PlanLimitMetric[] {
  const defs = PLAN_LIMITS[planSlug];
  return defs.map((def) => {
    const key = def.key as keyof OrgPlanUsage;
    const used = usage[key] ?? 0;
    const pct = def.limit == null ? null : Math.min(100, Math.round((used / def.limit) * 100));
    return { ...def, used, pct };
  });
}

export function overallUsagePct(metrics: PlanLimitMetric[]): number {
  const limited = metrics.filter((m) => m.limit != null && m.limit > 0);
  if (!limited.length) return 0;
  const peak = Math.max(...limited.map((m) => m.pct ?? 0));
  return Math.round(peak);
}

/** Remaining trial time as `2d, 10h, 30m` (omits leading zero units). */
export function formatTrialCountdown(endsAt: string | Date, nowMs = Date.now()): string {
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return '';
  const totalMin = Math.max(0, Math.floor((end - nowMs) / 60_000));
  const d = Math.floor(totalMin / (24 * 60));
  const h = Math.floor((totalMin % (24 * 60)) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d, ${h}h, ${m}m`;
  if (h > 0) return `${h}h, ${m}m`;
  return `${m}m`;
}

/**
 * The paid widget's second line: when the plan renews, or when it ends if the
 * subscription is set to lapse. Null when there is no period end to show (no
 * subscription, or an unparseable date), so the caller renders nothing.
 */
export function planEndLine(
  currentPeriodEnd: string | null,
  cancelAtPeriodEnd: boolean,
): string | null {
  if (!currentPeriodEnd) return null;
  const end = new Date(currentPeriodEnd);
  if (Number.isNaN(end.getTime())) return null;
  // timeZone: 'UTC' pins the displayed date to the stored instant's calendar date. Without
  // it, toLocaleDateString uses the host zone, so a period ending 17:01Z reads one day
  // later east of +7 — flaky in tests and off by a day for some users. The period end is
  // a billing civil date; showing the UTC date it was recorded in is stable and correct.
  const date = end.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
  return `${cancelAtPeriodEnd ? 'Ends' : 'Renews'} ${date}`;
}

export function formatPlanStatus(
  subscriptionStatus: string | null,
  trialEndsAt: string | null,
  billingPeriod: BillingPeriod | null,
): string {
  const period = billingPeriod === 'yearly' ? 'Billed yearly' : billingPeriod === 'monthly' ? 'Billed monthly' : 'Subscription';
  if (subscriptionStatus === 'trialing' && trialEndsAt) {
    const date = new Date(trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `Trial · ends ${date}`;
  }
  if (subscriptionStatus === 'active') return `${period} · Active`;
  if (subscriptionStatus === 'past_due') return `${period} · Payment due`;
  if (subscriptionStatus === 'canceled') return 'Canceled';
  if (!subscriptionStatus) return 'No active subscription';
  return `${period} · ${subscriptionStatus}`;
}

export function formatMetricUsage(metric: PlanLimitMetric): string {
  if (metric.limit == null) return `${metric.used} used · Unlimited`;
  return `${metric.used} / ${metric.limit} used`;
}
