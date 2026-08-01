import React from 'react';
import type { ChartValueFormatter } from './formatters';

/** @internal */
export type ChartTooltipProps = {
  label: string;
  rows: Array<{ label: string; value: number; color: string }>;
  formatter: ChartValueFormatter;
  left: number;
  top: number;
};

const box: React.CSSProperties = {
  position: 'absolute',
  background: 'var(--koala-bg-primary)',
  border: '1px solid var(--koala-border-primary)',
  borderRadius: 8,
  padding: '8px 12px', // check-koala-tokens-ignore
  fontSize: 12,
  fontFamily: 'var(--font-family-primary)',
  color: 'var(--koala-text-primary)',
  pointerEvents: 'none',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)', // check-koala-tokens-ignore
  zIndex: 1030, // check-koala-tokens-ignore
  whiteSpace: 'nowrap',
  transition: 'opacity 120ms ease',
};

export function ChartTooltip({ label, rows, formatter, left, top }: ChartTooltipProps) {
  return (
    <div style={{ ...box, left, top, transform: 'translateX(-50%)' }} role="tooltip">
      <div style={{ fontWeight: 600, marginBottom: rows.length > 1 ? 6 : 2 }}>{label}</div>
      {rows.map((row) => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
          <span>
            {row.label ? `${row.label}: ` : ''}
            {formatter(row.value, row.label)}
          </span>
        </div>
      ))}
    </div>
  );
}
