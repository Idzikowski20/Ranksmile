import React from 'react';

type Props = {
  points: number[];
  color?: string;
  height?: number;
  width?: number;
  filled?: boolean;
};

const MiniSparkline = ({ points, color = '#74A9FF', height = 32, width = 80, filled = false }: Props) => {
  const W = width;
  const H = height;
  const pad = 2;
  const n = points.length;
  const max = Math.max(1, ...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  const xAt = (i: number) => (n <= 1 ? W / 2 : pad + ((W - pad * 2) * i) / (n - 1));
  const yAt = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);

  let line = '';
  if (n === 0) {
    line = `M${pad},${H - pad}L${W - pad},${H - pad}`;
  } else if (n === 1) {
    const y = yAt(points[0]);
    line = `M${pad},${y.toFixed(1)}L${W - pad},${y.toFixed(1)}`;
  } else {
    line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
  }

  const gradId = `spark-${color.replace('#', '')}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }} aria-hidden="true">
      {filled && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {filled && <path d={`${line}L${W - pad},${H - pad}L${pad},${H - pad}Z`} fill={`url(#${gradId})`} />}
      <path fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d={line} />
    </svg>
  );
};

export default MiniSparkline;
