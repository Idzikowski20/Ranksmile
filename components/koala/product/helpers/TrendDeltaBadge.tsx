import React from 'react';
import { Badge } from '../../core/badge/badge';
import { Icon } from '../../icons/Icon';

export type TrendDeltaBadgeProps = {
  /** Preformatted delta e.g. "12" or "83.84%" or raw number */
  delta: string | number;
  /** true = up/good (green), false = down/bad (red), null = flat/muted */
  positive?: boolean | null;
  /** When delta is 0 / "=" show muted equals */
  flatLabel?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

export function TrendDeltaBadge({
  delta,
  positive,
  flatLabel = '=',
  showIcon = true,
  size = 'md',
}: TrendDeltaBadgeProps) {
  const text = typeof delta === 'number' ? String(Math.abs(delta)) : delta;
  if (positive == null || text === '0' || text === '=' || text === flatLabel) {
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
      icon={showIcon ? <Icon name={ok ? 'ArrowUp' : 'ArrowDown'} size={12} weight="bold" /> : undefined}
    >
      {text}
    </Badge>
  );
}

export default TrendDeltaBadge;
