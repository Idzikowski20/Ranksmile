import { formatCompactNumber, formatNumber, formatPercent, formatRank } from './formatters';
import type { ChartPresetName, RendererConfig } from './types';

/** Preset → RendererConfig. Single source of truth for chart chrome. */
const PRESETS: Record<ChartPresetName, RendererConfig> = {
  TrafficTrend: {
    variant: 'area',
    height: 240,
    showTooltip: true,
    showLegend: false,
    showGrid: true,
    reverseY: false,
    minimal: false,
    valueFormatter: (v, seriesLabel) => {
      if (seriesLabel === 'CTR') return formatPercent(v, 1).replace(/^\+/, '');
      if (seriesLabel === 'Position') return formatRank(v);
      return formatCompactNumber(v);
    },
    compactLabels: false,
    areaGradient: true,
    independentY: true,
  },
  KeywordTrend: {
    variant: 'bar',
    height: 240,
    showTooltip: true,
    showLegend: false,
    showGrid: true,
    reverseY: false,
    minimal: false,
    valueFormatter: (v) => formatCompactNumber(v),
    compactLabels: false,
    barHighlightLast: true,
  },
  RankHistory: {
    variant: 'area',
    height: 200,
    showTooltip: true,
    showLegend: false,
    showGrid: true,
    reverseY: true,
    minimal: false,
    valueFormatter: (v) => formatRank(v),
    compactLabels: false,
    areaGradient: true,
  },
  Comparison: {
    variant: 'line',
    height: 260,
    showTooltip: true,
    showLegend: true,
    showGrid: true,
    reverseY: false,
    minimal: false,
    valueFormatter: (v) => formatNumber(v),
    compactLabels: false,
  },
  Distribution: {
    variant: 'bar',
    height: 220,
    showTooltip: true,
    showLegend: false,
    showGrid: true,
    reverseY: false,
    minimal: false,
    valueFormatter: (v) => formatCompactNumber(v),
    compactLabels: false,
  },
  StackedPositions: {
    variant: 'stacked',
    height: 320,
    showTooltip: true,
    showLegend: true,
    showGrid: true,
    reverseY: false,
    minimal: false,
    valueFormatter: (v) => formatCompactNumber(v),
    compactLabels: false,
  },
  ActivityHeatmap: {
    variant: 'heatmap',
    height: 160,
    showTooltip: false,
    showLegend: false,
    showGrid: false,
    reverseY: false,
    minimal: true,
    valueFormatter: (v) => formatNumber(v),
    compactLabels: true,
  },
};

export function resolvePreset(name: ChartPresetName): RendererConfig {
  return { ...PRESETS[name] };
}

export type { ChartPresetName };
