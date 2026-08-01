import React from 'react';
import styled from '@emotion/styled';
import { greyNeutral, green, yellow, blue, red } from '../tokens/colors';
import { radius } from '../tokens/effects';
import { typeface } from '../tokens/typography';

export type StatusTone =
  | 'pending'
  | 'queued'
  | 'running'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'failed';

const TONE: Record<StatusTone, { bg: string; fg: string; label: string }> = {
  pending: { bg: greyNeutral[100], fg: greyNeutral[700], label: 'Pending' },
  queued: { bg: blue[50], fg: blue[700], label: 'Queued' },
  running: { bg: yellow[50], fg: yellow[800], label: 'Running' },
  processing: { bg: yellow[50], fg: yellow[800], label: 'Processing' },
  completed: { bg: green[50], fg: green[700], label: 'Completed' },
  cancelled: { bg: greyNeutral[100], fg: greyNeutral[600], label: 'Cancelled' },
  failed: { bg: red[50], fg: red[700], label: 'Failed' },
};

const Pill = styled.span<{ $bg: string; $fg: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: ${radius.full};
  background: ${(p) => p.$bg};
  color: ${(p) => p.$fg};
  font-family: ${typeface.body};
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  letter-spacing: -0.06px;
  white-space: nowrap;
`;

const Dot = styled.span<{ $fg: string }>`
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: ${(p) => p.$fg};
  flex-shrink: 0;
`;

export type StatusBadgeProps = {
  status: StatusTone;
  label?: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const t = TONE[status];
  return (
    <Pill className={className} $bg={t.bg} $fg={t.fg}>
      <Dot $fg={t.fg} aria-hidden="true" />
      {label ?? t.label}
    </Pill>
  );
}

/** @deprecated use StatusBadge */
export const Status = StatusBadge;

export default StatusBadge;
