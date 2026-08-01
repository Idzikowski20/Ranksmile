import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import type { SentryTheme } from '../theme';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

/** Koala Minimal skeleton — hairline rows, no vertical grid (Figma Tables). */
const SkeletonWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const SkeletonRow = styled.div<{ $index: number }>`
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 56px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--koala-border-primary, #e5e5e5);
  animation: ${pulse} 1.5s ease-in-out infinite;
  animation-delay: ${({ $index }) => $index * 0.08}s;
`;

const SkeletonCell = styled.div<{ $width: string; $height?: string }>(({ $width, $height = '14px', theme: t }) => ({
  width: $width,
  height: $height,
  borderRadius: (t as SentryTheme).radius.sm,
  background: (t as SentryTheme).tokens.background.transparent.neutral.muted,
  flexShrink: 0,
}));

interface SkeletonProps {
  rows?: number;
  columns?: number;
}

export function Skeleton({ rows = 5, columns: _columns = 4 }: SkeletonProps) {
  return (
    <SkeletonWrapper>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} $index={i}>
          <SkeletonCell $width="20px" $height="20px" />
          <SkeletonCell $width="40%" />
          <SkeletonCell $width="25%" />
          <SkeletonCell $width="15%" />
        </SkeletonRow>
      ))}
    </SkeletonWrapper>
  );
}

export { Skeleton as default };
