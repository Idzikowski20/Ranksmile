'use client';

import React, { useMemo } from 'react';
import { ParentSize } from '@visx/responsive';
import styled from '@emotion/styled';
import { FeedbackFrame, LoadingState, EmptyState, ErrorState } from '../feedback';
import { ChartRenderer } from './ChartRenderer';
import { HeatmapRenderer } from './HeatmapRenderer';
import { ChartLegend } from './ChartLegend';
import { resolvePreset } from './presets';
import { chartAppear } from './chartMotion';
import type {
  ChartOverrides,
  ChartPreparedData,
  ChartPresetName,
  ChartState,
  RendererConfig,
} from './types';

export type {
  ChartDataPoint,
  ChartPreparedData,
  ChartPresetName,
  ChartSeries,
  ChartStackSeries,
  ChartState,
  ChartOverrides,
} from './types';
export type { ChartSeriesKind } from '../tokens/chart';

export type ChartProps = {
  preset: ChartPresetName;
  /** Immutable prepared series — never inline in JSX. */
  data: ChartPreparedData;
  state?: ChartState;
  overrides?: ChartOverrides;
  width?: number;
  height?: number;
  'aria-label'?: string;
  emptyDescription?: React.ReactNode;
  errorDescription?: React.ReactNode;
  disabledDescription?: React.ReactNode;
  /** Optional interactive legend items (StackedPositions toggles prepared outside). */
  legendItems?: Array<{
    key: string;
    label: string;
    color: string;
    active?: boolean;
    onToggle?: () => void;
  }>;
  className?: string;
};

const Root = styled.div`
  width: 100%;
  ${chartAppear}
`;

function mergeConfig(preset: ChartPresetName, overrides?: ChartOverrides, heightProp?: number): RendererConfig {
  const base = resolvePreset(preset);
  return {
    ...base,
    showTooltip: overrides?.tooltip ?? base.showTooltip,
    showLegend: overrides?.legend ?? base.showLegend,
    showGrid: overrides?.showGrid ?? base.showGrid,
    height: heightProp ?? overrides?.height ?? base.height,
    compactLabels: overrides?.compactLabels ?? base.compactLabels,
    valueFormatter: overrides?.valueFormatter ?? base.valueFormatter,
  };
}

function ChartBody({
  width,
  height,
  config,
  data,
  ariaLabel,
}: {
  width: number;
  height: number;
  config: RendererConfig;
  data: ChartPreparedData;
  ariaLabel?: string;
}) {
  if (config.variant === 'heatmap' && data.heatmap) {
    return (
      <HeatmapRenderer
        data={data.heatmap}
        width={width}
        height={height}
        aria-label={ariaLabel}
      />
    );
  }
  return (
    <ChartRenderer
      width={width}
      height={height}
      config={config}
      data={data}
      aria-label={ariaLabel}
    />
  );
}

/**
 * Public Visualization Layer entry — declarative preset + prepared data only.
 * Do not pass ad-hoc chrome props; use `overrides` for rare advanced cases.
 */
export function Chart({
  preset,
  data,
  state = 'ready',
  overrides,
  width,
  height,
  'aria-label': ariaLabel,
  emptyDescription,
  errorDescription,
  disabledDescription,
  legendItems,
  className,
}: ChartProps) {
  const config = useMemo(
    () => mergeConfig(preset, overrides, height),
    [preset, overrides, height],
  );

  /** Single series in `series` → `points` for area/bar so TrafficTrend/RankHistory keep area fill. */
  const normalizedData = useMemo((): ChartPreparedData => {
    if (
      data.points?.length
      || !data.series
      || data.series.length !== 1
      || data.stacks?.length
      || data.heatmap
    ) {
      return data;
    }
    if (config.variant !== 'area' && config.variant !== 'bar') return data;
    const only = data.series[0];
    return {
      labels: data.labels,
      points: data.labels.map((label, i) => ({
        label,
        value: only.values[i] ?? 0,
      })),
    };
  }, [config.variant, data]);

  if (state === 'loading') {
    return <LoadingState label="Loading chart…" />;
  }
  if (state === 'empty') {
    return <EmptyState description={emptyDescription ?? 'No history'} />;
  }
  if (state === 'error') {
    return <ErrorState description={errorDescription ?? 'Could not load chart'} />;
  }
  if (state === 'disabled') {
    return (
      <FeedbackFrame
        title="Unavailable"
        description={disabledDescription ?? 'This chart is not available on your plan.'}
      />
    );
  }

  const hasData =
    (normalizedData.labels?.length ?? 0) > 0
    || (normalizedData.heatmap?.length ?? 0) > 0;
  if (!hasData) {
    return <EmptyState description={emptyDescription ?? 'No history'} />;
  }

  const showLegend = config.showLegend && legendItems && legendItems.length > 0;

  const plot = (w: number) => (
    <Root className={className}>
      {showLegend ? (
        <div style={{ marginBottom: 12 }}>
          <ChartLegend items={legendItems!} />
        </div>
      ) : null}
      <ChartBody
        width={w}
        height={config.height}
        config={config}
        data={normalizedData}
        ariaLabel={ariaLabel}
      />
    </Root>
  );

  if (width != null) return plot(width);

  return (
    <div style={{ width: '100%', height: config.height + (showLegend ? 36 : 0) }}>
      <ParentSize>
        {({ width: parentWidth }) => (parentWidth > 0 ? plot(parentWidth) : null)}
      </ParentSize>
    </div>
  );
}

export default Chart;
