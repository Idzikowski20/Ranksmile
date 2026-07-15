import React from 'react';

const ASPECT = 80 / 81;

/** Static empty-state illustration (replaces animated Surfy eyes). */
const EmptyEyes = ({ size = 80 }: { size?: number; color?: string }) => {
  const height = Math.round(size * ASPECT);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/nothing-found.svg"
      width={size}
      height={height}
      alt=""
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
    />
  );
};

export default EmptyEyes;
