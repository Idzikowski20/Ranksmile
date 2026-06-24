import React from 'react';

/** Pulsing placeholder block (uses the global skeletonPulse keyframes). */
const Skeleton = ({ width, height, radius = 6, style }: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) => (
  <div
    aria-hidden="true"
    style={{
      width,
      height,
      borderRadius: radius,
      background: '#F4F4F5',
      animation: 'skeletonPulse 1.6s ease-in-out infinite',
      ...style,
    }}
  />
);

export default Skeleton;
