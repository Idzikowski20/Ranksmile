import React, { useMemo } from 'react';
import { Chart } from '../koala/charts';
import type { ChartPreparedData, ChartSeriesKind } from '../koala/charts';
import { chartColors } from '../koala/tokens/chart';

export type SeriesLine = {
  label: string;
  data: Array<number | null>;
  kind?: ChartSeriesKind;
  /** @deprecated Prefer `kind`. */
  color?: string;
};

function resolveKind(line: SeriesLine): ChartSeriesKind {
  if (line.kind) return line.kind;
  if (line.color === chartColors.neutral || line.color === '#9F9FA9') return 'comparison';
  if (line.color === chartColors.ai) return 'ai';
  if (line.color === chartColors.rank) return 'rank';
  if (line.color === chartColors.positive) return 'positive';
  return 'traffic';
}

/** Small per-metric trend chart (Mention rate / Average position / Citations & Pages). */
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
      series: lines.map((line) => ({
        label: line.label,
        kind: resolveKind(line),
        values: line.data,
      })),
    }),
    [labels, lines],
  );

  return (
    <div style={{ height }}>
      <Chart
        preset={reverse ? 'RankHistory' : 'Comparison'}
        data={data}
        state={labels.length ? 'ready' : 'empty'}
        overrides={{
          height,
          valueFormatter: percent ? (v) => `${Math.round(v)}%` : (v) => String(v),
        }}
        aria-label="Metric trend"
      />
    </div>
  );
};

export default MetricTrendChart;
