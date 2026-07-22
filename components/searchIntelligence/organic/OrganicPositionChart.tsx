import React, { useMemo } from 'react';
import { Bar } from '../../charts/bar';
import { BarChart } from '../../charts/bar-chart';
import { BarXAxis } from '../../charts/bar-x-axis';
import { Grid } from '../../charts/grid';
import { ChartTooltip } from '../../charts/tooltip';
import { YAxis } from '../../charts/y-axis';
import { Checkbox } from '../../core';
import type { ChartPoint } from '../../../lib/organicResearch/types';

const FONT = 'var(--font-family-primary)';

type SeriesKey = 'top3' | 'pos4_10' | 'pos11_20' | 'pos21_50' | 'pos51_100' | 'serpFeatures';

/** Semrush Organic Research palette */
const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'top3', label: 'Top 3', color: '#F5C518' },
  { key: 'pos4_10', label: '4-10', color: '#3B3FA0' },
  { key: 'pos11_20', label: '11-20', color: '#6B5BCC' },
  { key: 'pos21_50', label: '21-50', color: '#9B8FE0' },
  { key: 'pos51_100', label: '51-100', color: '#C5BDF0' },
  { key: 'serpFeatures', label: 'SERP Features', color: '#6BCB77' },
];

type Props = {
  chart: ChartPoint[];
  range: '1m' | '6m' | '1y' | '2y' | 'all';
  onRangeChange: (r: Props['range']) => void;
  visible: Record<string, boolean>;
  onToggle: (key: string) => void;
  title?: string;
  onClose?: () => void;
  connectedAbove?: boolean;
  loading?: boolean;
};

/**
 * Chart points are daily (monthly Labs snapshots expanded day-by-day).
 * Ranges map to day counts like Semrush Organic Research.
 */
function sliceChart(chart: ChartPoint[], range: Props['range']): ChartPoint[] {
  if (range === 'all' || !chart.length) return chart;
  const days = range === '1m' ? 31 : range === '6m' ? 183 : range === '1y' ? 365 : 730;
  return chart.slice(-days);
}

function formatAxisLabel(iso: string, includeYear: boolean): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  if (includeYear) {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
      timeZone: 'UTC',
    });
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function valueOf(p: ChartPoint, key: SeriesKey): number {
  if (key === 'serpFeatures') return Number(p.serpFeatures || 0);
  return Number(p[key] || 0);
}

export default function OrganicPositionChart({
  chart,
  range,
  onRangeChange,
  visible,
  onToggle,
  title = 'Organic Keywords Trend',
  onClose,
  connectedAbove,
  loading = false,
}: Props) {
  const points = useMemo(() => sliceChart(chart, range), [chart, range]);

  const activeSeries = useMemo(
    () => SERIES.filter((s) => visible[s.key] !== false),
    [visible],
  );

  const includeYear = range === '1y' || range === '2y' || range === 'all';

  const barData = useMemo(
    () => points.map((p) => {
      const row: Record<string, string | number> = {
        label: formatAxisLabel(p.date, includeYear),
        date: p.date,
      };
      for (const s of SERIES) {
        row[s.key] = valueOf(p, s.key);
      }
      return row;
    }),
    [points, includeYear],
  );

  const ranges: { id: Props['range']; label: string }[] = [
    { id: '1m', label: '1M' },
    { id: '6m', label: '6M' },
    { id: '1y', label: '1Y' },
    { id: '2y', label: '2Y' },
    { id: 'all', label: 'All time' },
  ];

  const chartStatus = loading ? 'loading' : 'ready';
  const hasPoints = barData.length > 0;
  const maxLabels = range === '1m' ? 10 : range === '6m' ? 8 : 12;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #DAD9DE',
      borderRadius: connectedAbove ? '0 0 8px 8px' : 8,
      borderTop: connectedAbove ? 'none' : '1px solid #DAD9DE',
      padding: '20px',
    }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
      }}
      >
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#181225',
          fontFamily: FONT,
        }}
        >
          {title}
        </span>
        {onClose && (
          <button
            type="button"
            aria-label="Hide trend data"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 4,
              color: '#878490',
              display: 'inline-flex',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M3.758 3.758a1 1 0 0 0 0 1.414L6.586 8l-2.828 2.828a1 1 0 1 0 1.414 1.414L8 9.414l2.828 2.828a1 1 0 1 0 1.414-1.414L9.414 8l2.828-2.828a1 1 0 1 0-1.414-1.414L8 6.586 5.172 3.758a1 1 0 0 0-1.414 0Z"
              />
            </svg>
          </button>
        )}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
        minHeight: 21,
      }}
      >
        <div
          role="group"
          aria-label="Positions to show"
          style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}
        >
          {SERIES.map((s) => {
            const checked = visible[s.key] !== false;
            return (
              <div
                key={s.key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: '#302E36',
                  fontFamily: FONT,
                }}
              >
                <Checkbox
                  size="sm"
                  checked={checked}
                  onChange={() => onToggle(s.key)}
                />
                <button
                  type="button"
                  onClick={() => onToggle(s.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'inherit',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: s.color,
                      flexShrink: 0,
                      opacity: checked ? 1 : 0.35,
                    }}
                  />
                  {s.label}
                </button>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div role="tablist" aria-label="Time period" style={{ display: 'flex', gap: 0 }}>
            {ranges.map((r) => {
              const selected = range === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onRangeChange(r.id)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: '4px 10px',
                    fontSize: 13,
                    fontFamily: FONT,
                    cursor: 'pointer',
                    color: selected ? '#181225' : '#6A6772',
                    fontWeight: selected ? 600 : 400,
                    borderBottom: selected ? '2px solid #F29964' : '2px solid transparent',
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: 11, color: '#878490', fontFamily: FONT }}>
            Daily bars from monthly DataForSEO Labs snapshots
          </span>
        </div>
      </div>

      {!loading && !hasPoints ? (
        <div style={{
          height: 220,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6A6772',
          fontSize: 13,
          fontFamily: FONT,
        }}
        >
          No historical data yet
        </div>
      ) : (
        <div style={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
          <BarChart
            className="w-full"
            data={hasPoints ? barData : []}
            xDataKey="label"
            stacked
            stackGap={1}
            // Semrush: bars are wider; keep visible spacing without thinning columns too much.
            barGap={barData.length > 180 ? 0.12 : barData.length > 60 ? 0.2 : 0.3}
            // Lower chart height vs width (flatter panel like Semrush).
            aspectRatio="6 / 1"
            margin={{ top: 12, right: 12, bottom: 32, left: 44 }}
            animationDuration={1100}
            revealSignature={`${range}-${activeSeries.map((s) => s.key).join(',')}`}
            status={chartStatus}
          >
            <Grid horizontal fadeHorizontal />
            <YAxis numTicks={3} formatLargeNumbers />
            {activeSeries.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                stroke={s.color}
                lineCap={2}
                animationType="grow"
                stackGap={1}
              />
            ))}
            <BarXAxis maxLabels={maxLabels} />
            <ChartTooltip
              showDatePill={false}
              showDots={false}
              rows={(point) => {
                const rows = activeSeries.map((s) => ({
                  color: s.color,
                  label: s.label,
                  value: Number(point[s.key] || 0),
                }));
                const total = rows.reduce((sum, r) => sum + Number(r.value), 0);
                return [
                  ...rows,
                  { color: '#181225', label: 'Total', value: total },
                ];
              }}
            />
          </BarChart>
        </div>
      )}
    </div>
  );
}
