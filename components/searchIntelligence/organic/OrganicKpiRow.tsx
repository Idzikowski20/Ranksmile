import React, { useMemo } from 'react';
import { Bar } from '../../charts/bar';
import { BarChart } from '../../charts/bar-chart';
import { LineChart } from '../../charts/line-chart';
import { Line } from '../../charts/line';
import { LineSeriesTerminalMarker } from '../../charts/line-series-terminal-marker';
import type { OrganicMetrics } from '../../../lib/organicResearch/types';

const FONT = 'var(--font-family-primary)';
const TRAFFIC_LINE = '#5B7CE8';
const KEYWORDS_BAR = '#B8C4F0';
const KEYWORDS_BAR_CURRENT = '#6B7FD7';

export type SummaryMetric = 'keywords' | 'traffic' | 'trafficCost';

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) {
    const v = n / 1000;
    return `${v >= 10 ? Math.round(v) : Number(v.toFixed(1))}K`;
  }
  if (n >= 100) return String(Math.round(n));
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function formatTrafficCost(n: number): string {
  if (n >= 1000) return `$${formatCompact(n)}`;
  return `$${n.toFixed(1)}`;
}

function Delta({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <span style={{ color: '#6A6772', fontSize: 12, fontFamily: FONT }}>—</span>;
  }
  const up = pct >= 0;
  return (
    <span style={{
      color: up ? '#1A9E72' : '#E03E3E',
      fontSize: 12,
      fontWeight: 500,
      fontFamily: FONT,
      lineHeight: 1,
    }}
    >
      {pct.toFixed(2)}%
    </span>
  );
}

/** Bklit BarChart sparkline for Keywords KPI — last bar darker (current). */
function MiniKeywordsBarSpark({ values }: { values: number[] }) {
  const data = useMemo(
    () => values.map((value, i) => {
      const isLast = i === values.length - 1;
      return {
        label: String(i),
        past: isLast ? 0 : value,
        current: isLast ? value : 0,
      };
    }),
    [values],
  );

  if (!values.length) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        width: 168,
        height: 40,
        flexShrink: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <BarChart
        data={data}
        xDataKey="label"
        stacked
        barGap={0.18}
        aspectRatio="168 / 40"
        margin={{ top: 4, right: 2, bottom: 2, left: 2 }}
        animationDuration={900}
        style={{ width: '100%', height: '100%' }}
      >
        <Bar dataKey="past" fill={KEYWORDS_BAR} stroke={KEYWORDS_BAR} lineCap={2} />
        <Bar dataKey="current" fill={KEYWORDS_BAR_CURRENT} stroke={KEYWORDS_BAR_CURRENT} lineCap={2} />
      </BarChart>
    </div>
  );
}

/** Bklit LineChart sparkline for Traffic KPI. */
function MiniTrafficLineSpark({ values }: { values: number[] }) {
  const data = useMemo(
    () => values.map((value, i) => ({
      date: new Date(Date.UTC(2024, 0, 1 + i)),
      value,
    })),
    [values],
  );

  if (!values.length) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        width: 168,
        height: 40,
        flexShrink: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <LineChart
        data={data}
        xDataKey="date"
        aspectRatio="168 / 40"
        margin={{ top: 6, right: 8, bottom: 4, left: 2 }}
        animationDuration={900}
        yDomainTween={false}
        style={{ width: '100%', height: '100%' }}
      >
        <Line
          dataKey="value"
          stroke={TRAFFIC_LINE}
          strokeWidth={1.75}
          fadeEdges={false}
          showHighlight={false}
          showMarkers={false}
        />
        <LineSeriesTerminalMarker
          dataKey="value"
          stroke={TRAFFIC_LINE}
          fill={TRAFFIC_LINE}
          radius={3}
          strokeWidth={0}
        />
      </LineChart>
    </div>
  );
}

type CellProps = {
  id: SummaryMetric;
  label: string;
  value: string;
  delta: number | null;
  selected: boolean;
  onSelect?: () => void;
  chart?: React.ReactNode;
  showCaret?: boolean;
  hint?: string | null;
  title?: string;
};

