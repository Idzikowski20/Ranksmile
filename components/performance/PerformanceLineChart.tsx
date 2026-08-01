import React, { useMemo } from 'react';
import { Chart } from '../koala/charts';
import type { ChartPreparedData, ChartSeries, ChartSeriesKind } from '../koala/charts';
import { chartColors } from '../koala/tokens/chart';
import type { ChartPoint } from '../../lib/performance/types';

type PerformanceLineChartProps = {
  data: ChartPoint[];
  visibleMetrics: { clicks: boolean; impressions: boolean; ctr: boolean; position: boolean };
};

const METRIC_KIND: Record<keyof PerformanceLineChartProps['visibleMetrics'], ChartSeriesKind> = {
  clicks: 'traffic',
  impressions: 'comparison',
  ctr: 'positive',
  position: 'rank',
};

/** Prepares multi-series for Comparison preset — no aggregation inside Chart. */
export default function PerformanceLineChart({ data, visibleMetrics }: PerformanceLineChartProps) {
  const prepared: ChartPreparedData = useMemo(() => {
    const labels = data.map((d) => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    });
    const series: ChartSeries[] = [];
    (['clicks', 'impressions', 'ctr', 'position'] as const).forEach((key) => {
      if (!visibleMetrics[key]) return;
      series.push({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        kind: METRIC_KIND[key],
        values: data.map((d) => d[key]),
      });
    });
    return { labels, series };
  }, [data, visibleMetrics]);

  return (
    <div style={{ width: '100%', minHeight: 280 }}>
      <Chart
        preset="Comparison"
        data={prepared}
        state={data.length ? 'ready' : 'empty'}
        emptyDescription="No chart data for this filter."
        overrides={{ height: 280 }}
        aria-label="Performance traffic trend"
        legendItems={prepared.series?.map((s) => ({
          key: s.label,
          label: s.label,
          color: chartColors[s.kind],
        }))}
      />
    </div>
  );
}
