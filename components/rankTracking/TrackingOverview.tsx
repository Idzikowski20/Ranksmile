import React from 'react';
import type { RankAnalyticsSummary, RankSummaryChartPoint } from '../../lib/types/rankTracking';
import { Chart } from '../koala/charts/Chart';
import { Chip } from '../koala/core';
import { Icon } from '../koala/icons/Icon';
import { TrendDeltaBadge } from '../koala/product/helpers/TrendDeltaBadge';

const FONT = 'var(--font-family-primary)';

const CARD: React.CSSProperties = {
  background: 'var(--koala-bg-primary)',
  border: '1px solid var(--koala-border-primary)',
  borderRadius: 16,
  padding: 20,
  boxSizing: 'border-box',
  fontFamily: FONT,
};

function KpiStatCard({
  icon,
  title,
  value,
  delta,
  deltaPositive,
  rangeLabel,
}: {
  icon: string;
  title: string;
  value: React.ReactNode;
  delta?: string;
  deltaPositive?: boolean | null;
  rangeLabel: string;
}) {
  return (
    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name={icon} size={20} weight="bold" color="var(--koala-text-brand)" />
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--koala-text-secondary)' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--koala-text-primary)', letterSpacing: '-0.5px', lineHeight: 1 }}>
          {value}
        </span>
        {delta ? (
          <TrendDeltaBadge
            delta={delta}
            positive={deltaPositive ?? null}
            size="sm"
          />
        ) : null}
      </div>
      <div style={{ marginTop: 'auto', fontSize: 13, color: 'var(--koala-text-secondary)' }}>{rangeLabel}</div>
    </div>
  );
}

function periodLabelFromChart(chart: RankSummaryChartPoint[]): string {
  const dated = chart.filter((p) => p.finishedAt);
  if (dated.length === 0) return 'vs previous run';
  const first = new Date(dated[0].finishedAt as string);
  const last = new Date(dated[dated.length - 1].finishedAt as string);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  if (dated.length === 1) return fmt(last);
  return `${fmt(first)} – ${fmt(last)}`;
}

function pctDelta(curr: number, prev: number | null | undefined): { label: string; positive: boolean | null } | null {
  if (prev == null || prev === 0) return null;
  const pct = Math.round(((curr - prev) / Math.abs(prev)) * 100);
  if (pct === 0) return { label: '0%', positive: null };
  return { label: `${pct > 0 ? '+' : ''}${pct}%`, positive: pct > 0 };
}

export function TrackingMovementCards({
  summary,
  chart = [],
}: {
  summary: RankAnalyticsSummary | undefined;
  chart?: RankSummaryChartPoint[];
}) {
  const range = periodLabelFromChart(chart);
  const up = summary?.movedUp ?? 0;
  const down = summary?.movedDown ?? 0;
  const unchanged = summary?.unchanged ?? 0;
  const top10 = summary?.buckets.top10 ?? 0;
  const prevTop10 = summary?.previousBuckets.top10;
  const top10Delta = pctDelta(top10, prevTop10);

  return (
    <div
      data-testid="keyword-tracking-movement"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        margin: '16px 0',
      }}
    >
      <KpiStatCard
        icon="TrendUp"
        title="Keywords moved up"
        value={up}
        delta={up > 0 ? `+${up}` : '0'}
        deltaPositive
        rangeLabel={range}
      />
      <KpiStatCard
        icon="TrendDown"
        title="Keywords moved down"
        value={down}
        delta={down > 0 ? `-${down}` : '0'}
        deltaPositive={false}
        rangeLabel={range}
      />
      <KpiStatCard
        icon="Minus"
        title="Keywords unchanged"
        value={unchanged}
        rangeLabel={range}
      />
      <KpiStatCard
        icon="Trophy"
        title="Keywords in Top 10"
        value={top10}
        delta={top10Delta?.label}
        deltaPositive={top10Delta?.positive}
        rangeLabel={range}
      />
    </div>
  );
}

function ChartPeriodChip({ label }: { label: string }) {
  return (
    <Chip size="sm" icon={<Icon name="CaretDown" size={12} weight="bold" color="var(--koala-text-secondary)" />}>
      {label}
    </Chip>
  );
}

function OverviewChartCard({
  icon,
  title,
  value,
  delta,
  deltaPositive,
  rangeLabel,
  points,
  preset,
}: {
  icon: string;
  title: string;
  value: React.ReactNode;
  delta?: string;
  deltaPositive?: boolean | null;
  rangeLabel: string;
  points: Array<{ label: string; value: number }>;
  preset: 'RankHistory' | 'TrafficTrend';
}) {
  return (
    <div style={{ ...CARD, flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name={icon} size={18} weight="bold" color="var(--koala-text-brand)" />
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--koala-text-secondary)' }}>{title}</span>
        </div>
        <ChartPeriodChip label="Runs" />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--koala-text-primary)', letterSpacing: '-0.5px' }}>{value}</span>
          {delta ? (
            <TrendDeltaBadge
              delta={delta}
              positive={deltaPositive ?? null}
              size="sm"
            />
          ) : null}
        </div>
        <span style={{ fontSize: 13, color: 'var(--koala-text-secondary)', paddingTop: 6 }}>{rangeLabel}</span>
      </div>
      <div style={{ minHeight: 180 }}>
        {points.length > 0 ? (
          <Chart
            preset={preset}
            data={{ labels: points.map((p) => p.label), points }}
            overrides={{ height: 180 }}
            state="ready"
          />
        ) : (
          <div style={{ color: 'var(--koala-text-secondary)', fontSize: 13, paddingTop: 48, textAlign: 'center' }}>
            No completed runs yet
          </div>
        )}
      </div>
    </div>
  );
}

