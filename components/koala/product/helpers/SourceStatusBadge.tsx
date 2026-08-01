import React from 'react';
import { Badge, type BadgeAppearance } from '../../core/badge/badge';

export type SourceStatusKind = 'yes' | 'no' | 'positive' | 'neutral' | 'negative' | 'unknown';

const MAP: Record<SourceStatusKind, { appearance: BadgeAppearance; label: string }> = {
  yes: { appearance: 'success', label: 'Yes' },
  no: { appearance: 'muted', label: 'No' },
  positive: { appearance: 'success', label: 'Positive' },
  neutral: { appearance: 'muted', label: 'Neutral' },
  negative: { appearance: 'danger', label: 'Negative' },
  unknown: { appearance: 'muted', label: '—' },
};

export type SourceStatusBadgeProps = {
  kind: SourceStatusKind;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
};

export function SourceStatusBadge({ kind, label, size = 'sm' }: SourceStatusBadgeProps) {
  const m = MAP[kind] ?? MAP.unknown;
  return (
    <Badge appearance={m.appearance} size={size}>
      {label ?? m.label}
    </Badge>
  );
}

export default SourceStatusBadge;
