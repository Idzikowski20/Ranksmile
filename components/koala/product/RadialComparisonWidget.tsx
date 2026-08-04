import React, { useMemo, useState } from 'react';
import { CompactSelect } from '../core';
import { Icon } from '../icons/Icon';
import { TrendDeltaBadge } from './helpers/TrendDeltaBadge';
import { brandMain, green, greyNeutral, orange, purple, yellow } from '../tokens/colors';

export type RadialSegment = {
  id: string;
  label: string;
  value: number;
  color: string;
  /** Optional tooltip value override (formatted). */
  displayValue?: string;
  /** Optional per-segment delta e.g. "+13%". */
  delta?: string;
  deltaPositive?: boolean | null;
};

export type RadialComparisonWidgetProps = {
  title: string;
  /** Large headline value (preformatted). */
  value: string;
  /** Delta chip next to value, e.g. "+13% vs last week". */
  deltaLabel?: string | null;
  deltaPositive?: boolean | null;
  segments: RadialSegment[];
  periodOptions?: Array<{ value: string; label: string }>;
  period?: string;
  onPeriodChange?: (value: string) => void;
  periodLabel?: string;
  className?: string;
  /** Badge / title adornment (e.g. beta). */
  badge?: React.ReactNode;
  emptyLabel?: string;
  /** When false, omit outer card chrome (for embedding in a parent split card). */
  framed?: boolean;
};

const FONT = 'var(--font-family-primary)';
const SIZE = 190;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const GAP_DEG = 3;

/** Default palette order from Figma Radial widget (9963:582207). */
export const RADIAL_SEGMENT_COLORS = [
  purple[500],
  orange[400],
  yellow[500],
  brandMain,
  green[500],
] as const;

function polar(angleDeg: number, radius = R) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

