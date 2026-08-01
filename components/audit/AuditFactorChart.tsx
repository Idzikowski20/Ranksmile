import React, { useCallback, useMemo, useState } from 'react';
import { ParentSize } from '@visx/responsive';
import { scaleBand, scaleLinear } from '@visx/scale';
import { PatternLines } from '@visx/pattern';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { localPoint } from '@visx/event';
import { AuditFactor } from '../../lib/auditTypes';

const FONT = 'var(--font-family-primary)';
const YOU = '#9158D5';
const YOU_STROKE = '#7934CB';
const COMP = '#CBD5E0';
const RANGE = '#68D391';
const RANGE_HATCH = '#9AE6B4';
const MARGIN = { top: 28, right: 12, bottom: 52, left: 44 };

interface ChartBar {
  cat: string;
  host: string;
  link: string;
  value: number;
  you: boolean;
}

function formatValue(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Ranksmile-style factor chart (visx): "You" vs competitors, optional hatched
 * suggested-range band, value labels, hover cursor pill, clickable competitor bars.
 */
const AuditFactorChart = ({ factor, height = 300 }: { factor: AuditFactor; height?: number }) => {
  const hasRange =
    factor.suggestedMin !== null &&
    factor.suggestedMax !== null &&
    factor.suggestedMax > 0;

  const bars: ChartBar[] = useMemo(
    () => [
      { cat: 'You', host: 'You', link: '', value: factor.you, you: true },
      ...[...factor.competitors]
        .sort((a, b) => a.rank - b.rank)
        .map((c) => ({
          cat: `${c.label}\n#${c.rank} in Google`,
          host: c.label || 'Competitor',
          link: c.url || '',
          value: c.value,
          you: false,
        })),
    ],
    [factor],
  );

  return (
    <div>
      <div style={{ width: '100%', height }}>
        <ParentSize>
          {({ width }) =>
            width > 0 ? (
              <FactorBars
                width={width}
                height={height}
                bars={bars}
                factor={factor}
                hasRange={hasRange}
              />
            ) : null
          }
        </ParentSize>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 24,
          marginTop: 4,
          fontSize: 13,
          color: '#3F3F47',
          fontFamily: FONT,
        }}
      >
        <LegendSwatch color={YOU} label="You" />
        <LegendSwatch color={COMP} label="Competitors" />
        {hasRange && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                display: 'inline-block',
                flexShrink: 0,
                backgroundColor: 'rgba(154,230,180,0.18)',
                backgroundImage: `repeating-linear-gradient(45deg, ${RANGE_HATCH} 0 1.5px, transparent 1.5px 5px)`,
                border: `1px solid ${RANGE}`,
              }}
            />
            Suggested range
          </span>
        )}
      </div>
      {factor.placeholder && (
        <div style={{ fontSize: 11, color: '#9F9FA9', fontFamily: FONT, textAlign: 'right', marginTop: 2 }}>
          Competitor bars &amp; suggested range are sample data — real SERP data lands in the next phase
        </div>
      )}
    </div>
  );
};

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          display: 'inline-block',
          flexShrink: 0,
          background: color,
        }}
      />
      {label}
    </span>
  );
}

