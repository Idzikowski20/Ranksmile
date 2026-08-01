import React from 'react';
import type { RankAnalyticsSummary, RankSummaryChartPoint } from '../../lib/types/rankTracking';
import Chart from '../common/Chart';
import { DeltaDown, DeltaUp } from '../ranksmile/icons';

const FONT = 'var(--font-family-primary)';
const CARD: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #bebebe',
  borderRadius: 8,
  padding: 20,
};

function MovementCard({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: 'up' | 'down' | 'neutral';
}) {
  return (
    <div style={{ ...CARD, width: 115, height: 115, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#181225', fontFamily: FONT, lineHeight: 1 }}>{value}</div>
        {tone === 'up' && <span style={{ marginTop: 8, display: 'inline-flex' }}><DeltaUp /></span>}
        {tone === 'down' && <span style={{ marginTop: 8, display: 'inline-flex' }}><DeltaDown /></span>}
      </div>
      <div style={{ fontSize: 12, color: '#302E36', fontFamily: FONT }}>{label}</div>
    </div>
  );
}

export function TrackingMovementCards({ summary }: { summary: RankAnalyticsSummary | undefined }) {
  return (
    <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
      <MovementCard value={summary?.movedUp ?? 0} label="Keywords moved up" tone="up" />
      <MovementCard value={summary?.movedDown ?? 0} label="Keywords moved down" tone="down" />
      <MovementCard value={summary?.unchanged ?? 0} label="Keywords unchanged" tone="neutral" />
    </div>
  );
}

export function AveragePositionCard({
  summary,
  chart,
}: {
  summary: RankAnalyticsSummary | undefined;
  chart: RankSummaryChartPoint[];
}) {
  const prev = summary?.previousAveragePosition;
  const curr = summary?.averagePosition;
  const labels = chart.map((p) => {
    if (!p.finishedAt) return String(p.runId);
    const d = new Date(p.finishedAt);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const series = chart.map((p) => p.avgPosition ?? 0);

  return (
    <div style={{ ...CARD, flex: 1, minWidth: 280 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6A6772', letterSpacing: '0.06em', marginBottom: 12, fontFamily: FONT }}>
        AVERAGE POSITION
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12, fontFamily: FONT }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: '#A3B0B3' }}>{prev ?? '—'}</span>
        <span style={{ fontSize: 24, color: '#A3B0B3' }}>→</span>
        <span style={{ fontSize: 40, fontWeight: 600, color: '#181225' }}>{curr ?? '—'}</span>
      </div>
      <div style={{ height: 160, width: '100%' }}>
        {series.length > 0 ? (
          <Chart labels={labels} series={series} reverse />
        ) : (
          <div style={{ color: '#6A6772', fontSize: 13, fontFamily: FONT, paddingTop: 40, textAlign: 'center' }}>
            No completed runs yet
          </div>
        )}
      </div>
    </div>
  );
}

const BUCKET_COLORS = {
  top3: '#85ECC1',
  top10: '#F8BC54',
  top100: '#F3AF86',
  notRanking: '#F2A7A6',
} as const;

export function RankingBucketsCard({ summary }: { summary: RankAnalyticsSummary | undefined }) {
  const b = summary?.buckets ?? { top3: 0, top10: 0, top100: 0, notRanking: 0 };
  const p = summary?.previousBuckets ?? { top3: 0, top10: 0, top100: 0, notRanking: 0 };
  const total = Math.max(1, b.top3 + b.top10 + b.top100 + b.notRanking);
  const rows = [
    { key: 'top3' as const, label: 'Top 3' },
    { key: 'top10' as const, label: 'Top 10' },
    { key: 'top100' as const, label: 'Top 100' },
    { key: 'notRanking' as const, label: 'Not ranking' },
  ];

  // Simple CSS donut via conic-gradient
  const t3 = (b.top3 / total) * 100;
  const t10 = (b.top10 / total) * 100;
  const t100 = (b.top100 / total) * 100;
  const gradient = `conic-gradient(${BUCKET_COLORS.top3} 0 ${t3}%, ${BUCKET_COLORS.top10} ${t3}% ${t3 + t10}%, ${BUCKET_COLORS.top100} ${t3 + t10}% ${t3 + t10 + t100}%, ${BUCKET_COLORS.notRanking} ${t3 + t10 + t100}% 100%)`;

  return (
    <div style={{ ...CARD, flex: 1, minWidth: 280 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6A6772', letterSpacing: '0.06em', marginBottom: 12, fontFamily: FONT }}>
        CURRENT SEARCH RESULT RANKINGS
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 8 }}>
        <div
          style={{
            width: 130,
            height: 130,
            borderRadius: '50%',
            background: gradient,
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 28,
              borderRadius: '50%',
              background: '#fff',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {rows.map((r) => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT, fontSize: 13 }}>
              <span style={{ width: 12, height: 12, borderRadius: 2, background: BUCKET_COLORS[r.key], flexShrink: 0 }} />
              <span style={{ flex: 1, color: '#302E36' }}>{r.label}</span>
              <span style={{ color: '#D1D7D9' }}>{p[r.key]}</span>
              <span style={{ color: '#A3B0B3' }}>→</span>
              <span style={{ fontWeight: 700, color: '#181225', minWidth: 20 }}>{b[r.key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
