import React from 'react';

type Point = { date: string; value: number };

const TrafficTrendChart = ({ points }: { points: Point[] }) => {
  const W = 800;
  const H = 160;
  const padL = 36;
  const padR = 12;
  const padT = 8;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const values = points.map((p) => p.value);
  const maxV = Math.max(1, ...values);

  const xAt = (i: number) => {
    const n = points.length;
    if (n <= 1) return padL + innerW / 2;
    return padL + (innerW * i) / (n - 1);
  };
  const yAt = (v: number) => padT + innerH - (v / maxV) * innerH;

  const line = points.length
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(' ')
    : `M${padL},${padT + innerH}L${W - padR},${padT + innerH}`;

  const area = points.length
    ? `${line}L${xAt(points.length - 1).toFixed(1)},${padT + innerH}L${xAt(0).toFixed(1)},${padT + innerH}Z`
    : '';

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF6F77" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#FF6F77" stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill="url(#trafficFill)" />}
      <path d={line} fill="none" stroke="#FF6F77" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default TrafficTrendChart;
