import React, { useMemo } from 'react';
import { Chart } from '../koala/charts';
import type { ChartPreparedData, ChartSeriesKind } from '../koala/charts';

export type SeriesLine = {
  label: string;
  data: Array<number | null>;
  kind?: ChartSeriesKind;
  /** @deprecated Prefer `kind`. */
  color?: string;
};

function resolveKind(line: SeriesLine, index: number): ChartSeriesKind {
  if (line.kind === 'neutral') return 'comparison';
  if (line.kind) return line.kind;
  if (line.color === '#9F9FA9' || line.color === '#71717B' || line.color === '#18181B') {
    return line.color === '#18181B' ? 'traffic' : 'comparison';
  }
  return index === 0 ? 'traffic' : 'comparison';
}

/** Small per-metric Koala Comparison (line) chart for AI overview cards. */
const MetricTrendChart = ({
  labels,
  lines,
  reverse = false,
  percent = false,
  height = 200,
}: {
  labels: string[];
  lines: SeriesLine[];
  yMin?: number;
  yMax?: number;
  reverse?: boolean;
  percent?: boolean;
  height?: number;
}) => {
  const data: ChartPreparedData = useMemo(
    () => ({
      labels,
      series: lines.map((line, i) => ({
        label: line.label,
        kind: resolveKind(line, i),
        values: line.data,
      })),
    }),
    [labels, lines],
  );

  return (
    <div style={{ height, width: '100%' }}>
      <Chart
        preset="Comparison"
        data={data}
        state={labels.length ? 'ready' : 'empty'}
        overrides={{
          height,
          legend: false,
          reverseY: reverse,
          compactLabels: labels.length > 6,
          valueFormatter: percent
            ? (v) => `${Math.round(v)}%`
            : reverse
              ? (v) => (!Number.isFinite(v) || v <= 0 ? '—' : String(Math.round(v * 10) / 10).replace(/\.0$/, ''))
              : (v) => String(Math.round(v * 10) / 10).replace(/\.0$/, ''),
        }}
        aria-label="Metric trend"
      />
    </div>
  );
};

export default MetricTrendChart;
