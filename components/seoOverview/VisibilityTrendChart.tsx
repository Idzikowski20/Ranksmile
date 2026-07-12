import React from 'react';

type Point = { date: string; value: number };

const VisibilityTrendChart = ({ points }: { points: Point[] }) => {
  const W = 600;
  const H = 200;
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const values = points.map((p) => p.value);
  const maxV = Math.max(10, ...values, 1);
  const minV = 0;

  const xAt = (i: number) => {
    const n = points.length;
    if (n <= 1) return padL + innerW / 2;
    return padL + (innerW * i) / (n - 1);
  };
  const yAt = (v: number) => padT + innerH - ((v - minV) / (maxV - minV)) * innerH;

  const line = points.length
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(' ')
    : `M${padL},${yAt(0)}L${W - padR},${yAt(0)}`;

  const area = points.length
    ? `${line}L${xAt(points.length - 1).toFixed(1)},${padT + innerH}L${xAt(0).toFixed(1)},${padT + innerH}Z`
    : '';

  const yTicks = [0, maxV * 0.5, maxV].map((v) => Math.round(v * 10) / 10);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="visTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#74A9FF" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#74A9FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yAt(t)}
            y2={yAt(t)}
            stroke="#F4F4F5"
            strokeWidth="1"
          />
          <text x={padL - 6} y={yAt(t) + 4} textAnchor="end" fontSize="10" fill="#9F9FA9" fontFamily="var(--font-family-primary)">
            {t}%
          </text>
        </g>
      ))}
      {area && <path d={area} fill="url(#visTrendFill)" />}
      <path d={line} fill="none" stroke="#74A9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <text
          key={p.date}
          x={xAt(i)}
          y={H - 6}
          textAnchor="middle"
          fontSize="10"
          fill="#9F9FA9"
          fontFamily="var(--font-family-primary)"
        >
          {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
      ))}
    </svg>
  );
};

export default VisibilityTrendChart;
