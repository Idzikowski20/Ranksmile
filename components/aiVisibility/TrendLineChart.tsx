import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, type ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type Point = { finishedAt: string | null; series: { you: { visibilityScore: number } | null; competitor?: { visibilityScore: number } | null } };

const OPTIONS: ChartOptions<'line'> = {
   responsive: true,
   maintainAspectRatio: false,
   // index + intersect:false → hovering anywhere at an x shows the tooltip, not only
   // when the cursor is exactly on a point.
   interaction: { mode: 'index', intersect: false },
   scales: {
      y: { min: 0, max: 100, ticks: { color: '#9F9FA9' }, grid: { color: '#F4F4F5' } },
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

const TrendLineChart = ({ scans, competitorDomain }: { scans: Point[]; competitorDomain: string | null }) => {
   const labels = scans.map((s) => (s.finishedAt ? new Date(s.finishedAt).toLocaleDateString() : ''));
   const datasets = [
      { label: 'You', data: scans.map((s) => s.series.you?.visibilityScore ?? 0), borderColor: '#783AFB', backgroundColor: '#783AFB', pointBackgroundColor: '#783AFB', tension: 0.3 },
   ];
   if (competitorDomain) datasets.push({ label: competitorDomain, data: scans.map((s) => s.series.competitor?.visibilityScore ?? 0), borderColor: '#9F9FA9', backgroundColor: '#9F9FA9', pointBackgroundColor: '#9F9FA9', tension: 0.3 });
   return (
      <div style={{ height: 300 }}>
         <Line data={{ labels, datasets }} options={OPTIONS} />
      </div>
   );
};

export default TrendLineChart;
