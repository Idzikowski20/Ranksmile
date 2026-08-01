import React from 'react';
import { Sparkline } from '../koala/charts';

type Props = {
  points: number[];
  color?: string;
  height?: number;
  width?: number;
  filled?: boolean;
};

/** Thin wrapper — prefers real series; empty when no points. */
const MiniSparkline = ({ points, height = 32 }: Props) => {
  if (!points.length) return null;
  return (
    <span style={{ display: 'inline-block', width: '100%', height }}>
      <Sparkline
        appearance={points.length > 8 ? 'analytics' : 'minimal'}
        values={points}
        height={height}
        aria-label="Trend"
      />
    </span>
  );
};

export default MiniSparkline;
