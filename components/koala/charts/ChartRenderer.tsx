'use client';

import React, { useCallback, useId, useMemo, useState } from 'react';
import { curveMonotoneX } from '@visx/curve';
import { localPoint } from '@visx/event';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AreaClosed, Bar, LinePath } from '@visx/shape';
import { chartColors } from '../tokens/chart';
import { ChartTooltip } from './ChartTooltip';
import type { ChartPreparedData, ChartSeries, RendererConfig } from './types';

/** @internal visx renderer — features must not import. */
export type ChartRendererProps = {
  width: number;
  height: number;
  config: RendererConfig;
  data: ChartPreparedData;
  'aria-label'?: string;
};

type TooltipState = { index: number; left: number; top: number };
type LinePoint = { label: string; value: number | null };

function resolveSeriesColors(series: ChartSeries[]) {
  return series.map((s) => ({
    label: s.label,
    color: chartColors[s.kind],
    values: s.values,
  }));
}

export function ChartRenderer({
  width,
  height,
  config,
  data,
  'aria-label': ariaLabel,
}: ChartRendererProps) {
  const gradId = useId().replace(/:/g, '');
  const margin = config.minimal
    ? { top: 2, right: 2, bottom: 2, left: 2 }
    : { top: 16, right: 16, bottom: 32, left: 44 };
  const innerWidth = Math.max(width - margin.left - margin.right, 0);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 0);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const labels = data.labels;
  const lines = useMemo(
    () => (data.series?.length ? resolveSeriesColors(data.series) : []),
    [data.series],
  );
  const points = data.points ?? [];
  const stacks = data.stacks ?? [];
  const multiLine = lines.length > 0;
  const isStacked = config.variant === 'stacked' && stacks.length > 0;

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        domain: labels,
        range: [0, innerWidth],
        padding: config.variant === 'bar' || isStacked ? 0.32 : 0.1,
      }),
    [innerWidth, labels, config.variant, isStacked],
  );

  const yScale = useMemo(() => {
    let values: number[] = [];
    if (isStacked) {
      values = labels.map((_, i) => stacks.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
    } else if (multiLine) {
      values = lines.flatMap((l) => l.values.filter((v): v is number => v != null));
    } else {
      values = points.map((p) => p.value);
    }
    const dataMin = values.length ? Math.min(...values) : 0;
    const dataMax = values.length ? Math.max(...values, 1) : 1;
    const min = Math.min(dataMin, 0);
    const max = dataMax;
    return scaleLinear<number>({
      domain: config.reverseY ? [max, min] : [min, max],
      range: [innerHeight, 0],
      nice: true,
    });
  }, [config.reverseY, innerHeight, isStacked, labels, lines, multiLine, points, stacks]);

  const getCenterX = useCallback(
    (label: string) => (xScale(label) ?? 0) + xScale.bandwidth() / 2,
    [xScale],
  );

  const stroke = chartColors.traffic;

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      if (!config.showTooltip || labels.length === 0) return;
      const point = localPoint(event);
      if (!point) return;
      const plotX = point.x - margin.left;
      const band = xScale.step();
      const index = Math.max(0, Math.min(labels.length - 1, Math.floor(plotX / band)));
      let anchor = 0;
      if (isStacked) {
        anchor = stacks.reduce((sum, s) => sum + (s.values[index] ?? 0), 0);
      } else if (multiLine) {
        anchor = lines.map((l) => l.values[index]).find((v) => v != null) ?? 0;
      } else {
        anchor = points[index]?.value ?? 0;
      }
      setTooltip({
        index,
        left: margin.left + getCenterX(labels[index]),
        top: margin.top + yScale(anchor) - 8,
      });
    },
    [config.showTooltip, getCenterX, isStacked, labels, lines, margin.left, margin.top, multiLine, points, stacks, xScale, yScale],
  );

  if (!labels.length || innerWidth <= 0 || innerHeight <= 0) return null;

  const yTicks = config.showGrid && !config.minimal ? yScale.ticks(4) : [];
  const compact = config.compactLabels;
  const labelStep = labels.length > 12 ? Math.ceil(labels.length / (compact ? 5 : 8)) : 1;

  const tooltipRows = (() => {
    if (!tooltip) return [];
    const i = tooltip.index;
    if (isStacked) {
      return stacks
        .filter((s) => (s.values[i] ?? 0) > 0)
        .map((s) => ({ label: s.label, value: s.values[i] ?? 0, color: s.color }));
    }
    if (multiLine) {
      const rows: Array<{ label: string; value: number; color: string }> = [];
      lines.forEach((l) => {
        const v = l.values[i];
        if (v == null) return;
        rows.push({ label: l.label, value: v, color: l.color });
      });
      return rows;
    }
    const p = points[i];
    return p ? [{ label: '', value: p.value, color: stroke }] : [];
  })();

  return (
    <div style={{ position: 'relative', width, height }}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        <defs>
          {config.areaGradient ? (
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          ) : null}
          {isStacked
            ? labels.map((label, i) => {
                const barX = xScale(label) ?? 0;
                const bw = xScale.bandwidth();
                const total = stacks.reduce((sum, s) => sum + (s.values[i] ?? 0), 0);
                if (total <= 0) return null;
                const stackTop = yScale(total);
                const stackH = Math.max(innerHeight - stackTop, 0);
                const r = Math.min(12, bw / 2, stackH / 2);
                return (
                  <clipPath key={`clip-${label}`} id={`${gradId}-stack-${i}`}>
                    <rect x={barX} y={stackTop} width={bw} height={stackH} rx={r} ry={r} />
                  </clipPath>
                );
              })
            : null}
        </defs>
        <Group left={margin.left} top={margin.top}>
          {yTicks.map((tick) => (
            <line
              key={tick}
              x1={0}
              x2={innerWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="var(--koala-border-primary)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ))}

          {config.variant === 'bar' && !isStacked
            ? points.map((d, i) => {
                const barX = xScale(d.label) ?? 0;
                const bw = xScale.bandwidth();
                const barY = yScale(Math.max(d.value, 0));
                const barHeight = Math.max(innerHeight - barY, 0);
                const anyEmphasized = points.some((p) => p.emphasized);
                const isLast = config.barHighlightLast && i === points.length - 1;
                const fill = d.emphasized
                  || (!anyEmphasized && !config.barHighlightLast)
                  || (!anyEmphasized && isLast)
                  ? chartColors.traffic
                  : chartColors.baseline;
                const r = Math.min(12, bw / 2, barHeight / 2);
                return (
                  <Bar
                    key={d.label}
                    x={barX}
                    y={barY}
                    width={bw}
                    height={barHeight}
                    fill={fill}
                    rx={r}
                    ry={r}
                  />
                );
              })
            : null}

          {isStacked
            ? labels.map((label, i) => {
                const barX = xScale(label) ?? 0;
                const bw = xScale.bandwidth();
                const total = stacks.reduce((sum, s) => sum + (s.values[i] ?? 0), 0);
                if (total <= 0) return null;
                let yCursor = innerHeight;
                return (
                  <g key={label} clipPath={`url(#${gradId}-stack-${i})`}>
                    {stacks.map((s) => {
                      const v = s.values[i] ?? 0;
                      if (v <= 0) return null;
                      const segH = innerHeight - yScale(v);
                      const y = yCursor - segH;
                      yCursor = y;
                      return (
                        <Bar
                          key={`${label}-${s.key}`}
                          x={barX}
                          y={y}
                          width={bw}
                          height={Math.max(segH, 0)}
                          fill={s.color}
                          rx={0}
                        />
                      );
                    })}
                  </g>
                );
              })
            : null}

          {(config.variant === 'line' || config.variant === 'area') && multiLine
            ? lines.map((line) => (
                <LinePath<LinePoint>
                  key={line.label}
                  data={labels.map((label, index) => ({ label, value: line.values[index] ?? null }))}
                  defined={(d) => d.value != null}
                  x={(d) => getCenterX(d.label)}
                  y={(d) => yScale(d.value as number)}
                  stroke={line.color}
                  strokeWidth={2}
                  curve={curveMonotoneX}
                />
              ))
            : null}

          {config.variant === 'line' && !multiLine ? (
            <LinePath
              data={points}
              x={(d) => getCenterX(d.label)}
              y={(d) => yScale(d.value)}
              stroke={stroke}
              strokeWidth={2}
              curve={curveMonotoneX}
            />
          ) : null}

          {config.variant === 'area' && !multiLine ? (
            <>
              <AreaClosed
                data={points}
                x={(d) => getCenterX(d.label)}
                y={(d) => yScale(d.value)}
                yScale={yScale}
                fill={config.areaGradient ? `url(#${gradId})` : stroke}
                fillOpacity={config.areaGradient ? 1 : 0.28}
                curve={curveMonotoneX}
              />
              <LinePath
                data={points}
                x={(d) => getCenterX(d.label)}
                y={(d) => yScale(d.value)}
                stroke={stroke}
                strokeWidth={2}
                curve={curveMonotoneX}
              />
            </>
          ) : null}

          {config.showTooltip ? (
            <rect
              x={0}
              y={0}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setTooltip(null)}
            />
          ) : null}

          {!config.minimal
            ? labels.map((label, index) => {
                if (index % labelStep !== 0) return null;
                return (
                  <text
                    key={`x-${label}-${index}`}
                    x={getCenterX(label)}
                    y={innerHeight + 18}
                    textAnchor="middle"
                    fill="var(--koala-text-secondary)"
                    fontSize={11}
                    fontFamily="var(--font-family-primary)"
                  >
                    {config.labelFormatter ? config.labelFormatter(label, index) : label}
                  </text>
                );
              })
            : null}

          {!config.minimal
            ? yTicks.map((tick) => (
                <text
                  key={`y-${tick}`}
                  x={-8}
                  y={yScale(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="var(--koala-text-secondary)"
                  fontSize={11}
                  fontFamily="var(--font-family-primary)"
                >
                  {config.valueFormatter(tick)}
                </text>
              ))
            : null}
        </Group>
      </svg>

      {config.showTooltip && tooltip && labels[tooltip.index] && tooltipRows.length > 0 ? (
        <ChartTooltip
          label={labels[tooltip.index]}
          rows={tooltipRows}
          formatter={config.valueFormatter}
          left={Math.min(tooltip.left, width - 80)}
          top={Math.max(4, tooltip.top - 48)}
        />
      ) : null}
    </div>
  );
}
