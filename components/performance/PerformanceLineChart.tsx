import React, { useMemo } from 'react';
import { Chart } from '../koala/charts';
import type { ChartPreparedData, ChartSeries, ChartSeriesKind } from '../koala/charts';
import { ChartLegend } from '../koala/charts/ChartLegend';
import { chartColors } from '../koala/tokens/chart';
import { Icon } from '../koala/icons/Icon';
import type { ChartPoint } from '../../lib/performance/types';

type VisibleMetrics = { clicks: boolean; impressions: boolean; ctr: boolean; position: boolean };

type PerformanceLineChartProps = {
  data: ChartPoint[];
  visibleMetrics: VisibleMetrics;
  /** Primary KPI shown in the Figma header (usually clicks total). */
  primaryValue: string;
  primaryLabel?: string;
};

const METRIC_META: Record<
  keyof VisibleMetrics,
  { label: string; kind: ChartSeriesKind }
> = {
  clicks: { label: 'Clicks', kind: 'traffic' },
  impressions: { label: 'Impressions', kind: 'comparison' },
  ctr: { label: 'CTR', kind: 'positive' },
  position: { label: 'Position', kind: 'rank' },
};

/** Traffic trend — Koala Area Chart chrome (Figma 9977:110306). Date range lives in PageFilterBar. */
export default function PerformanceLineChart({
  data,
  visibleMetrics,
  primaryValue,
  primaryLabel = 'Clicks',
}: PerformanceLineChartProps) {
  const prepared: ChartPreparedData = useMemo(() => {
    const labels = data.map((d) => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    });
    const series: ChartSeries[] = [];
    (['clicks', 'impressions', 'ctr', 'position'] as const).forEach((key) => {
      if (!visibleMetrics[key]) return;
      const meta = METRIC_META[key];
      series.push({
        label: meta.label,
        kind: meta.kind,
        values: data.map((d) => d[key]),
      });
    });
    return { labels, series };
  }, [data, visibleMetrics]);

  const legendItems = prepared.series?.map((s) => ({
    key: s.label,
    label: s.label,
    color: chartColors[s.kind],
  })) ?? [];

  return (
    <div
      className="performance-traffic-trend"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 16,
        border: '1px solid var(--koala-border-primary)',
        borderRadius: 16,
        background: 'var(--koala-bg-primary)',
        fontFamily: 'var(--font-family-primary)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
          <Icon name="CalendarBlank" size={20} weight="bold" color="var(--koala-text-brand)" />
          <span
            style={{
              fontSize: 16,
              fontWeight: 500,
              lineHeight: '24px',
              letterSpacing: '-0.25px',
              color: 'var(--koala-text-primary)',
            }}
          >
            Traffic trend
          </span>
        </div>
        {legendItems.length > 1 ? (
          <ChartLegend items={legendItems} />
        ) : null}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.96px',
              color: 'var(--koala-text-primary)',
            }}
            title={primaryLabel}
          >
            {primaryValue}
          </span>
        </div>
      </div>

      <div style={{ width: '100%', minHeight: 260 }}>
        <Chart
          preset="TrafficTrend"
          data={prepared}
          state={data.length && (prepared.series?.length ?? 0) > 0 ? 'ready' : 'empty'}
          emptyDescription="No chart data for this filter."
          overrides={{ height: 260, legend: false }}
          aria-label="Performance traffic trend"
        />
      </div>
    </div>
  );
}
