import React from 'react';
import { Badge as CoreBadge } from '../core/badge/badge';

type Status = 'published' | 'draft' | 'updated' | 'created';

const STATUS_VARIANT: Record<Status, 'success' | 'muted' | 'info' | 'promotion'> = {
  published: 'success',
  draft: 'muted',
  updated: 'info',
  created: 'promotion',
};

const VARIANT_MAP: Record<string, 'muted' | 'info' | 'promotion'> = {
  suggestion: 'promotion',
  filter: 'muted',
};

const Badge = ({ variant = 'status', status, children }: {
  variant?: 'status' | 'suggestion' | 'filter'; status?: Status; children: React.ReactNode;
}) => {
  if (variant === 'status' && status) {
    return <CoreBadge variant={STATUS_VARIANT[status]}>{children}</CoreBadge>;
  }
  return <CoreBadge variant={VARIANT_MAP[variant] || 'muted'}>{children}</CoreBadge>;
};

export default Badge;