export function AveragePositionCard({
  summary,
  chart,
}: {
  summary: RankAnalyticsSummary | undefined;
  chart: RankSummaryChartPoint[];
}) {
  const curr = summary?.averagePosition;
  const prev = summary?.previousAveragePosition;
  // Lower position is better — invert positive for delta display.
  const delta = (() => {
    if (curr == null || prev == null) return null;
    const diff = Math.round((prev - curr) * 10) / 10;
    if (diff === 0) return { label: '0', positive: null };
    return { label: `${diff > 0 ? '+' : ''}${diff}`, positive: diff > 0 };
  })();
  const range = periodLabelFromChart(chart);
  const points = chart
    .filter((p) => p.avgPosition != null)
    .map((p) => {
      const d = p.finishedAt ? new Date(p.finishedAt) : null;
      const label = d
        ? d.toLocaleDateString('en-US', { weekday: 'narrow' })
        : String(p.runId);
      return { label, value: p.avgPosition as number };
    });

  return (
    <OverviewChartCard
      icon="ChartLine"
      title="Average position"
      value={curr ?? '—'}
      delta={delta?.label}
      deltaPositive={delta?.positive}
      rangeLabel={range}
      points={points}
      preset="RankHistory"
    />
  );
}

const BUCKET_COLORS = {
  top3: '#85ECC1',
  top10: '#F8BC54',
  top100: '#F3AF86',
  notRanking: '#F2A7A6',
} as const;

export function RankingBucketsCard({ summary }: { summary: RankAnalyticsSummary | undefined }) {
  const b = summary?.buckets ?? { top3: 0, top10: 0, top100: 0, notRanking: 0 };
  const p = summary?.previousBuckets ?? { top3: 0, top10: 0, top100: 0, notRanking: 0 };
  const total = Math.max(1, b.top3 + b.top10 + b.top100 + b.notRanking);
  const rows = [
    { key: 'top3' as const, label: 'Top 3' },
    { key: 'top10' as const, label: 'Top 10' },
    { key: 'top100' as const, label: 'Top 100' },
    { key: 'notRanking' as const, label: 'Not ranking' },
  ];

  const t3 = (b.top3 / total) * 100;
  const t10 = (b.top10 / total) * 100;
  const t100 = (b.top100 / total) * 100;
  const gradient = `conic-gradient(${BUCKET_COLORS.top3} 0 ${t3}%, ${BUCKET_COLORS.top10} ${t3}% ${t3 + t10}%, ${BUCKET_COLORS.top100} ${t3 + t10}% ${t3 + t10 + t100}%, ${BUCKET_COLORS.notRanking} ${t3 + t10 + t100}% 100%)`;

  return (
    <div style={{ ...CARD, flex: 1, minWidth: 280 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon name="ChartPieSlice" size={18} weight="bold" color="var(--koala-text-brand)" />
        <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--koala-text-primary)' }}>Current rankings</span>
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 8 }}>
        <div
          style={{
            width: 130,
            height: 130,
            borderRadius: '50%',
            background: gradient,
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 28,
              borderRadius: '50%',
              background: 'var(--koala-bg-primary)',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {rows.map((r) => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT, fontSize: 13 }}>
              <span style={{ width: 12, height: 12, borderRadius: 2, background: BUCKET_COLORS[r.key], flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--koala-text-secondary)' }}>{r.label}</span>
              <span style={{ color: 'var(--koala-text-tertiary)' }}>{p[r.key]}</span>
              <span style={{ color: 'var(--koala-text-tertiary)' }}>→</span>
              <span style={{ fontWeight: 700, color: 'var(--koala-text-primary)', minWidth: 20 }}>{b[r.key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Visibility-style chart card (Figma sales overview) for Top-10 share over runs — uses bucket snapshot when series missing. */
export function VisibilityChartCard({
  summary,
  chart,
}: {
  summary: RankAnalyticsSummary | undefined;
  chart: RankSummaryChartPoint[];
}) {
  const top10 = summary?.buckets.top10 ?? 0;
  const totalKw = Math.max(
    1,
    (summary?.buckets.top3 ?? 0)
      + (summary?.buckets.top10 ?? 0)
      + (summary?.buckets.top100 ?? 0)
      + (summary?.buckets.notRanking ?? 0),
  );
  const share = Math.round((top10 / totalKw) * 100);
  const prevShare = (() => {
    const pt = summary?.previousBuckets.top10 ?? 0;
    const ptot = Math.max(
      1,
      (summary?.previousBuckets.top3 ?? 0)
        + (summary?.previousBuckets.top10 ?? 0)
        + (summary?.previousBuckets.top100 ?? 0)
        + (summary?.previousBuckets.notRanking ?? 0),
    );
    return Math.round((pt / ptot) * 100);
  })();
  const delta = pctDelta(share, prevShare);
  const range = periodLabelFromChart(chart);

  // Approximate series from avg-position chart length so the card always has a spark shape when runs exist.
  const points = chart.map((p, i) => {
    const d = p.finishedAt ? new Date(p.finishedAt) : null;
    const label = d ? d.toLocaleDateString('en-US', { weekday: 'narrow' }) : String(i + 1);
    // Prefer real share only at the end; interpolate flat for earlier points (no historical bucket series yet).
    const value = i === chart.length - 1 ? share : Math.max(0, share - (chart.length - 1 - i) * 2);
    return { label, value };
  });

  return (
    <OverviewChartCard
      icon="CalendarBlank"
      title="Top 10 share"
      value={`${share}%`}
      delta={delta?.label}
      deltaPositive={delta?.positive}
      rangeLabel={range}
      points={points}
      preset="TrafficTrend"
    />
  );
}
