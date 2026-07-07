import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import type { SentryTheme } from '../theme';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

const SkeletonWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 12px 0;
`;

const SkeletonRow = styled.div<{ $index: number }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  animation: ${pulse} 1.5s ease-in-out infinite;
  animation-delay: ${({ $index }) => $index * 0.08}s;
`;

const SkeletonCell = styled.div<{ $width: string; $height?: string }>(({ $width, $height = '14px', theme: t }) => ({
  width: $width,
  height: $height,
  borderRadius: (t as SentryTheme).radius.sm,
  background: (t as SentryTheme).tokens.background.transparent.neutral.muted,
}));

interface SkeletonProps {
  rows?: number;
  columns?: number;
}

export function Skeleton({ rows = 5, columns = 4 }: SkeletonProps) {
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
