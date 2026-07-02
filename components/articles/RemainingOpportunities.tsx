import React from 'react';

interface Props {
  rows: Array<{ label: string; count: number }>;
}

const F = 'var(--font-family-primary)';

/** Count badge — pill, dark text on white when > 0, muted when 0. */
const CountBadge = ({ count }: { count: number }) => {
  const zero = count === 0;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 20,
        padding: '2px 8px',
        borderRadius: 9999,
        background: zero ? 'transparent' : '#FFFFFF',
        border: zero ? 'none' : '1px solid #E4E4E7',
        color: zero ? '#9f9fa9' : '#18181B',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: '16px',
        fontFamily: F,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {count}
    </span>
  );
};

/**
 * Pure presentational panel — compact list of uncovered AI-coverage buckets (from
 * `lib/liveCoverage.ts` `remainingOpportunities`). Renders nothing when `rows` is empty
 * (everything covered). Zero-count rows are rendered muted rather than hidden, so the
 * bucket list stays stable as counts change.
 */
const RemainingOpportunities = ({ rows }: Props) => {
  if (!rows.length) return null;

  return (
    <div
      style={{
        background: '#f8f9ff',
        border: '1px solid #E4E4E7',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: F,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          lineHeight: '16px',
          color: '#52525C',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Remaining AI Opportunities
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row) => {
          const muted = row.count === 0;
          return (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  lineHeight: '18px',
                  color: muted ? '#9f9fa9' : '#18181B',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.label}
              </span>
              <CountBadge count={row.count} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RemainingOpportunities;
