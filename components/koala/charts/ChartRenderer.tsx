'use client';

import React, { useCallback, useId, useMemo, useState } from 'react';
import { curveMonotoneX } from '@visx/curve';
import { localPoint } from '@visx/event';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AreaClosed, Bar, LinePath } from '@visx/shape';
import { chartColors } from '../tokens/chart';
import type { ChartSeriesKind } from '../tokens/chart';
import { ChartTooltip } from './ChartTooltip';
import type { ChartPreparedData, ChartSeries, RendererConfig } from './types';
import { buildSeriesYScale } from './yScale';

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
type ResolvedLine = {
  label: string;
  kind: ChartSeriesKind;
  color: string;
  values: Array<number | null>;
};

type YScale = ReturnType<typeof scaleLinear<number>>;

function resolveSeriesColors(series: ChartSeries[]): ResolvedLine[] {
  return series.map((s) => ({
    label: s.label,
    kind: s.kind,
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
  const seriesCount = data.series?.length ?? 0;
  const dualAxis = Boolean(config.independentY && seriesCount >= 2);
  const margin = config.minimal
    ? { top: 2, right: 2, bottom: 2, left: 2 }
    : { top: 12, right: dualAxis ? 52 : 8, bottom: 28, left: 52 };
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
  const isGroupedBar = config.variant === 'bar' && !isStacked && multiLine;
  const independentY = Boolean(config.independentY && multiLine);

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        domain: labels,
        range: [0, innerWidth],
        // Grouped bars need more band padding so each pair stays narrow (Koala income/expense style).
        padding: isGroupedBar ? 0.42 : (config.variant === 'bar' || isStacked ? 0.32 : 0.1),
      }),
    [innerWidth, labels, config.variant, isStacked, isGroupedBar],
  );

  const seriesYScales = useMemo((): YScale[] | null => {
    if (!independentY) return null;
    return lines.map((line) => {
      const isRank = line.kind === 'rank';
      return buildSeriesYScale(line.values, innerHeight, {
        reverse: isRank || config.reverseY,
        zeroBaseline: !isRank,
      });
    });
  }, [config.reverseY, independentY, innerHeight, lines]);

  const yScale = useMemo(() => {
    if (seriesYScales?.[0]) return seriesYScales[0];
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
  }, [config.reverseY, innerHeight, isStacked, labels, lines, multiLine, points, seriesYScales, stacks]);

  const yAt = useCallback(
    (lineIndex: number, value: number) => (seriesYScales?.[lineIndex] ?? yScale)(value),
    [seriesYScales, yScale],
  );

  const getCenterX = useCallback(
    (label: string) => (xScale(label) ?? 0) + xScale.bandwidth() / 2,
    [xScale],
  );

  const stroke = chartColors.traffic;
  const areaStroke = multiLine ? (lines[0]?.color ?? stroke) : stroke;

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      if (!config.showTooltip || labels.length === 0) return;
      const point = localPoint(event);
      if (!point) return;
      const plotX = point.x - margin.left;
      const band = xScale.step();
      const index = Math.max(0, Math.min(labels.length - 1, Math.floor(plotX / band)));
      let topY = margin.top;
      if (isStacked) {
        const anchor = stacks.reduce((sum, s) => sum + (s.values[index] ?? 0), 0);
        topY += yScale(anchor) - 8;
      } else if (multiLine) {
        let found = false;
        for (let li = 0; li < lines.length; li += 1) {
          const v = lines[li].values[index];
          if (v == null) continue;
          topY += yAt(li, v) - 8;
          found = true;
          break;
        }
        if (!found) topY += yScale(0) - 8;
      } else {
        topY += yScale(points[index]?.value ?? 0) - 8;
      }
      setTooltip({
        index,
        left: margin.left + getCenterX(labels[index]),
        top: topY,
      });
    },
    [config.showTooltip, getCenterX, isStacked, labels, lines, margin.left, margin.top, multiLine, points, stacks, xScale, yAt, yScale],
  );

  if (!labels.length || innerWidth <= 0 || innerHeight <= 0) return null;

  const yTicks = config.showGrid && !config.minimal ? yScale.ticks(5) : [];
  const yTicksRight =
    config.showGrid && !config.minimal && dualAxis && seriesYScales?.[1]
      ? seriesYScales[1].ticks(5)
      : [];
  const compact = config.compactLabels;
  const labelStep = labels.length > 12 ? Math.ceil(labels.length / (compact ? 5 : 8)) : 1;

  const pctDelta = (curr: number, prev: number | null | undefined) => {
    if (prev == null || prev === 0) return null;
    const pct = Math.round(((curr - prev) / Math.abs(prev)) * 100);
    return {
      delta: `${pct >= 0 ? '+' : ''}${pct}%`,
      deltaPositive: pct >= 0,
    };
  };

  const tooltipRows = (() => {
    if (!tooltip) return [];
    const i = tooltip.index;
    if (isStacked) {
      return stacks
        .filter((s) => (s.values[i] ?? 0) > 0)
        .map((s) => ({ label: s.label, value: s.values[i] ?? 0, color: s.color }));
    }
    if (multiLine) {
      return lines.flatMap((l, li) => {
        const v = l.values[i];
        if (v == null) return [];
        const prev = i > 0 ? l.values[i - 1] : null;
        const d = li === 0 ? pctDelta(v, prev) : null;
        return [{
          label: l.label,
          value: v,
          color: l.color,
          delta: d?.delta,
          deltaPositive: d?.deltaPositive,
        }];
      });
    }
    const p = points[i];
    if (!p) return [];
    const d = pctDelta(p.value, points[i - 1]?.value);
    return [{ label: '', value: p.value, color: stroke, delta: d?.delta, deltaPositive: d?.deltaPositive }];
  })();

  const hoverY = (() => {
    if (!tooltip) return null;
    const i = tooltip.index;
    if (isStacked) return yScale(stacks.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
    if (multiLine) {
      for (let li = 0; li < lines.length; li += 1) {
        const v = lines[li].values[i];
        if (v != null) return yAt(li, v);
      }
      return null;
    }
    return points[i] ? yScale(points[i].value) : null;
  })();

  const hoverColor = tooltipRows[0]?.color ?? stroke;

  return (
    <div style={{ position: 'relative', width, height }}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        <defs>
          {config.areaGradient ? (
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={areaStroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={areaStroke} stopOpacity={0} />
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

          {isGroupedBar
            ? labels.map((label, i) => {
                const groupX = xScale(label) ?? 0;
                const bw = xScale.bandwidth();
                const n = Math.max(lines.length, 1);
                const gap = Math.min(6, bw * 0.12);
                const barW = Math.max((bw - gap * (n - 1)) / n, 6);
                return lines.map((line, li) => {
                  const v = line.values[i];
                  if (v == null) return null;
                  const barX = groupX + li * (barW + gap);
                  const barY = yAt(li, Math.max(v, 0));
                  const barHeight = Math.max(innerHeight - barY, 0);
                  const r = Math.min(10, barW / 2, barHeight / 2);
                  return (
                    <Bar
                      key={`${label}-${line.label}`}
                      x={barX}
                      y={barY}
                      width={barW}
                      height={barHeight}
                      fill={line.color}
                      rx={r}
                      ry={r}
                    />
                  );
                });
              })
            : null}

          {config.variant === 'bar' && !isStacked && !multiLine
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
            ? lines.map((line, lineIndex) => {
                const pathData = labels.map((label, index) => ({
                  label,
                  value: line.values[index] ?? null,
                }));
                const lineScale = seriesYScales?.[lineIndex] ?? yScale;
                return (
                  <React.Fragment key={line.label}>
                    {config.variant === 'area' && lineIndex === 0 ? (
                      <AreaClosed<LinePoint>
                        data={pathData}
                        defined={(d) => d.value != null}
                        x={(d) => getCenterX(d.label)}
                        y={(d) => lineScale(d.value as number)}
                        yScale={lineScale}
                        fill={config.areaGradient ? `url(#${gradId})` : line.color}
                        fillOpacity={config.areaGradient ? 1 : 0.28}
                        curve={curveMonotoneX}
                      />
                    ) : null}
                    <LinePath<LinePoint>
                      data={pathData}
                      defined={(d) => d.value != null}
                      x={(d) => getCenterX(d.label)}
                      y={(d) => lineScale(d.value as number)}
                      stroke={line.color}
                      strokeWidth={2}
                      curve={curveMonotoneX}
                    />
                  </React.Fragment>
                );
              })
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

          {tooltip && hoverY != null ? (
            <circle
              cx={getCenterX(labels[tooltip.index])}
              cy={hoverY}
              r={5.5}
              fill="var(--koala-bg-primary)"
              stroke={hoverColor}
              strokeWidth={2.5}
              pointerEvents="none"
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
                    fill="var(--koala-text-tertiary)"
                    fontSize={12}
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
                  fill={independentY && lines[0] ? lines[0].color : 'var(--koala-text-tertiary)'}
                  fontSize={12}
                  fontFamily="var(--font-family-primary)"
                >
                  {config.valueFormatter(tick, lines[0]?.label)}
                </text>
              ))
            : null}

          {!config.minimal && dualAxis && seriesYScales?.[1]
            ? yTicksRight.map((tick) => (
                <text
                  key={`y-r-${tick}`}
                  x={innerWidth + 8}
                  y={seriesYScales[1](tick)}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fill={lines[1]?.color ?? 'var(--koala-text-tertiary)'}
                  fontSize={12}
                  fontFamily="var(--font-family-primary)"
                >
                  {config.valueFormatter(tick, lines[1]?.label)}
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
          top={Math.max(4, tooltip.top - 72)}
        />
      ) : null}
    </div>
  );
}
