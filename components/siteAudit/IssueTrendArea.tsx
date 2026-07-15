import React, { useId } from 'react';

const BORDER = '#E4E4E7';

/** Flat sparkline for the current snapshot only — no historical series available. */
export default function IssueTrendArea({ value, color }: { value: number; color: string }) {
  const gradId = useId();
  const width = 300;
  const height = 72;
  const padX = 4;
  const padTop = 10;
  const padBottom = 14;
  const max = Math.max(value, 1);
  const y = padTop + (1 - value / max) * (height - padTop - padBottom);
  const x0 = padX;
  const x1 = width - padX;
  const linePath = `M ${x0.toFixed(1)} ${y.toFixed(1)} L ${x1.toFixed(1)} ${y.toFixed(1)}`;
  const areaPath = `${linePath} L ${x1.toFixed(1)} ${height - padBottom} L ${x0.toFixed(1)} ${height - padBottom} Z`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0.04} />
        </linearGradient>
      </defs>
      <line x1="0" y1={height - padBottom} x2={width} y2={height - padBottom} stroke={BORDER} strokeWidth="1" />
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x1} cy={y} r="4.5" fill={color} />
      <circle cx={x1} cy={y} r="2" fill="#FFFFFF" />
    </svg>
  );
}
