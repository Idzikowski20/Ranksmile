import React from 'react';

/** KD scale colors — single source for organic / research tables. */
export function kdDotColor(kd: number | null): string {
  if (kd == null) return 'var(--koala-border-primary)';
  // check-koala-tokens-ignore — difficulty heat scale
  if (kd <= 14) return '#22C55E';
  if (kd <= 29) return '#84CC16';
  if (kd <= 49) return '#EAB308';
  if (kd <= 69) return '#F97316';
  if (kd <= 84) return '#EF4444';
  return '#DC2626';
}

export type KeywordDifficultyDotProps = {
  kd: number | null;
  /** Show numeric value next to the dot */
  showValue?: boolean;
};

export function KeywordDifficultyDot({ kd, showValue = true }: KeywordDifficultyDotProps) {
  if (kd == null) {
    return <span style={{ color: 'var(--koala-text-tertiary)', fontFamily: 'var(--font-family-primary)' }}>—</span>;
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-family-primary)',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--koala-text-primary)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: kdDotColor(kd),
          flexShrink: 0,
        }}
      />
      {showValue ? Math.round(kd) : null}
    </span>
  );
}

export default KeywordDifficultyDot;
