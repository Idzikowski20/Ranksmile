'use client';

import React, { useId, useMemo } from 'react';
import { curveMonotoneX } from '@visx/curve';
import { ParentSize } from '@visx/responsive';
import { scaleLinear } from '@visx/scale';
import { AreaClosed, Bar, LinePath } from '@visx/shape';
import { chartColors } from '../tokens/chart';

export type SparklineAppearance = 'analytics' | 'compact' | 'minimal' | 'comparison';

export type SparklineProps = {
  appearance: SparklineAppearance;
  /** Immutable values — prepare outside JSX. */
  values: number[];
  comparisonValues?: number[];
  width?: number;
  height?: number;
  'aria-label'?: string;
};

type AppearanceConfig = {
  variant: 'bar' | 'area' | 'line';
  height: number;
  strokeWidth: number;
  density: 'thick' | 'thin';
  gradient: boolean;
  highlightLast: boolean;
  showComparison: boolean;
};

const APPEARANCE: Record<SparklineAppearance, AppearanceConfig> = {
  analytics: {
    variant: 'area',
    height: 40,
    strokeWidth: 1.75,
    density: 'thick',
    gradient: true,
    highlightLast: false,
    showComparison: false,
  },
  compact: {
    variant: 'bar',
    height: 36,
    strokeWidth: 1.5,
    density: 'thick',
    gradient: false,
    highlightLast: true,
    showComparison: false,
  },
  minimal: {
    variant: 'line',
    height: 28,
    strokeWidth: 1.5,
    density: 'thin',
    gradient: false,
    highlightLast: false,
    showComparison: false,
  },
  comparison: {
    variant: 'area',
    height: 40,
    strokeWidth: 1.75,
    density: 'thick',
    gradient: true,
    highlightLast: false,
    showComparison: true,
  },
};

function SparklineInner({
  width,
  height,
  values,
  comparisonValues,
  cfg,
  ariaLabel,
}: {
  width: number;
  height: number;
  values: number[];
  comparisonValues?: number[];
  cfg: AppearanceConfig;
  ariaLabel?: string;
}) {
  const gradId = useId().replace(/:/g, '');
  const n = values.length;
  if (!n || width <= 0 || height <= 0) return null;

  const max = Math.max(...values, ...(comparisonValues ?? []), 1);
  const min = Math.min(...values, ...(comparisonValues ?? []), 0);
  const pad = 2;

  const xScale = scaleLinear<number>({
    domain: [0, Math.max(n - 1, 1)],
    range: [pad, width - pad],
  });
  const yScale = scaleLinear<number>({
    domain: [min, max],
    range: [height - pad, pad],
  });

  const points = values.map((value, i) => ({ i, value }));
  const barW = cfg.density === 'thin'
    ? Math.max(1, (width - pad * 2) / n - 1)
    : Math.max(2, (width - pad * 2) / n - 2);

  return (
    <svg width={width} height={height} role="img" aria-label={ariaLabel ?? 'Sparkline'} aria-hidden={!ariaLabel}>
      <defs>
        {cfg.gradient ? (
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColors.traffic} stopOpacity={0.35} />
            <stop offset="100%" stopColor={chartColors.traffic} stopOpacity={0} />
          </linearGradient>
        ) : null}
      </defs>

      {cfg.variant === 'bar'
        ? points.map((p, i) => {
            const x = xScale(i) - barW / 2;
            const y = yScale(p.value);
            const h = height - pad - y;
            const last = cfg.highlightLast && i === n - 1;
            return (
              <Bar
                key={p.i}
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 0)}
                fill={last ? chartColors.traffic : chartColors.baseline}
                rx={2}
              />
            );
          })
        : null}

      {cfg.variant === 'area' || cfg.variant === 'line' ? (
        <>
          {cfg.variant === 'area' ? (
            <AreaClosed
              data={points}
              x={(d) => xScale(d.i)}
              y={(d) => yScale(d.value)}
              yScale={yScale}
              fill={cfg.gradient ? `url(#${gradId})` : chartColors.traffic}
              fillOpacity={cfg.gradient ? 1 : 0.2}
              curve={curveMonotoneX}
            />
          ) : null}
          <LinePath
            data={points}
            x={(d) => xScale(d.i)}
            y={(d) => yScale(d.value)}
            stroke={chartColors.traffic}
            strokeWidth={cfg.strokeWidth}
            curve={curveMonotoneX}
          />
          {cfg.showComparison && comparisonValues?.length ? (
            <LinePath
              data={comparisonValues.map((value, i) => ({ i, value }))}
              x={(d) => xScale(d.i)}
              y={(d) => yScale(d.value)}
              stroke={chartColors.comparison}
              strokeWidth={1.25}
              curve={curveMonotoneX}
            />
          ) : null}
        </>
      ) : null}
    </svg>
  );
}

/**
 * Headless sparkline — appearance is SoT for stroke/gradient/padding.
 * Public Visualization Layer API (prefer via MetricWidget).
 */
export function Sparkline({
  appearance,
  values,
  comparisonValues,
  width,
  height,
  'aria-label': ariaLabel,
}: SparklineProps) {
  const cfg = APPEARANCE[appearance];
  const h = height ?? cfg.height;

  const inner = (w: number) => (
    <SparklineInner
      width={w}
      height={h}
      values={values}
      comparisonValues={comparisonValues}
      cfg={cfg}
      ariaLabel={ariaLabel}
    />
  );

  if (width != null) return inner(width);

  return (
    <div style={{ width: '100%', height: h, minWidth: 80 }}>
      <ParentSize>
        {({ width: pw }) => (pw > 0 ? inner(pw) : null)}
      </ParentSize>
    </div>
  );
}

export default Sparkline;
