import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { TrafficAnalyticsSection } from '../../lib/seoOverview/types';
import { workspaceHref } from '../../lib/activeWorkspace';
import { card, compactNum, DeltaPct, FONT, formatDuration, ViewFullReport, WidgetHeader } from './widgetStyles';

const TrafficTrendChart = dynamic(() => import('./TrafficTrendChart'), { ssr: false });

type Props = {
  data: TrafficAnalyticsSection;
  slug: string;
  workspaceId: number | null;
  loading?: boolean;
};

const MetricCell = ({ label, value, delta }: { label: string; value: string; delta: { value: number | null; trend: 'up' | 'down' | 'same' } }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 12, color: '#9F9FA9', fontFamily: FONT, marginBottom: 4 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{value}</span>
      <DeltaPct value={delta.value} trend={delta.trend} />
    </div>
  </div>
);

const TrafficAnalyticsWidget = ({ data, slug, workspaceId, loading }: Props) => {
  const href = workspaceHref(workspaceId, `/sites/${slug}/performance`);

  return (
    <section style={card} aria-label="Traffic Analytics">
      <WidgetHeader
        title="Traffic Analytics"
        meta={(
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#9F9FA9', fontFamily: FONT }}>
            <span>{data.monthLabel}</span>
            <span>·</span>
            <span>Root Domain</span>
          </div>
        )}
      />
      <div style={{ padding: '16px 24px 24px' }}>
        {loading ? (
          <div style={{ height: 200, borderRadius: 8, background: '#E8E8ED' }} />
        ) : !data.connected ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: '#52525C', fontFamily: FONT }}>Connect Google Search Console for traffic data.</p>
            <Link href={href} style={{ fontSize: 13, fontWeight: 600, color: '#783AFB', textDecoration: 'none', fontFamily: FONT }}>Open Performance →</Link>
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 16,
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: '1px solid #F4F4F5',
            }}
            >
              <MetricCell label="Visits" value={compactNum(data.visits.value)} delta={data.visits} />
              <MetricCell label="Unique Visitors" value={compactNum(data.uniqueVisitors.value)} delta={data.uniqueVisitors} />
              <MetricCell label="Pages / Visit" value={data.pagesPerVisit.value.toFixed(2)} delta={data.pagesPerVisit} />
              <MetricCell label="Avg. Visit Duration" value={formatDuration(data.avgVisitDurationSec)} delta={{ value: null, trend: 'same' }} />
              <MetricCell label="Bounce Rate" value={`${data.bounceRate.value.toFixed(2)}%`} delta={data.bounceRate} />
            </div>
            <div style={{ fontSize: 12, color: '#9F9FA9', fontFamily: FONT, marginBottom: 8 }}>Last 6 months</div>
            <div style={{ height: 160, marginBottom: 16 }}>
              <TrafficTrendChart points={data.trend} />
            </div>
            <ViewFullReport href={href} />
          </>
        )}
      </div>
    </section>
  );
};

export default TrafficAnalyticsWidget;
