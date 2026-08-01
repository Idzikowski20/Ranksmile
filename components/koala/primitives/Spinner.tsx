import React from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { brandMain } from '../tokens/colors';
import { motionDuration } from '../tokens/motion';

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Ring = styled.span<{ $size: number; $color: string }>`
  display: inline-block;
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border: 2px solid ${(p) => p.$color}33;
  border-top-color: ${(p) => p.$color};
  border-radius: 999px;
  animation: ${spin} ${motionDuration.slow * 4}ms linear infinite;
  flex-shrink: 0;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    border-top-color: ${(p) => p.$color};
    opacity: 0.7;
  }
`;

export type SpinnerProps = {
  size?: number;
  color?: string;
  className?: string;
  label?: string;
};

/** Koala Spinner — Figma `3950:179134`. */
export function Spinner({ size = 20, color = brandMain, className, label = 'Loading' }: SpinnerProps) {
  return <Ring className={className} $size={size} $color={color} role="status" aria-label={label} />;
}

export default Spinner;
