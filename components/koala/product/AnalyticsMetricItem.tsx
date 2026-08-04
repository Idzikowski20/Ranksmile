import React from 'react';
import { Icon } from '../icons/Icon';
import { TrendDeltaBadge } from './helpers/TrendDeltaBadge';

export type AnalyticsMetricItemProps = {
  icon: string;
  label: string;
  value: string;
  /** Preformatted delta e.g. "-11%" — omit for no badge. */
  delta?: string | null;
  deltaPositive?: boolean | null;
  period?: string;
  last?: boolean;
  loading?: boolean;
};

/**
 * Koala Analytics Item (Figma 9834:294099) — KPI cell for metric strips
 * (Performance overview, Dashboard overview).
 */
export function AnalyticsMetricItem({
  icon,
  label,
  value,
  delta,
  deltaPositive,
  period,
  last = false,
  loading = false,
}: AnalyticsMetricItemProps) {
  const showDelta = delta != null && delta !== '';

  return (
    <div
      className="koala-analytics-metric-item"
      style={{
        flex: '1 0 0',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        paddingRight: last ? 0 : 24,
        borderRight: last ? 'none' : '1px solid var(--koala-border-primary)',
        fontFamily: 'var(--font-family-primary)',
        textAlign: 'left',
        boxSizing: 'border-box',
        opacity: loading ? 0.55 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
        <Icon name={icon} size={20} weight="bold" color="var(--koala-text-primary)" />
        <span
          style={{
            flex: '1 1 0',
            minWidth: 0,
            fontSize: 14,
            fontWeight: 500,
            lineHeight: '20px',
            letterSpacing: '-0.4px',
            color: 'var(--koala-text-primary)',
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 30,
              fontWeight: 700,
              lineHeight: '36px',
              letterSpacing: '-0.07px',
              color: 'var(--koala-text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? '—' : value}
          </span>
          {showDelta && !loading ? (
            <div style={{ paddingBottom: 6 }}>
              <TrendDeltaBadge
                delta={delta}
                positive={deltaPositive ?? null}
                variant="outline"
                size="sm"
              />
            </div>
          ) : null}
        </div>
        {period ? (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 400,
              lineHeight: '20px',
              letterSpacing: '-0.4px',
              color: 'var(--koala-text-tertiary)',
            }}
          >
            {period}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default AnalyticsMetricItem;