function SummaryCell({
  id, label, value, delta, selected, onSelect, chart, showCaret, hint, title,
}: CellProps) {
  const clickable = !!onSelect;
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, height: '100%' }} title={title}>
      <div
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-current={selected || undefined}
        aria-label={`${label} ${value}`}
        data-at={`summary-${id}`}
        onClick={onSelect}
        onKeyDown={clickable ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.();
          }
        } : undefined}
        style={{
          height: '100%',
          cursor: clickable ? 'pointer' : 'default',
          outline: 'none',
        }}
      >
        <div style={{ marginBottom: 4 }}>
          <span style={{
            fontSize: 13,
            lineHeight: '20px',
            color: '#6A6772',
            fontFamily: FONT,
            fontWeight: 400,
          }}
          >
            {label}
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          rowGap: 4,
        }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', marginRight: 4 }}>
            <span style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#181225',
              fontFamily: FONT,
              lineHeight: 1.15,
              paddingRight: 4,
            }}
            >
              {value}
            </span>
            <Delta pct={delta} />
          </div>
          {chart ? <div data-at="chart-wrapper">{chart}</div> : null}
        </div>
        {hint ? (
          <div style={{
            marginTop: 4,
            fontSize: 11,
            lineHeight: 1.3,
            color: '#878490',
            fontFamily: FONT,
          }}
          >
            {hint}
          </div>
        ) : null}
      </div>
      {showCaret && selected && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -13,
            transform: 'translateX(-50%)',
            width: 12,
            height: 8,
            zIndex: 2,
          }}
        >
          <div style={{
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '8px solid #DAD9DE',
            margin: '0 auto',
          }}
          />
          <div style={{
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '7px solid #fff',
            margin: '-9px auto 0',
          }}
          />
        </div>
      )}
    </div>
  );
}

function Divider() {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      style={{
        width: 1,
        alignSelf: 'stretch',
        background: '#DAD9DE',
        marginLeft: 24,
        marginRight: 24,
        flexShrink: 0,
      }}
    />
  );
}

type Props = {
  metrics: OrganicMetrics;
  keywordSeries: number[];
  trafficSeries: number[];
  selected?: SummaryMetric | null;
  onSelect?: (metric: SummaryMetric) => void;
  /** When trend panel is open under this card, square off bottom corners. */
  connectedBelow?: boolean;
  /** Hide Traffic Cost (e.g. GSC-only mode). Hybrid keeps it visible. */
  hideTrafficCost?: boolean;
};

export default function OrganicKpiRow({
  metrics,
  keywordSeries,
  trafficSeries,
  selected = 'keywords',
  onSelect,
  connectedBelow = false,
  hideTrafficCost = false,
}: Props) {
  const gscHint = metrics.gscClicks != null
    ? `GSC actual clicks (28d): ${formatCompact(metrics.gscClicks)}`
    : null;

  return (
    <div
      aria-label="Domain summary"
      data-at="positions-summary-widget"
      style={{
        background: '#fff',
        border: '1px solid #DAD9DE',
        borderRadius: connectedBelow ? '8px 8px 0 0' : 8,
        borderBottom: connectedBelow ? '1px solid #DAD9DE' : undefined,
        padding: '16px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 56 }}>
        <SummaryCell
          id="keywords"
          label="Keywords"
          title="Keywords bringing users via Google's top 100 organic results."
          value={formatCompact(metrics.keywordCount)}
          delta={metrics.keywordCountDeltaPct}
          selected={selected === 'keywords'}
          onSelect={onSelect ? () => onSelect('keywords') : undefined}
          showCaret={connectedBelow}
          chart={keywordSeries.length ? <MiniKeywordsBarSpark values={keywordSeries} /> : null}
        />
        <Divider />
        <SummaryCell
          id="traffic"
          label="Traffic"
          title="Expected monthly organic visits if traffic stays roughly the same (ETV)."
          value={formatCompact(metrics.traffic)}
          delta={metrics.trafficDeltaPct}
          selected={selected === 'traffic'}
          onSelect={onSelect ? () => onSelect('traffic') : undefined}
          showCaret={connectedBelow}
          chart={trafficSeries.length ? <MiniTrafficLineSpark values={trafficSeries} /> : null}
          hint={gscHint}
        />
        {!hideTrafficCost && (
          <>
            <Divider />
            <SummaryCell
              id="trafficCost"
              label="Traffic Cost"
              title="Estimated monthly cost to get the same traffic via Google Ads."
              value={formatTrafficCost(metrics.trafficCost)}
              delta={metrics.trafficCostDeltaPct}
              selected={false}
            />
          </>
        )}
      </div>
    </div>
  );
}

export { formatCompact };
