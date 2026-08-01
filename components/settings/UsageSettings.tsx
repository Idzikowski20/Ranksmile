import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import fetchJson from '../../lib/fetchJson';
import {
  formatTrialCountdown,
  type PlanLimitMetric,
  type PlanSummaryData,
} from '../../lib/planLimits';
import { Icon } from '../koala/icons/Icon';
import { Card, CardHeader } from '../koala/product/Card';
import { brandMain } from '../koala/tokens/colors';

type PlanSummaryResponse = {
  summary: PlanSummaryData;
  statusLine: string;
};

const FALLBACK: PlanSummaryResponse = {
  summary: {
    planSlug: 'starter',
    planName: 'Starter',
    billingPeriod: null,
    subscriptionStatus: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    metrics: [],
    overallPct: 0,
  },
  statusLine: '',
};

const font = 'var(--font-family-primary)';

function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

function periodCaption(summary: PlanSummaryData, nowMs: number): string {
  if (summary.subscriptionStatus === 'trialing' && summary.trialEndsAt) {
    const left = formatTrialCountdown(summary.trialEndsAt, nowMs);
    return left ? `Trial · ${left} left` : 'Trial';
  }
  if (summary.currentPeriodEnd) {
    const end = new Date(summary.currentPeriodEnd);
    if (!Number.isNaN(end.getTime())) {
      const days = Math.max(0, Math.ceil((end.getTime() - nowMs) / 86_400_000));
      if (days === 0) return 'Renews today';
      if (days === 1) return 'Renews in 1 day';
      return `Renews in ${days} days`;
    }
  }
  return summary.planName;
}

function MetricCard({ metric }: { metric: PlanLimitMetric }) {
  const over = metric.limit != null && metric.used > metric.limit;
  const warn = over || (metric.pct ?? 0) >= 85;
  const fillPct = metric.limit == null
    ? 0
    : Math.min(100, Math.round((metric.used / metric.limit) * 100));
  const available = metric.limit == null ? null : Math.max(0, metric.limit - metric.used);
  const limitLabel = metric.limit == null
    ? 'Unlimited'
    : metric.key === 'keywordResearch'
      ? `Period limit: ${formatCount(metric.limit)}`
      : metric.key === 'siteAuditPages'
        ? `Per crawl: ${formatCount(metric.limit)}`
        : `Plan limit: ${formatCount(metric.limit)}`;
  const usageLabel = metric.limit == null
    ? `${formatCount(metric.used)} · Unlimited`
    : `${formatCount(metric.used)} / ${formatCount(metric.limit)}`;

  return (
    <Card>
      <CardHeader
        title={metric.label}
        action={(
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--koala-text-secondary)',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {limitLabel}
          </span>
        )}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: font }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            className="koala-plan-limits__track"
            role="progressbar"
            aria-valuenow={fillPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${metric.label} usage`}
            style={{ width: '100%' }}
          >
            <div
              className={`koala-plan-limits__fill${warn ? ' koala-plan-limits__fill--warn' : ''}${over ? ' koala-plan-limits__fill--over' : ''}`}
              style={{ width: `${over ? 100 : fillPct}%` }}
            />
          </div>
          <span
            className={warn ? 'koala-plan-limits__warn' : undefined}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: warn ? undefined : 'var(--koala-text-secondary)',
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'right',
              whiteSpace: 'nowrap',
            }}
          >
            {usageLabel}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--koala-text-secondary)' }}>
              {metric.limit == null ? 'Used' : 'Available'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--koala-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {metric.limit == null ? formatCount(metric.used) : formatCount(available ?? 0)}
            </span>
          </div>
          {metric.limit != null ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--koala-text-secondary)' }}>Used</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--koala-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCount(metric.used)}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

const UsageSettings = () => {
  const { data, isLoading, isFetching } = useQuery(
    ['plan-summary-usage'],
    () => fetchJson<PlanSummaryResponse>('/api/billing/plan-summary', FALLBACK),
    {
      staleTime: 15_000,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      retry: false,
    },
  );

  const summary = data?.summary ?? FALLBACK.summary;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const totalUsed = summary.metrics.reduce((sum, m) => sum + m.used, 0);
  const caption = periodCaption(summary, now);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', fontFamily: font, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="BatteryMedium" size={20} weight="bold" color={brandMain} />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--koala-text-primary)' }}>
              {summary.planName}
            </span>
            {isFetching && !isLoading ? (
              <span style={{ fontSize: 12, color: 'var(--koala-text-tertiary)' }}>Updating…</span>
            ) : null}
          </div>
          <span
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: 'var(--koala-text-primary)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
            }}
          >
            {isLoading ? '—' : formatCount(totalUsed)}
          </span>
        </div>
        <span
          className="koala-plan-limits__period"
          style={{ whiteSpace: 'nowrap', maxWidth: 'none', height: 'auto', minHeight: 28 }}
          title={caption}
        >
          {caption}
        </span>
      </div>

      {isLoading && summary.metrics.length === 0 ? (
        <Card>
          <span style={{ fontSize: 14, color: 'var(--koala-text-secondary)' }}>Loading plan usage…</span>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {summary.metrics.map((metric) => (
            <MetricCard key={metric.key} metric={metric} />
          ))}
        </div>
      )}
    </div>
  );
};

export default UsageSettings;
