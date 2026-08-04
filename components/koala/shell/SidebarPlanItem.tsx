import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'react-query';
import { getCheckoutPlan } from '../../../lib/billingPlans';
import fetchJson from '../../../lib/fetchJson';
import { formatTrialCountdown, type PlanSummaryData } from '../../../lib/planLimits';
import { Icon } from '../icons/Icon';
import { PlanUsageMetricRow } from '../product/PlanUsageMetricRow';
import { Popover } from '../primitives/Popover';
import { brandMain } from '../tokens/colors';

type PlanSummaryResponse = {
  summary: PlanSummaryData;
  statusLine: string;
};

const FALLBACK: PlanSummaryResponse = {
  summary: {
    planSlug: 'growth',
    planName: 'Growth',
    billingPeriod: null,
    subscriptionStatus: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    metrics: [],
    overallPct: 0,
  },
  statusLine: '',
};

/** Top tier — same starry card, Manage instead of Upgrade. */
const MANAGE_SLUGS = new Set(['agency', 'pro', 'business']);

type PlanCardAction =
  | { kind: 'upgrade'; title: React.ReactNode; href: string; cta: string }
  | { kind: 'manage'; title: React.ReactNode; href: string; cta: string };

function planCardAction(planSlug: string, planName: string): PlanCardAction {
  const slug = planSlug.toLowerCase();
  if (MANAGE_SLUGS.has(slug)) {
    return {
      kind: 'manage',
      title: <>{planName} plan</>,
      href: '/settings/billing_subscription',
      cta: 'Manage',
    };
  }
  const em = slug === 'growth'
    ? (getCheckoutPlan('scale')?.name ?? 'Scale')
    : slug === 'scale'
      ? (getCheckoutPlan('agency')?.name ?? 'Agency')
      : 'PRO';
  return {
    kind: 'upgrade',
    title: <>Upgrade to <em>{em}</em></>,
    href: '/plans',
    cta: 'Upgrade now',
  };
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Sidebar plan widget — starry card (Figma `7956:407782`).
 * Lower tiers: Upgrade CTA → /plans. Agency/top: Manage → billing settings.
 * Trial uses the same chrome; countdown via formatTrialCountdown.
 */
export function SidebarPlanItem({ onNavigate }: { onNavigate?: () => void }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const { data, isLoading } = useQuery(
    ['plan-summary-sidebar'],
    () => fetchJson<PlanSummaryResponse>('/api/billing/plan-summary', FALLBACK),
    { staleTime: 60_000, retry: false },
  );

  const summary = data?.summary;
  const statusLine = data?.statusLine ?? '';
  const isTrialing = summary?.subscriptionStatus === 'trialing';
  const trialEndsAt = summary?.trialEndsAt ?? null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isTrialing || !trialEndsAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [isTrialing, trialEndsAt]);

  const openLimits = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    setAnchorRect(el.getBoundingClientRect());
    setOpen(true);
  }, []);

  const closeLimits = useCallback(() => setOpen(false), []);

  if (!summary) return null;

  const totalUsed = summary.metrics.reduce((sum, m) => sum + m.used, 0);
  const badgeTone = summary.overallPct >= 85 ? 'warn' : 'ok';
  const action = planCardAction(summary.planSlug, summary.planName);
  const trialLeft = isTrialing && trialEndsAt ? formatTrialCountdown(trialEndsAt, now) : '';
  const cardSub = trialLeft
    ? `Trial · ${trialLeft}`
    : action.kind === 'manage'
      ? (statusLine || 'Manage billing in settings')
      : 'Cancel anytime in settings';

  const limitsPopover = (
    <Popover
      open={open}
      onClose={closeLimits}
      anchorRect={anchorRect}
      placement="right"
      className="koala-plan-limits"
    >
      <div className="koala-plan-limits__header">
        <div className="koala-plan-limits__info">
          <div className="koala-plan-limits__title-row">
            <Icon name="BatteryMedium" size={20} weight="bold" color={brandMain} />
            <span className="koala-plan-limits__title">Feature Usage</span>
          </div>
          <div className="koala-plan-limits__sales">
            <span className="koala-plan-limits__total">
              {isLoading ? '—' : formatCount(totalUsed)}
            </span>
            <span className={`koala-plan-limits__badge koala-plan-limits__badge--${badgeTone}`}>
              {isLoading
                ? 'Loading…'
                : `${statusLine || summary.planName} · ${summary.overallPct}% peak`}
            </span>
          </div>
        </div>
        <span className="koala-plan-limits__period">This period</span>
      </div>

      <ul className="koala-plan-limits__list">
        {summary.metrics.map((metric) => (
          <PlanUsageMetricRow key={metric.key} metric={metric} />
        ))}
      </ul>
    </Popover>
  );

  const seeLimitsBtn = summary.metrics.length > 0 ? (
    <button
      ref={anchorRef}
      type="button"
      className="koala-sidebar-plan-upgrade__limits"
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={openLimits}
    >
      See limits
      <Icon name="CaretRight" size={12} weight="bold" />
    </button>
  ) : null;

  return (
    <>
      <div className="koala-sidebar__item koala-sidebar__item--plan koala-sidebar__item--plan-upgrade">
        <div className="koala-sidebar-plan-upgrade__copy">
          <p className="koala-sidebar-plan-upgrade__title">{action.title}</p>
          <p className="koala-sidebar-plan-upgrade__sub">{cardSub}</p>
        </div>
        <div className="koala-sidebar-plan-upgrade__rule" aria-hidden />
        <Link href={action.href} passHref>
          <a className="koala-sidebar-plan-upgrade__cta" onClick={onNavigate}>
            {action.cta}
          </a>
        </Link>
        {seeLimitsBtn}
      </div>
      {limitsPopover}
    </>
  );
}

export default SidebarPlanItem;
