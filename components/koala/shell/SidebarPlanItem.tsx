import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from 'react-query';
import { getCheckoutPlan } from '../../../lib/billingPlans';
import fetchJson from '../../../lib/fetchJson';
import { formatTrialCountdown, planEndLine, type PlanSummaryData } from '../../../lib/planLimits';
import { hasActiveBillingEntitlement } from '../../../lib/billingEntitlement';
import type { SubscriptionStatus } from '../../../lib/orgBilling';
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
    cancelAtPeriodEnd: false,
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

  // The countdown reaching zero is only a display event unless someone re-asks the
  // server: bootstrap is cached for minutes, so without this the sidebar sat on
  // "Trial · 0m" with the whole app still usable. Re-asking lets ApplicationShell
  // pick up whatever the trial became — active when Stripe charged the card, expired
  // when it did not.
  //
  // Repeats every five minutes rather than firing once: the first answer past the
  // deadline is often still `trialing` — the server grants a grace window, and the
  // webhook that flips the status may not have landed yet — and a one-shot guard
  // left the sidebar stuck on "Trial · 0m" until a full reload.
  const queryClient = useQueryClient();
  const lastExpiryRefetch = useRef(0);
  useEffect(() => {
    if (!isTrialing || !trialEndsAt) return;
    if (new Date(trialEndsAt).getTime() > now) return;
    if (now - lastExpiryRefetch.current < 5 * 60_000) return;
    lastExpiryRefetch.current = now;
    void queryClient.invalidateQueries(['bootstrap']);
    void queryClient.invalidateQueries(['plan-summary-sidebar']);
  }, [isTrialing, trialEndsAt, now, queryClient]);

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

  // A paying subscriber, not a trial and not an unpaid account. This is the state the
  // widget reframes: name the plan and say when it renews, rather than always selling an
  // upgrade. Trial keeps its countdown; anything else keeps the old upgrade/manage copy.
  //
  // Gated on the real entitlement, not the raw status: a subscription set to cancel whose
  // period has passed still reads `active` locally until Stripe's webhook lands, and
  // treating that as a live plan showed "Growth plan", a past "Ends" date and an upgrade
  // CTA over an account the API already treats as lapsed. hasActiveBillingEntitlement is
  // the same pure check the server uses, so the two cannot disagree.
  const entitled = hasActiveBillingEntitlement({
    subscriptionStatus: summary.subscriptionStatus as SubscriptionStatus | null,
    currentPeriodEnd: summary.currentPeriodEnd,
    cancelAtPeriodEnd: summary.cancelAtPeriodEnd,
    trialEndsAt: summary.trialEndsAt,
  });
  const isActivePaid = entitled && summary.subscriptionStatus === 'active';
  const endLine = planEndLine(summary.currentPeriodEnd, summary.cancelAtPeriodEnd);

  const cardTitle: React.ReactNode = isActivePaid ? `${summary.planName} plan` : action.title;
  const cardSub = trialLeft
    ? `Trial · ${trialLeft}`
    : isActivePaid
      ? (endLine ?? statusLine ?? 'Manage in settings')
      : action.kind === 'manage'
        ? (statusLine || 'Manage billing in settings')
        : 'Cancel anytime in settings';

  // "Upgrade now" is a trial-only nudge. A paying subscriber — any tier — sees no CTA;
  // plan changes live in Settings → Billing. Trial and non-active states keep the
  // upgrade/manage CTA planCardAction decided (reused, not re-hardcoded here).
  const cta: { href: string; label: string } | null = isActivePaid
    ? null
    : { href: action.href, label: action.cta };

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
          <p className="koala-sidebar-plan-upgrade__title">{cardTitle}</p>
          <p className="koala-sidebar-plan-upgrade__sub">{cardSub}</p>
        </div>
        <div className="koala-sidebar-plan-upgrade__rule" aria-hidden />
        {cta && (
          <Link href={cta.href} passHref>
            <a className="koala-sidebar-plan-upgrade__cta" onClick={onNavigate}>
              {cta.label}
            </a>
          </Link>
        )}
        {seeLimitsBtn}
      </div>
      {limitsPopover}
    </>
  );
}

export default SidebarPlanItem;
