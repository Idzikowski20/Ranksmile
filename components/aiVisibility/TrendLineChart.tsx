import React, { useMemo } from 'react';
import { Chart } from '../koala/charts';
import type { ChartPreparedData } from '../koala/charts';
import { chartColors } from '../koala/tokens/chart';

type Point = {
  finishedAt: string | null;
  series: { you: { visibilityScore: number } | null; competitor?: { visibilityScore: number } | null };
};

function fmtLabel(iso: string | null, index: number): string {
  if (!iso) return `#${index + 1}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `#${index + 1}`;
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
}

/** Visibility score trend — Koala Comparison line; chronological (oldest → newest). */
const TrendLineChart = ({ scans, competitorDomain }: { scans: Point[]; competitorDomain: string | null }) => {
  const data: ChartPreparedData = useMemo(() => {
    // API returns newest-first; charts need time left→right.
    const ordered = [...scans].reverse();
    const labels = ordered.map((s, i) => fmtLabel(s.finishedAt, i));
    return {
      labels,
      series: [
        {
          label: 'You',
          kind: 'traffic' as const,
          values: ordered.map((s) => s.series.you?.visibilityScore ?? 0),
        },
        ...(competitorDomain
          ? [{
              label: competitorDomain,
              kind: 'comparison' as const,
              values: ordered.map((s) => s.series.competitor?.visibilityScore ?? 0),
            }]
          : []),
      ],
    };
  }, [scans, competitorDomain]);

  return (
    <div style={{ height: 300, width: '100%' }}>
      <Chart
        preset="Comparison"
        data={data}
        state={scans.length ? 'ready' : 'empty'}
        overrides={{ height: 300, legend: Boolean(competitorDomain) }}
        aria-label="Visibility trend"
        legendItems={competitorDomain
          ? data.series?.map((s) => ({
              key: s.label,
              label: s.label,
              color: s.kind === 'traffic' ? chartColors.traffic : chartColors.comparison,
            }))
          : undefined}
      />
    </div>
  );
};

export default TrendLineChart;
