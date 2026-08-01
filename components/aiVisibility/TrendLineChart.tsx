import React, { useMemo } from 'react';
import { Chart } from '../koala/charts';
import type { ChartPreparedData } from '../koala/charts';

type Point = {
  finishedAt: string | null;
  series: { you: { visibilityScore: number } | null; competitor?: { visibilityScore: number } | null };
};

const TrendLineChart = ({ scans, competitorDomain }: { scans: Point[]; competitorDomain: string | null }) => {
  const data: ChartPreparedData = useMemo(() => {
    const labels = scans.map((s) => (s.finishedAt ? new Date(s.finishedAt).toLocaleDateString() : ''));
    return {
      labels,
      series: [
        {
          label: 'You',
          kind: 'traffic' as const,
          values: scans.map((s) => s.series.you?.visibilityScore ?? 0),
        },
        ...(competitorDomain
          ? [{
              label: competitorDomain,
              kind: 'comparison' as const,
              values: scans.map((s) => s.series.competitor?.visibilityScore ?? 0),
            }]
          : []),
      ],
    };
  }, [scans, competitorDomain]);

  return (
    <div style={{ height: 300 }}>
      <Chart
        preset="Comparison"
        data={data}
        state={scans.length ? 'ready' : 'empty'}
        overrides={{ height: 300 }}
        aria-label="Visibility trend"
        legendItems={data.series?.map((s) => ({
          key: s.label,
          label: s.label,
          color: s.kind === 'traffic' ? 'var(--koala-bg-brand)' : 'var(--koala-text-secondary)',
        }))}
      />
    </div>
  );
};

export default TrendLineChart;
