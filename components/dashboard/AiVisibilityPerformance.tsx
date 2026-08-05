import React, { useMemo } from 'react';
import Link from 'next/link';
import { ChartWidget } from '../koala/product';
import { TrendDeltaBadge } from '../koala/product/helpers/TrendDeltaBadge';
import type { ChartPreparedData } from '../koala/charts';

const font = 'var(--font-family-primary)';

interface Props {
  score: number;
  deltaPct: number;
  points: number[];
  startLabel: string;
  endLabel: string;
  href: string;
  loading: boolean;
}

/** AI Visibility trend — same ChartWidget chrome as Clicks (TrafficTrend). */
const AiVisibilityPerformance = ({
  score, deltaPct, points, startLabel, endLabel, href, loading,
}: Props) => {
  const up = deltaPct >= 0;
  const chartData: ChartPreparedData = useMemo(
    () => ({
      labels: points.map((_, i) => String(i)),
      points: points.map((value, i) => ({ label: String(i), value })),
    }),
    [points],
  );

  return (
    <ChartWidget
      title="AI Visibility"
      subtitle="Visibility score over scans"
      state={loading ? 'loading' : points.length ? 'success' : 'empty'}
      emptyDescription="No AI Visibility scans yet."
      actions={(
        <Link href={href} passHref>
          <a style={{ fontSize: 13, fontWeight: 600, color: 'var(--koala-brand)', textDecoration: 'none', fontFamily: font }}>
            View
          </a>
        </Link>
      )}
      footer={!loading && points.length ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', fontFamily: font, fontSize: 12, color: 'var(--koala-text-secondary)' }}>
          <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--koala-text-primary)' }}>{score}</span>
          <TrendDeltaBadge
            delta={`${up ? '+' : ''}${deltaPct}%`}
            positive={up}
            size="sm"
            variant="outline"
          />
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      ) : undefined}
      chart={loading || !points.length ? undefined : {
        preset: 'TrafficTrend',
        data: chartData,
        overrides: { height: 130, legend: false },
        'aria-label': 'AI Visibility score over scans',
      }}
    />
  );
};

export default AiVisibilityPerformance;
