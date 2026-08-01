import React, { useEffect, useRef, useState } from 'react';
import type { ChartPoint } from '../../lib/performance/types';
import { buildChartTicks, compactNumber, formatPercent } from '../../lib/performance/formatters';

type PerformanceLineChartProps = {
  data: ChartPoint[];
  visibleMetrics: { clicks: boolean; impressions: boolean; ctr: boolean; position: boolean };
};

export default function PerformanceLineChart({ data, visibleMetrics }: PerformanceLineChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverState, setHoverState] = useState<{ index: number; lineX: number; cursorPx: number } | null>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (!data.length) {
    return (
      <div className="performance-line-chart--empty">
        No chart data for this filter.
      </div>
    );
  }

  const width = 1230;
  const height = 368;
  const leftPad = 45;
  const topPad = 10;
  const svgWidth = width + 90;
  const svgHeight = height + 64;
  const innerWidth = width;
  const innerHeight = height;

  const maxClicks = Math.max(...data.map((item) => item.clicks), 1);
  const maxImpressions = Math.max(...data.map((item) => item.impressions), 1);
  const maxCtr = Math.max(...data.map((item) => item.ctr), 0.0001);
  const maxPosition = Math.max(...data.map((item) => item.position), 1);
  const clickTicks = buildChartTicks(maxClicks);
  const impressionTicks = buildChartTicks(maxImpressions);

  const getX = (index: number) => (index / Math.max(data.length - 1, 1)) * innerWidth;
  const getClicksY = (value: number) => innerHeight - (value / clickTicks[3]) * innerHeight;
  const getImpressionsY = (value: number) => innerHeight - (value / impressionTicks[3]) * innerHeight;
  const getCtrY = (value: number) => innerHeight - (value / maxCtr) * innerHeight;
  const getPositionY = (value: number) => (value / maxPosition) * innerHeight;

  const buildLinePath = (getY: (item: ChartPoint) => number) =>
    data.map((item, index) => `${index === 0 ? 'M' : 'L'}${getX(index).toFixed(3)},${getY(item).toFixed(3)}`).join('');

  const clickPath = buildLinePath((item) => getClicksY(item.clicks));
  const impressionPath = buildLinePath((item) => getImpressionsY(item.impressions));
  const ctrPath = buildLinePath((item) => getCtrY(item.ctr));
  const positionPath = buildLinePath((item) => getPositionY(item.position));

  const clickArea = `${clickPath}L${getX(data.length - 1).toFixed(3)},${innerHeight}L0,${innerHeight}Z`;
  const impressionArea = `${impressionPath}L${getX(data.length - 1).toFixed(3)},${innerHeight}L0,${innerHeight}Z`;
  const ctrArea = `${ctrPath}L${getX(data.length - 1).toFixed(3)},${innerHeight}L0,${innerHeight}Z`;
  const positionArea = `${positionPath}L${getX(data.length - 1).toFixed(3)},${innerHeight}L0,${innerHeight}Z`;

  const labelStep = Math.max(1, Math.floor(data.length / (narrow ? 6 : 14)));
  const xLabels = data.filter((_, index) => index % labelStep === 0).slice(0, narrow ? 7 : 15);

  const formatAxisDate = (value: string) => {
    const date = new Date(value);
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
  };

  const formatTooltipDate = (value: string) => {
    const date = new Date(value);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const hoveredPoint = hoverState ? data[hoverState.index] : null;
  const hoveredPointX = hoverState ? getX(hoverState.index) : null;

  const handlePointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const plotLeftPx = (leftPad / svgWidth) * rect.width;
    const plotWidthPx = (innerWidth / svgWidth) * rect.width;
    const cursorPx = Math.max(plotLeftPx, Math.min(event.clientX - rect.left, plotLeftPx + plotWidthPx));
    const relativePlotPx = cursorPx - plotLeftPx;
    const lineX = (relativePlotPx / plotWidthPx) * innerWidth;
    const nextIndex = Math.round((lineX / innerWidth) * Math.max(data.length - 1, 1));
    setHoverState({ index: nextIndex, lineX, cursorPx });
  };

  let tooltipStyle: { left: number; top: number } | undefined;
  if (hoverState && hoveredPoint) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const plotTopPx = (topPad / svgHeight) * rect.height;
      const plotHeightPx = (innerHeight / svgHeight) * rect.height;
      const yValues = [
        visibleMetrics.clicks ? getClicksY(hoveredPoint.clicks) : null,
        visibleMetrics.impressions ? getImpressionsY(hoveredPoint.impressions) : null,
        visibleMetrics.ctr ? getCtrY(hoveredPoint.ctr) : null,
        visibleMetrics.position ? getPositionY(hoveredPoint.position) : null,
      ].filter((v): v is number => v !== null);
      const minY = yValues.length > 0 ? Math.min(...yValues) : 0;
      const anchorYPx = plotTopPx + (Math.min(minY, innerHeight) / innerHeight) * plotHeightPx;
      const tooltipWidth = 220;
      const tooltipHeight = 160;
      const left = Math.max(12, Math.min(rect.width - tooltipWidth - 12, hoverState.cursorPx + 10));
      const top = Math.max(16, Math.min(rect.height - tooltipHeight - 12, anchorYPx - tooltipHeight - 12));
      tooltipStyle = { left, top };
    }
  }

  return (
    <div
      ref={containerRef}
      className="performance-line-chart"
      onMouseMove={handlePointerMove}
      onMouseLeave={() => setHoverState(null)}
    >
        <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet">
          <g transform={`translate(${leftPad},${topPad})`}>
            {[0, 1, 2, 3].map((index) => {
              const y = innerHeight - (innerHeight / 3) * index;
              return <line key={index} x1="0" x2={innerWidth} y1={y} y2={y} stroke="#F4F4F5" strokeWidth="1" />;
            })}

            {[0, 1, 2, 3].map((index) => {
              const y = innerHeight - (innerHeight / 3) * index;
              return (
                <text key={`left-${index}`} x="-10" y={y} textAnchor="end" dominantBaseline="middle" fill={visibleMetrics.clicks ? '#52525C' : '#C4C4C4'} fontSize="12" fontFamily="var(--font-family-primary)">
                  {compactNumber(clickTicks[index])}
                </text>
              );
            })}

            {[0, 1, 2, 3].map((index) => {
              const y = innerHeight - (innerHeight / 3) * index;
              return (
                <text key={`right-${index}`} x={innerWidth + 10} y={y} textAnchor="start" dominantBaseline="middle" fill={visibleMetrics.impressions ? '#52525C' : '#C4C4C4'} fontSize="12" fontFamily="var(--font-family-primary)">
                  {compactNumber(impressionTicks[index])}
                </text>
              );
            })}

            <defs>
              <linearGradient id="perf-clicks-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#BEDBFF" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#BEDBFF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="perf-impressions-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C5B8FE" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#C5B8FE" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="perf-ctr-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#86EFAC" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#86EFAC" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="perf-position-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FDBA74" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#FDBA74" stopOpacity="0" />
              </linearGradient>
            </defs>

            {visibleMetrics.clicks ? (
              <>
                <path d={clickArea} fill="url(#perf-clicks-gradient)" opacity="0.9" />
                <path d={clickPath} fill="none" stroke="#74A9FF" strokeWidth="2.2" />
              </>
            ) : null}
            {visibleMetrics.impressions ? (
              <>
                <path d={impressionArea} fill="url(#perf-impressions-gradient)" opacity="0.9" />
                <path d={impressionPath} fill="none" stroke="#F29964" strokeWidth="2.2" />
              </>
            ) : null}
            {visibleMetrics.ctr ? (
              <>
                <path d={ctrArea} fill="url(#perf-ctr-gradient)" opacity="0.9" />
                <path d={ctrPath} fill="none" stroke="#22C55E" strokeWidth="2.2" />
              </>
            ) : null}
            {visibleMetrics.position ? (
              <>
                <path d={positionArea} fill="url(#perf-position-gradient)" opacity="0.9" />
                <path d={positionPath} fill="none" stroke="#F97316" strokeWidth="2.2" />
              </>
            ) : null}

            {hoverState && hoveredPointX !== null && hoveredPoint ? (
              <>
                <line x1={hoverState.lineX} x2={hoverState.lineX} y1={0} y2={innerHeight} stroke="#D4D4D8" strokeWidth="1" strokeDasharray="6 6" />
                {visibleMetrics.clicks ? <circle cx={hoveredPointX} cy={getClicksY(hoveredPoint.clicks)} r="5.5" fill="#74A9FF" style={{ transition: 'cx 90ms linear, cy 90ms linear' }} /> : null}
                {visibleMetrics.impressions ? <circle cx={hoveredPointX} cy={getImpressionsY(hoveredPoint.impressions)} r="5.5" fill="#F29964" style={{ transition: 'cx 90ms linear, cy 90ms linear' }} /> : null}
                {visibleMetrics.ctr ? <circle cx={hoveredPointX} cy={getCtrY(hoveredPoint.ctr)} r="5.5" fill="#22C55E" style={{ transition: 'cx 90ms linear, cy 90ms linear' }} /> : null}
                {visibleMetrics.position ? <circle cx={hoveredPointX} cy={getPositionY(hoveredPoint.position)} r="5.5" fill="#F97316" style={{ transition: 'cx 90ms linear, cy 90ms linear' }} /> : null}
              </>
            ) : null}

            {xLabels.map((item) => {
              const index = data.indexOf(item);
              const x = getX(index);
              return (
                <g key={`${item.date}-${index}`} transform={`translate(${x},${innerHeight})`}>
                  <line x1="0" x2="0" y1="0" y2="14" stroke="#E4E4E7" strokeWidth="1" />
                  <text x="4" y="16" textAnchor="start" dominantBaseline="hanging" fill="#52525C" fontSize="11" fontFamily="var(--font-family-primary)">
                    {formatAxisDate(item.date)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {hoveredPoint && tooltipStyle ? (
          <div
            style={{
              position: 'absolute',
              zIndex: 150,
              display: 'inline-flex',
              maxWidth: '14rem',
              flexDirection: 'column',
              borderRadius: 4,
              background: '#18181B',
              color: '#FFFFFF',
              padding: '4px 8px',
              textAlign: 'left',
              fontSize: '0.8125rem',
              lineHeight: '1rem',
              fontWeight: 400,
              boxShadow: '0px 8px 16px 0px #181a220a, 0px 2px 8px 0px #181a2205, 0px 1px 2px 0px #181a220f',
              pointerEvents: 'none',
              left: tooltipStyle.left,
              top: tooltipStyle.top,
              transition: 'left 90ms linear, top 90ms linear',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px', fontSize: '0.8125rem', lineHeight: '1rem' }}>
              <span style={{ marginBottom: 2 }}>{formatTooltipDate(hoveredPoint.date)}</span>
              {visibleMetrics.clicks ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#74A9FF', flexShrink: 0 }} />
                    <span>Clicks</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{hoveredPoint.clicks}</span>
                </div>
              ) : null}
              {visibleMetrics.impressions ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#F29964', flexShrink: 0 }} />
                    <span>Impressions</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{hoveredPoint.impressions}</span>
                </div>
              ) : null}
              {visibleMetrics.ctr ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#22C55E', flexShrink: 0 }} />
                    <span>Avg. CTR</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{formatPercent(hoveredPoint.ctr)}</span>
                </div>
              ) : null}
              {visibleMetrics.position ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#F97316', flexShrink: 0 }} />
                    <span>Avg. Position</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{hoveredPoint.position.toFixed(1)}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
    </div>
  );
}
