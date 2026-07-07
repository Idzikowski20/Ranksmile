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
    className="sentry-skeleton-block"
    style={{ width, height, borderRadius: radius, ...style }}
  />
);

export default Skeleton;
