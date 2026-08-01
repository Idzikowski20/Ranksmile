import React, { useMemo } from 'react';
import { Sparkline } from '../../koala/charts';
import type { OrganicMetrics } from '../../../lib/organicResearch/types';

const FONT = 'var(--font-family-primary)';

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

const CURRENCY_PREFIX: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  PLN: '',
};

function formatTrafficCost(n: number, currency = 'USD'): string {
  const prefix = CURRENCY_PREFIX[currency] ?? `${currency} `;
  const suffix = currency === 'PLN' ? ' zł' : '';
  const body = n >= 1000 ? formatCompact(n) : n.toFixed(1);
  return `${prefix}${body}${suffix}`;
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
            borderTop: '8px solid #dbded4',
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
        background: '#dbded4',
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
  trafficCostSeries?: number[];
  selected?: SummaryMetric | null;
  onSelect?: (metric: SummaryMetric) => void;
  connectedBelow?: boolean;
  hideTrafficCost?: boolean;
  currency?: string;
};

export default function OrganicKpiRow({
  metrics,
  keywordSeries,
  trafficSeries,
  trafficCostSeries,
  selected = 'keywords',
  onSelect,
  connectedBelow = false,
  hideTrafficCost = false,
  currency = 'USD',
}: Props) {
  const gscHint = metrics.gscClicks != null
    ? `GSC actual clicks (28d): ${formatCompact(metrics.gscClicks)}`
    : null;

  const keywordValues = useMemo(() => keywordSeries.slice(), [keywordSeries]);
  const trafficValues = useMemo(() => trafficSeries.slice(), [trafficSeries]);
  const costValues = useMemo(
    () => (trafficCostSeries?.length ? trafficCostSeries.slice() : []),
    [trafficCostSeries],
  );

  return (
    <div
      aria-label="Domain summary"
      data-at="positions-summary-widget"
      style={{
        background: 'var(--koala-bg-primary, #fff)',
        border: '1px solid var(--koala-border-primary, #e5e5e5)',
        borderRadius: connectedBelow ? '16px 16px 0 0' : 16,
        borderBottom: connectedBelow ? '1px solid var(--koala-border-primary, #e5e5e5)' : undefined,
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
          chart={keywordValues.length ? (
            <Sparkline appearance="compact" values={keywordValues} width={168} height={40} />
          ) : null}
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
          chart={trafficValues.length ? (
            <Sparkline appearance="analytics" values={trafficValues} width={168} height={40} />
          ) : null}
          hint={gscHint}
        />
        {!hideTrafficCost && (
          <>
            <Divider />
            <SummaryCell
              id="trafficCost"
              label="Traffic Cost"
              title="Estimated monthly cost to get the same traffic via Google Ads."
              value={formatTrafficCost(metrics.trafficCost, currency)}
              delta={metrics.trafficCostDeltaPct}
              selected={false}
              chart={costValues.length ? (
                <Sparkline appearance="analytics" values={costValues} width={168} height={40} />
              ) : null}
            />
          </>
        )}
      </div>
    </div>
  );
}

export { formatCompact };