function FactorBars({
  width,
  height,
  bars,
  factor,
  hasRange,
}: {
  width: number;
  height: number;
  bars: ChartBar[];
  factor: AuditFactor;
  hasRange: boolean;
}) {
  const [hover, setHover] = useState<{ y: number; value: number } | null>(null);

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const dataMax = Math.max(
    ...bars.map((b) => b.value),
    hasRange ? (factor.suggestedMax as number) : 0,
    1,
  );
  const yDomainMax = dataMax * 1.08;

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        domain: bars.map((b) => b.cat),
        range: [0, innerW],
        padding: 0.28,
      }),
    [bars, innerW],
  );

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, yDomainMax],
        range: [innerH, 0],
        nice: true,
      }),
    [innerH, yDomainMax],
  );

  const onMove = useCallback((event: React.MouseEvent<SVGRectElement>, bar: ChartBar) => {
    const pt = localPoint(event);
    if (!pt) return;
    setHover({ y: pt.y - MARGIN.top, value: bar.value });
  }, []);

  const patternId = `audit-range-${factor.key}`;
  const yTicks = yScale.ticks(5);

  return (
    <svg width={width} height={height} style={{ fontFamily: FONT, overflow: 'visible' }}>
      <PatternLines
        id={patternId}
        height={6}
        width={6}
        stroke={RANGE_HATCH}
        strokeWidth={1}
        orientation={['diagonal']}
      />
      <Group left={MARGIN.left} top={MARGIN.top}>
        {hasRange && (
          <g>
            <rect
              x={0}
              y={yScale(factor.suggestedMax as number)}
              width={innerW}
              height={Math.max(
                0,
                yScale(factor.suggestedMin as number) - yScale(factor.suggestedMax as number),
              )}
              fill={`url(#${patternId})`}
              fillOpacity={0.35}
            />
            <rect
              x={0}
              y={yScale(factor.suggestedMax as number)}
              width={innerW}
              height={Math.max(
                0,
                yScale(factor.suggestedMin as number) - yScale(factor.suggestedMax as number),
              )}
              fill={RANGE_HATCH}
              fillOpacity={0.12}
            />
            <line
              x1={0}
              x2={innerW}
              y1={yScale(factor.suggestedMin as number)}
              y2={yScale(factor.suggestedMin as number)}
              stroke={RANGE}
              strokeWidth={2}
            />
            <line
              x1={0}
              x2={innerW}
              y1={yScale(factor.suggestedMax as number)}
              y2={yScale(factor.suggestedMax as number)}
              stroke={RANGE}
              strokeWidth={2}
            />
          </g>
        )}

        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={0}
              x2={innerW}
              y1={yScale(t)}
              y2={yScale(t)}
              stroke="#000"
              strokeOpacity={0.08}
            />
            <text
              x={-8}
              y={yScale(t)}
              dy={3}
              textAnchor="end"
              fill="#9F9FA9"
              fontSize={11}
              fontFamily={FONT}
            >
              {formatValue(t)}
            </text>
          </g>
        ))}

        {bars.map((bar) => {
          const x = xScale(bar.cat) ?? 0;
          const bw = xScale.bandwidth();
          const y = yScale(bar.value);
          const h = Math.max(0, innerH - y);
          const labelLines = bar.cat.split('\n');
          return (
            <g key={bar.cat}>
              <Bar
                x={x}
                y={y}
                width={bw}
                height={h}
                fill={bar.you ? YOU : COMP}
                fillOpacity={bar.you ? 1 : factor.placeholder ? 0.5 : 1}
                stroke={bar.you ? YOU_STROKE : 'none'}
                strokeWidth={bar.you ? 1 : 0}
                rx={3}
                style={{ cursor: bar.link ? 'pointer' : 'default' }}
                onMouseMove={(e) => onMove(e, bar)}
                onMouseLeave={() => setHover(null)}
                onClick={() => {
                  if (bar.link) window.open(bar.link, '_blank', 'noopener,noreferrer');
                }}
              />
              <text
                x={x + bw / 2}
                y={y - 6}
                textAnchor="middle"
                fill="#18181B"
                fontSize={12}
                fontFamily={FONT}
              >
                {formatValue(bar.value)}
              </text>
              {labelLines.map((line, i) => (
                <text
                  key={`${bar.cat}-${line}`}
                  x={x + bw / 2}
                  y={innerH + 14 + i * 13}
                  textAnchor="middle"
                  fill="#52525C"
                  fontSize={11}
                  fontFamily={FONT}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}

        {hover && (
          <g>
            <line
              x1={0}
              x2={innerW}
              y1={Math.min(innerH, Math.max(0, hover.y))}
              y2={Math.min(innerH, Math.max(0, hover.y))}
              stroke="#000"
              strokeOpacity={0.4}
              strokeDasharray="3 3"
            />
            <g transform={`translate(0, ${Math.min(innerH, Math.max(0, hover.y))})`}>
              <rect x={-44} y={-11} width={40} height={22} rx={4} fill="#000" />
              <text x={-24} y={4} textAnchor="middle" fill="#fff" fontSize={12} fontFamily={FONT}>
                {formatValue(hover.value)}
              </text>
            </g>
          </g>
        )}
      </Group>
    </svg>
  );
}

export default AuditFactorChart;
