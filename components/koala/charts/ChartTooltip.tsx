import React from 'react';
import { TrendDeltaBadge } from '../product/helpers/TrendDeltaBadge';
import type { ChartValueFormatter } from './formatters';

/** @internal */
export type ChartTooltipRow = {
  label: string;
  value: number;
  color: string;
  /** Preformatted e.g. "+13%" — shown as outline badge under the row. */
  delta?: string;
  deltaPositive?: boolean | null;
};

export type ChartTooltipProps = {
  label: string;
  rows: ChartTooltipRow[];
  formatter: ChartValueFormatter;
  left: number;
  top: number;
};

/** Koala chart tooltip — Figma Area Chart hover (9977:110306). */
export function ChartTooltip({ label, rows, formatter, left, top }: ChartTooltipProps) {
  const accent = rows[0]?.color ?? 'var(--koala-text-brand)';
  const deltaRow = rows.find((r) => r.delta != null);

  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        left,
        top,
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 6,
        alignItems: 'stretch',
        minWidth: 156,
        padding: 8,
        background: 'var(--koala-bg-primary)',
        border: '1px solid var(--koala-border-primary)',
        borderRadius: 10,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)', // check-koala-tokens-ignore
        fontFamily: 'var(--font-family-primary)',
        color: 'var(--koala-text-primary)',
        pointerEvents: 'none',
        zIndex: 1030, // check-koala-tokens-ignore
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 3,
          alignSelf: 'stretch',
          flexShrink: 0,
          borderRadius: 9999,
          background: accent,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            lineHeight: '16px',
            letterSpacing: '-0.06px',
          }}
        >
          {label}
        </div>
        {rows.map((row) => (
          <div
            key={`${row.label}-${row.value}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 400,
              lineHeight: '16px',
              letterSpacing: '-0.06px',
              opacity: 0.8,
            }}
          >
            {row.label ? <span>{row.label}:</span> : null}
            <span>{formatter(row.value, row.label)}</span>
          </div>
        ))}
        {deltaRow?.delta != null ? (
          <div style={{ paddingTop: 4 }}>
            <TrendDeltaBadge
              delta={deltaRow.delta}
              positive={deltaRow.deltaPositive ?? null}
              variant="outline"
              size="sm"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
