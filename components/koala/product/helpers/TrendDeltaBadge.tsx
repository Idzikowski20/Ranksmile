import React from 'react';
import { Badge } from '../../core/badge/badge';
import { Icon } from '../../icons/Icon';

export type TrendDeltaBadgeProps = {
  /** Preformatted delta e.g. "+12%" or "83.84%" or raw number */
  delta: string | number;
  /** true = up/good (green), false = down/bad (red), null = flat/muted */
  positive?: boolean | null;
  /** When delta is 0 / "=" show muted equals */
  flatLabel?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /**
   * `filled` — solid Surfer pill (default).
   * `outline` — Figma Analytics Item badge (soft fill + border + trend icon).
   */
  variant?: 'filled' | 'outline';
};

/** Trend % chip — filled (legacy) or outline (Koala Analytics Item / Figma 9834:294099). */
export function TrendDeltaBadge({
  delta,
  positive,
  flatLabel = '=',
  showIcon,
  size = 'md',
  variant = 'filled',
}: TrendDeltaBadgeProps) {
  const text = typeof delta === 'number'
    ? `${delta > 0 ? '+' : ''}${delta}`
    : delta;
  const flat = positive == null || text === '0' || text === '+0' || text === '=' || text === flatLabel;
  const withIcon = showIcon ?? variant === 'outline';

  if (variant === 'outline') {
    if (flat) {
      return (
        <Badge
          appearance="muted"
          size={size}
          style={{
            background: 'var(--koala-bg-primary)',
            border: '1px solid var(--koala-border-primary)',
            color: 'var(--koala-text-secondary)',
            borderRadius: 6,
            height: 20,
            fontSize: 12,
            fontWeight: 500,
            padding: '2px 4px 2px 6px',
          }}
        >
          {flatLabel}
        </Badge>
      );
    }
    const ok = positive !== false;
    return (
      <Badge
        appearance={ok ? 'success' : 'danger'}
        size={size}
        icon={withIcon ? <Icon name={ok ? 'TrendUp' : 'TrendDown'} size={14} weight="bold" /> : undefined}
        style={{
          background: ok ? 'var(--koala-status-success-bg)' : 'var(--koala-status-danger-bg)',
          color: ok ? 'var(--koala-status-success)' : 'var(--koala-status-danger)',
          border: `1px solid color-mix(in srgb, ${ok ? 'var(--koala-status-success)' : 'var(--koala-status-danger)'} 35%, transparent)`,
          borderRadius: 6,
          height: 20,
          fontSize: 12,
          fontWeight: 500,
          padding: '2px 4px 2px 6px',
        }}
      >
        {text}
      </Badge>
    );
  }

  if (flat) {
    return (
      <Badge appearance="muted" size={size}>
        {flatLabel}
      </Badge>
    );
  }
  const ok = positive !== false;
  return (
    <Badge
      appearance={ok ? 'success' : 'danger'}
      size={size}
      icon={withIcon ? <Icon name={ok ? 'ArrowUp' : 'ArrowDown'} size={12} weight="bold" /> : undefined}
      style={{
        background: ok ? 'var(--koala-status-success)' : 'var(--koala-status-danger)',
        color: '#fff',
        fontWeight: 700,
      }}
    >
      {text}
    </Badge>
  );
}

export default TrendDeltaBadge;
