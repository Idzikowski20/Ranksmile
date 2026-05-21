import React, { useMemo, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

type InsightStatsProps = {
   stats: SearchAnalyticsStat[],
   totalKeywords: number,
   totalCountries: number,
   totalPages: number,
   dateRange?: number,
}

type MetricKey = 'clicks' | 'impressions' | 'ctr' | 'position';

const METRIC_COLORS: Record<MetricKey, string> = {
   clicks: '#4285F4',
   impressions: '#5E35B1',
   ctr: '#E37400',
   position: '#0F9D58',
};

const InsightStats = ({ stats = [], totalKeywords = 0, totalPages = 0, dateRange = 90 }: InsightStatsProps) => {
   const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(['clicks', 'impressions']);

   const filteredStats = useMemo(() => stats.slice(-dateRange), [stats, dateRange]);

   const totals = useMemo(() => filteredStats.reduce((acc, item) => ({
      clicks: acc.clicks + item.clicks,
      impressions: acc.impressions + item.impressions,
      position: acc.position + item.position,
      ctr: acc.ctr + item.ctr,
   }), { clicks: 0, impressions: 0, position: 0, ctr: 0 }), [filteredStats]);

   const avgPosition = filteredStats.length > 0 ? (totals.position / filteredStats.length).toFixed(1) : '0';
   const avgCTR = filteredStats.length > 0 ? (totals.ctr / filteredStats.length).toFixed(2) : '0.00';

   const fmt = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(n);

   const scorecards: { key: MetricKey; label: string; value: string }[] = [
      { key: 'clicks', label: 'Total Clicks', value: fmt(totals.clicks) },
      { key: 'impressions', label: 'Total Impressions', value: fmt(totals.impressions) },
      { key: 'ctr', label: 'Avg CTR', value: `${avgCTR}%` },
      { key: 'position', label: 'Avg Position', value: avgPosition },
   ];

   const toggleMetric = (key: MetricKey) => {
      setActiveMetrics(prev =>
         prev.includes(key) ? (prev.length > 1 ? prev.filter(m => m !== key) : prev) : [...prev, key],
      );
   };

   const chartLabels = filteredStats.map(item => {
      const d = new Date(item.date);
      return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
   });

   const datasets: any[] = [];
   if (activeMetrics.includes('clicks')) {
      datasets.push({
         label: 'Clicks',
         data: filteredStats.map(s => s.clicks),
         borderColor: '#4285F4',
         backgroundColor: 'transparent',
         yAxisID: 'yLeft',
         tension: 0.2,
         borderWidth: 2,
         pointRadius: 0,
         pointHoverRadius: 4,
         pointHoverBackgroundColor: '#4285F4',
      });
   }
   if (activeMetrics.includes('impressions')) {
      datasets.push({
         label: 'Impressions',
         data: filteredStats.map(s => s.impressions),
         borderColor: '#5E35B1',
         backgroundColor: 'transparent',
         yAxisID: 'yRight',
         tension: 0.2,
         borderWidth: 2,
         pointRadius: 0,
         pointHoverRadius: 4,
         pointHoverBackgroundColor: '#5E35B1',
      });
   }
   if (activeMetrics.includes('ctr')) {
      datasets.push({
         label: 'CTR (%)',
         data: filteredStats.map(s => s.ctr),
         borderColor: '#E37400',
         backgroundColor: 'transparent',
         yAxisID: 'yLeft',
         tension: 0.2,
         borderWidth: 2,
         pointRadius: 0,
         pointHoverRadius: 4,
         pointHoverBackgroundColor: '#E37400',
      });
   }
   if (activeMetrics.includes('position')) {
      datasets.push({
         label: 'Avg Position',
         data: filteredStats.map(s => s.position),
         borderColor: '#0F9D58',
         backgroundColor: 'transparent',
         yAxisID: 'yRight',
         tension: 0.2,
         borderWidth: 2,
         pointRadius: 0,
         pointHoverRadius: 4,
         pointHoverBackgroundColor: '#0F9D58',
      });
   }

   const showLeft = activeMetrics.includes('clicks') || activeMetrics.includes('ctr');
   const showRight = activeMetrics.includes('impressions') || activeMetrics.includes('position');

   const chartOptions: any = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
         x: {
            grid: { color: '#eeeeee', drawBorder: false },
            ticks: { color: '#757575', font: { size: 11 }, maxTicksLimit: 10 },
         },
         yLeft: {
            display: showLeft,
            position: 'left',
            grid: { color: '#eeeeee', drawBorder: false },
            ticks: { color: '#757575', font: { size: 11 } },
         },
         yRight: {
            display: showRight,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#757575', font: { size: 11 } },
         },
      },
      plugins: {
         legend: { display: false },
         tooltip: {
            backgroundColor: 'white',
            borderColor: '#e0e0e0',
            borderWidth: 1,
            titleColor: '#333',
            bodyColor: '#555',
            padding: 10,
            callbacks: {
               label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y}`,
            },
         },
      },
   };


   return (
      <div className="border-t border-gray-100">
         {/* GSC-style scorecards */}
         <div className="flex overflow-x-auto" style={{ minHeight: 100 }}>
            {scorecards.map((card, idx) => {
               const isActive = activeMetrics.includes(card.key);
               const color = METRIC_COLORS[card.key];
               return (
                  <button
                     key={card.key}
                     onClick={() => toggleMetric(card.key)}
                     className="flex-1 text-left transition-colors select-none focus:outline-none"
                     style={{
                        minWidth: 150,
                        backgroundColor: isActive ? color : 'white',
                        color: isActive ? 'white' : 'rgba(0,0,0,0.54)',
                        borderRight: idx < scorecards.length - 1 ? '1px solid rgba(0,0,0,0.08)' : 'none',
                     }}
                  >
                     <div className="px-6 py-5">
                        <div
                           className="text-xs mb-2 font-normal"
                           style={{ color: isActive ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.54)', fontSize: 13 }}
                        >
                           {card.label}
                        </div>
                        <div className="font-normal" style={{ fontSize: 28, lineHeight: 1.2, color: isActive ? 'white' : 'rgba(0,0,0,0.87)' }}>
                           {card.value}
                        </div>
                     </div>
                  </button>
               );
            })}
         </div>

         {/* Chart */}
         <div className="px-6 pt-4 pb-6">
            <div className="flex items-center justify-end mb-3">
               <div className="flex items-center gap-4 text-xs text-gray-500">
                  {activeMetrics.includes('clicks') && (
                     <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: '#4285F4' }}></span>
                        Clicks
                     </span>
                  )}
                  {activeMetrics.includes('impressions') && (
                     <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: '#5E35B1' }}></span>
                        Impressions
                     </span>
                  )}
                  {activeMetrics.includes('ctr') && (
                     <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: '#E37400' }}></span>
                        CTR
                     </span>
                  )}
                  {activeMetrics.includes('position') && (
                     <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: '#0F9D58' }}></span>
                        Position
                     </span>
                  )}
               </div>
            </div>
            <div className="h-64">
               {filteredStats.length > 0
                  ? <Line options={chartOptions} data={{ labels: chartLabels, datasets }} />
                  : <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
               }
            </div>
         </div>
      </div>
   );
};

export default InsightStats;
