import type { GoalPeriod } from '../../lib/performance/types';
import { compactNumber } from '../../lib/performance/formatters';

type GoalProjectionChartProps = {
  baseClicks: number;
  percentage: number;
  period: GoalPeriod;
};

export default function GoalProjectionChart({ baseClicks, percentage, period }: GoalProjectionChartProps) {
  const months = 12;
  const rate = period === 'MONTH' ? percentage / 100 : (percentage / 100) / 3;
  const data = Array.from({ length: months }, (_, i) => ({
    value: Math.round(baseClicks * (1 + rate) ** i),
    label: new Date(new Date().getFullYear(), new Date().getMonth() + i, 1).toLocaleDateString('en-US', { month: 'short' }),
  }));

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const chartWidth = 500;
  const chartHeight = 160;
  const barWidth = Math.floor(chartWidth / months) - 4;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={chartWidth + 40} height={chartHeight + 32} style={{ display: 'block' }}>
        <g transform="translate(30, 10)">
          {[0, 1, 2, 3].map((i) => {
            const y = chartHeight - (chartHeight / 3) * i;
            return (
              <g key={i}>
                <line x1={0} x2={chartWidth} y1={y} y2={y} stroke="#E4E4E7" strokeWidth={1} />
                <text x={-4} y={y} textAnchor="end" dominantBaseline="middle" fill="#52525C" fontSize={10} fontFamily="var(--font-family-primary)">
                  {compactNumber(Math.round((maxVal / 3) * i))}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const x = i * (chartWidth / months);
            const barH = maxVal > 0 ? (d.value / maxVal) * chartHeight : 0;
            const isFirst = i === 0;
            return (
              <g key={i}>
                <rect
                  x={x + 2}
                  y={chartHeight - barH}
                  width={barWidth}
                  height={barH}
                  fill={isFirst ? '#E4E4E7' : '#F29964'}
                  rx={3}
                />
                {i % 3 === 0 ? (
                  <text x={x + barWidth / 2 + 2} y={chartHeight + 14} textAnchor="middle" fill="#52525C" fontSize={10} fontFamily="var(--font-family-primary)">
                    {d.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
