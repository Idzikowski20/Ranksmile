import React from 'react';

interface Props {
  rows: Array<{ label: string; delta: number }>;
}

const CheckIcon = () => (
  <svg width={13} height={13} viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M4 10.5L8 14.5L16 6" stroke="#1AB25E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Pure presentational list — one row per positive score-attribution bucket (from
 * `lib/liveCoverage.ts` `scoreAttribution`). Renders nothing when `rows` is empty.
 */
const AoScoreAttribution = ({ rows }: Props) => {
  if (!rows.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font-family-primary)',
            fontSize: 13,
            lineHeight: '16px',
          }}
        >
          <CheckIcon />
          <span style={{ color: '#18181B' }}>{row.label}</span>
          <span style={{ color: '#1AB25E', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            +{row.delta}
          </span>
        </div>
      ))}
    </div>
  );
};

export default AoScoreAttribution;
