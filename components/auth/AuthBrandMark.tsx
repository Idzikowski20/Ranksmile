import React from 'react';
import { BounceSmileyAnimation } from '../common/BounceSmileyAnimation';

/** Animated Ranksmile / Smily mark for auth card headers. */
export default function AuthBrandMark({ size = 56 }: { size?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 16,
      }}
      aria-hidden="true"
    >
      <BounceSmileyAnimation compact size={size} entrance={false} />
    </div>
  );
}