function describeArc(startAngle: number, endAngle: number): string {
  const sweep = Math.max(0.01, endAngle - startAngle);
  const start = polar(startAngle);
  const end = polar(startAngle + sweep);
  const large = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${large} 1 ${end.x} ${end.y}`;
}

function formatSegmentValue(seg: RadialSegment): string {
  if (seg.displayValue != null) return seg.displayValue;
  if (Number.isInteger(seg.value)) return String(seg.value);
  return seg.value.toLocaleString('en-US');
}

type Arc = RadialSegment & { start: number; end: number; path: string };

/**
 * Koala Radial Comparison widget — Figma `9963:582207` (Weekly comparison / Hover).
 * Template for Site Health, AI Search Health, and similar breakdowns.
 */
export function RadialComparisonWidget({
  title,
  value,
  deltaLabel,
  deltaPositive,
  segments,
  periodOptions,
  period,
  onPeriodChange,
  periodLabel,
  className,
  badge,
  emptyLabel = 'No data yet.',
  framed = true,
}: RadialComparisonWidgetProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const arcs = useMemo((): Arc[] => {
    const usable = segments.filter((s) => s.value > 0);
    const total = usable.reduce((sum, s) => sum + s.value, 0);
    if (total <= 0) return [];
    const gapTotal = usable.length * GAP_DEG;
    const span = Math.max(0, 360 - gapTotal);
    let cursor = 0;
    return usable.map((s) => {
      const slice = (s.value / total) * span;
      const start = cursor;
      const end = cursor + slice;
      cursor = end + GAP_DEG;
      return { ...s, start, end, path: describeArc(start, end) };
    });
  }, [segments]);

  const active = arcs.find((a) => a.id === activeId) ?? null;
  const showPeriod = Boolean(periodOptions?.length || periodLabel);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: framed ? 16 : 16,
        borderRadius: framed ? 16 : 0,
        border: framed ? '1px solid var(--koala-border-primary)' : 'none',
        background: 'var(--koala-bg-primary)',
        fontFamily: FONT,
        boxSizing: 'border-box',
        width: '100%',
        minWidth: 0,
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', width: '100%' }}>
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Icon name="CalendarBlank" size={20} weight="bold" color="var(--koala-text-brand)" />
            <span
              style={{
                fontSize: 16,
                fontWeight: 500,
                lineHeight: '24px',
                letterSpacing: '-0.25px',
                color: 'var(--koala-text-primary)',
              }}
            >
              {title}
            </span>
            {badge}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 32,
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: '-0.96px',
                color: 'var(--koala-text-primary)',
              }}
            >
              {value}
            </span>
            {deltaLabel ? (
              <TrendDeltaBadge
                delta={deltaLabel}
                positive={deltaPositive ?? (deltaLabel.startsWith('-') ? false : true)}
                variant="outline"
                size="sm"
              />
            ) : null}
          </div>
        </div>

        {showPeriod ? (
          periodOptions?.length ? (
            <CompactSelect
              size="sm"
              options={periodOptions}
              value={period}
              triggerLabel={periodLabel ?? periodOptions.find((o) => o.value === period)?.label ?? 'Weekly'}
              onChange={(opt) => onPeriodChange?.(String(opt.value))}
            />
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 4px 2px 8px',
                borderRadius: 8,
                border: '1px solid var(--koala-border-primary)',
                background: 'var(--koala-bg-primary)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)', // check-koala-tokens-ignore
                fontSize: 14,
                fontWeight: 500,
                lineHeight: '20px',
                letterSpacing: '-0.4px',
                color: 'var(--koala-text-primary)',
                flexShrink: 0,
              }}
            >
              {periodLabel}
              <Icon name="CaretDown" size={16} weight="bold" />
            </span>
          )
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', width: '100%', flexWrap: 'wrap' }}>
        <div
          style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}
          onMouseLeave={() => setActiveId(null)}
        >
          {arcs.length === 0 ? (
            <div
              style={{
                width: SIZE,
                height: SIZE,
                borderRadius: '50%',
                border: `${STROKE}px solid ${greyNeutral[200]}`,
                boxSizing: 'border-box',
              }}
              aria-hidden
            />
          ) : (
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={title}>
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={greyNeutral[200]}
                strokeWidth={STROKE}
              />
              {arcs.map((arc) => {
                const isActive = activeId == null || activeId === arc.id;
                return (
                  <path
                    key={arc.id}
                    d={arc.path}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={STROKE}
                    strokeLinecap="butt"
                    opacity={isActive ? 1 : 0.28}
                    style={{ cursor: 'pointer', transition: 'opacity 120ms ease' }}
                    onMouseEnter={() => setActiveId(arc.id)}
                  />
                );
              })}
            </svg>
          )}

          {active ? (
            <div
              role="tooltip"
              style={{
                position: 'absolute',
                left: '58%',
                top: '28%',
                transform: 'translate(-50%, -100%)',
                display: 'flex',
                gap: 6,
                alignItems: 'stretch',
                minWidth: 156,
                padding: 8,
                background: 'var(--koala-bg-primary)',
                border: '1px solid var(--koala-border-primary)',
                borderRadius: 10,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)', // check-koala-tokens-ignore
                pointerEvents: 'none',
                zIndex: 2,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 3,
                  borderRadius: 9999,
                  background: active.color,
                  flexShrink: 0,
                  alignSelf: 'stretch',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, fontWeight: 700, lineHeight: '16px', letterSpacing: '-0.06px', color: 'var(--koala-text-primary)' }}>
                  {active.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 400, lineHeight: '16px', opacity: 0.8, color: 'var(--koala-text-primary)' }}>
                  {formatSegmentValue(active)}
                </span>
                {active.delta ? (
                  <div style={{ paddingTop: 4 }}>
                    <TrendDeltaBadge
                      delta={active.delta}
                      positive={active.deltaPositive ?? null}
                      variant="outline"
                      size="sm"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            justifyContent: 'center',
            flex: '1 1 140px',
            minWidth: 0,
          }}
        >
          {segments.length === 0 ? (
            <span style={{ fontSize: 14, color: 'var(--koala-text-tertiary)' }}>{emptyLabel}</span>
          ) : (
            segments.map((seg) => {
              const dimmed = activeId != null && activeId !== seg.id;
              const activeRow = activeId === seg.id;
              return (
                <button
                  key={seg.id}
                  type="button"
                  onMouseEnter={() => setActiveId(seg.id)}
                  onFocus={() => setActiveId(seg.id)}
                  onMouseLeave={() => setActiveId(null)}
                  onBlur={() => setActiveId(null)}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    margin: 0,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    opacity: dimmed ? 0.4 : 1,
                    transition: 'opacity 120ms ease',
                    fontFamily: FONT,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 50,
                        background: seg.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        lineHeight: '20px',
                        letterSpacing: '-0.4px',
                        color: activeRow ? 'var(--koala-text-primary)' : 'var(--koala-text-secondary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {seg.label}:
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      lineHeight: '20px',
                      letterSpacing: '-0.4px',
                      color: 'var(--koala-text-primary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatSegmentValue(seg)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default RadialComparisonWidget;
