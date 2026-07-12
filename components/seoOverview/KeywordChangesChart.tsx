import React from 'react';

type Point = { date: string; improved: number; declined: number };

const KeywordChangesChart = ({ points }: { points: Point[] }) => {
  const W = 400;
  const H = 80;
  const padL = 8;
  const padR = 8;
  const padB = 20;
  const barW = Math.max(4, (W - padL - padR) / Math.max(points.length, 1) - 2);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {points.map((p, i) => {
        const x = padL + i * (barW + 2);
        const h = Math.min(H - padB - 4, p.improved * 12 + 4);
        return (
          <rect
            key={p.date}
            x={x}
            y={H - padB - h}
            width={barW}
            height={h}
            fill="#1AB25E"
            rx={2}
          />
        );
      })}
    </svg>
  );
};

export default KeywordChangesChart;
