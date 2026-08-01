import React, { useMemo } from 'react';
import { Chart } from '../../koala/charts';
import type { ChartPreparedData, ChartStackSeries } from '../../koala/charts';
import { chartBucketColors } from '../../koala/tokens/chart';
import { Checkbox } from '../../koala/core';
import type { ChartPoint } from '../../../lib/organicResearch/types';

const FONT = 'var(--font-family-primary)';

type SeriesKey = 'top3' | 'pos4_10' | 'pos11_20' | 'pos21_50' | 'pos51_100' | 'serpFeatures';

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'top3', label: 'Top 3', color: chartBucketColors.top3 },
  { key: 'pos4_10', label: '4-10', color: chartBucketColors.pos4_10 },
  { key: 'pos11_20', label: '11-20', color: chartBucketColors.pos11_20 },
  { key: 'pos21_50', label: '21-50', color: chartBucketColors.pos21_50 },
  { key: 'pos51_100', label: '51-100', color: chartBucketColors.pos51_100 },
  { key: 'serpFeatures', label: 'SERP Features', color: chartBucketColors.serpFeatures },
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

  const prepared: ChartPreparedData = useMemo(() => {
    const labels = points.map((p) => formatAxisLabel(p.date, includeYear));
    const stacks: ChartStackSeries[] = activeSeries.map((s) => ({
      key: s.key,
      label: s.label,
      color: s.color,
      values: points.map((p) => valueOf(p, s.key)),
    }));
    return { labels, stacks };
  }, [points, includeYear, activeSeries]);

  const ranges: { id: Props['range']; label: string }[] = [
    { id: '1m', label: '1M' },
    { id: '6m', label: '6M' },
    { id: '1y', label: '1Y' },
    { id: '2y', label: '2Y' },
    { id: 'all', label: 'All time' },
  ];

  const chartState = loading ? 'loading' : points.length ? 'ready' : 'empty';

  return (
    <div style={{
      background: 'var(--koala-bg-primary, #fff)',
      border: '1px solid var(--koala-border-primary, #e5e5e5)',
      borderRadius: connectedAbove ? '0 0 16px 16px' : 16,
      borderTop: connectedAbove ? 'none' : '1px solid var(--koala-border-primary, #e5e5e5)',
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
                    borderBottom: selected ? '2px solid #F84416' : '2px solid transparent',
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

      <div style={{ width: '100%', minWidth: 0, overflow: 'hidden', minHeight: 220 }}>
        <Chart
          preset="StackedPositions"
          data={prepared}
          state={chartState}
          emptyDescription="No historical data yet"
          overrides={{ height: 280, legend: false }}
          aria-label={title}
        />
      </div>
    </div>
  );
}
