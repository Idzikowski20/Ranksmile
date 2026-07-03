import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type Point = { finishedAt: string | null; series: { you: { visibilityScore: number } | null; competitor?: { visibilityScore: number } | null } };

const TrendLineChart = ({ scans, competitorDomain }: { scans: Point[]; competitorDomain: string | null }) => {
   const labels = scans.map((s) => (s.finishedAt ? new Date(s.finishedAt).toLocaleDateString() : ''));
   const datasets: Array<{ label: string; data: number[]; borderColor: string; backgroundColor: string; tension: number }> = [
      { label: 'You', data: scans.map((s) => s.series.you?.visibilityScore ?? 0), borderColor: '#783AFB', backgroundColor: '#783AFB', tension: 0.3 },
   ];
   if (competitorDomain) datasets.push({ label: competitorDomain, data: scans.map((s) => s.series.competitor?.visibilityScore ?? 0), borderColor: '#9F9FA9', backgroundColor: '#9F9FA9', tension: 0.3 });
   return (
      <div style={{ height: 300 }}>
         <Line
            data={{ labels, datasets }}
            options={{ responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } }, plugins: { legend: { position: 'bottom' } } }}
         />
      </div>
   );
};

export default TrendLineChart;
