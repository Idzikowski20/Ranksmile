import React from 'react';

type Point = { date: string; value: number };

const OrganicTrafficChart = ({ points }: { points: Point[] }) => {
  const W = 400;
  const H = 100;
  const pad = 8;
  const values = points.map((p) => p.value);
  const maxV = Math.max(1, ...values);
  const n = points.length;

  const xAt = (i: number) => (n <= 1 ? W / 2 : pad + ((W - pad * 2) * i) / (n - 1));
  const yAt = (v: number) => H - pad - ((v / maxV) * (H - pad * 2));

  const line = points.length
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(' ')
    : `M${pad},${H - pad}L${W - pad},${H - pad}`;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <path d={line} fill="none" stroke="#74A9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default OrganicTrafficChart;
