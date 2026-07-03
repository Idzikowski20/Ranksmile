import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, type ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export type SeriesLine = { label: string; data: Array<number | null>; color: string };

/** Small per-metric trend chart (Mention rate / Average position / Citations & Pages).
 *  Tooltip is index/intersect:false so it shows at any hover height. */
const MetricTrendChart = ({ labels, lines, yMin, yMax, reverse = false, percent = false, height = 200 }: {
   labels: string[]; lines: SeriesLine[]; yMin?: number; yMax?: number; reverse?: boolean; percent?: boolean; height?: number;
}) => {
   const options: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
         y: {
            min: yMin,
            max: yMax,
            reverse,
            ticks: { color: '#9F9FA9', callback: (value: string | number) => (percent ? `${value}%` : `${value}`) },
            grid: { color: '#F4F4F5' },
         },
         x: { ticks: { color: '#9F9FA9' }, grid: { display: false } },
      },
      plugins: {
         legend: { display: false },
         tooltip: {
            mode: 'index',
            intersect: false,
            usePointStyle: true,
            boxPadding: 4,
            backgroundColor: '#18181B',
            cornerRadius: 8,
            padding: 12,
            titleColor: '#fff',
            bodyColor: '#fff',
            titleFont: { weight: 'bold' },
         },
      },
      elements: { point: { radius: 3, hoverRadius: 5 } },
   };
   const data = {
      labels,
      datasets: lines.map((l) => ({ label: l.label, data: l.data, borderColor: l.color, backgroundColor: l.color, pointBackgroundColor: l.color, tension: 0.3, spanGaps: true })),
   };
   return <div style={{ height }}><Line data={data} options={options} /></div>;
};

export default MetricTrendChart;
