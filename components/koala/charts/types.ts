import type { ChartBucketKind, ChartSeriesKind } from '../tokens/chart';
import type { ChartValueFormatter } from './formatters';

export type ChartState = 'loading' | 'empty' | 'error' | 'ready' | 'disabled';

export type ChartVariant = 'bar' | 'line' | 'area' | 'stacked' | 'heatmap';

export type ChartPresetName =
  | 'TrafficTrend'
  | 'KeywordTrend'
  | 'RankHistory'
  | 'Comparison'
  | 'Distribution'
  | 'StackedPositions'
  | 'ActivityHeatmap';

export type ChartDataPoint = {
  label: string;
  value: number;
  /** Brand fill when set; other bars dim to baseline. */
  emphasized?: boolean;
};

export type ChartSeries = {
  label: string;
  kind: ChartSeriesKind;
  values: Array<number | null>;
};

/** Stacked bar segment — uses bucket palette, not semantic kind. */
export type ChartStackSeries = {
  key: ChartBucketKind | string;
  label: string;
  color: string;
  values: number[];
};

export type ChartOverrides = {
  tooltip?: boolean;
  legend?: boolean;
  height?: number;
  showGrid?: boolean;
  compactLabels?: boolean;
  valueFormatter?: ChartValueFormatter;
};

/** Resolved config from preset SoT — consumed only by Chart → renderers. */
export type RendererConfig = {
  variant: ChartVariant;
  height: number;
  showTooltip: boolean;
  showLegend: boolean;
  showGrid: boolean;
  reverseY: boolean;
  minimal: boolean;
  valueFormatter: ChartValueFormatter;
  labelFormatter?: (label: string, index: number) => string;
  compactLabels: boolean;
  barHighlightLast?: boolean;
  areaGradient?: boolean;
};

export type ChartPreparedData = {
  labels: string[];
  /** Single-series bar/area/line */
  points?: ChartDataPoint[];
  /** Multi-line */
  series?: ChartSeries[];
  /** Stacked bars */
  stacks?: ChartStackSeries[];
  /** Heatmap matrix rows×cols */
  heatmap?: number[][];
};
