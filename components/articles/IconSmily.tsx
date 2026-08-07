import React from 'react';
import { BounceSmileyAnimation } from '../common/BounceSmileyAnimation';

/** Smily mark (Ranksmile assistant). Compact rotating face for toolbars / chat chrome. */
const IconSmily = ({ size = 20, animate = true }: { size?: number; animate?: boolean }) => (
  <BounceSmileyAnimation compact size={size} animateRotate={animate} entrance={false} />
);

export default IconSmily;
