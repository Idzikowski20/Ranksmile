import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { PositionTrackingSection } from '../../lib/seoOverview/types';
import { workspaceHref } from '../../lib/activeWorkspace';
import MiniSparkline from './MiniSparkline';
import { card, cardTitle, FONT, WidgetCtaStyle, WidgetSkeletonBar } from './widgetStyles';

const VisibilityTrendChart = dynamic(() => import('./VisibilityTrendChart'), { ssr: false });

type Props = {
  data: PositionTrackingSection;
  slug: string;
  workspaceId: number | null;
  loading?: boolean;
};

const PositionTrackingWidget = ({ data, slug, workspaceId, loading }: Props) => {
  const rankHref = workspaceHref(workspaceId, `/sites/${slug}/rank-tracking`);
  const up = data.visibility.trend === 'up';
  const delta = data.visibility.deltaPct;

  return (
    <section style={card} aria-label="Position Tracking">
      <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={cardTitle}>Position Tracking</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#9F9FA9', fontFamily: FONT }}>
          <span>{data.locationLabel}</span>
          {data.dateRangeLabel && (
            <>
              <span>·</span>
              <span>{data.dateRangeLabel}</span>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {loading ? (
          <WidgetSkeletonBar height={280} />
        ) : !data.configured ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 200, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: FONT }}>Add keywords to start tracking positions.</p>
            <Link href={rankHref} style={WidgetCtaStyle}>
              Set up Rank Tracking
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 24 }}>
            <div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT, marginBottom: 4 }}>Visibility</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 28, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>
                    {data.visibility.value.toFixed(2)}%
                  </span>
                  {delta != null && data.visibility.trend !== 'same' && (
                    <span style={{ fontSize: 14, fontWeight: 600, color: up ? '#1AB25E' : '#FF6F77', fontFamily: FONT }}>
                      {up ? '↑' : '↓'}{Math.abs(delta).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
              <div style={{ height: 200 }}>
                <VisibilityTrendChart points={data.visibilityTrend} />
              </div>
            </div>

            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
                {data.buckets.map((b) => (
                  <div key={b.label} style={{ padding: 12, borderRadius: 8, border: '1px solid #F4F4F5', background: '#FAFAFA' }}>
                    <div style={{ fontSize: 12, color: '#9F9FA9', fontFamily: FONT, marginBottom: 4 }}>{b.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 20, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{b.count}</span>
                      <MiniSparkline points={b.sparkline} color="#74A9FF" height={24} />
                    </div>
                    <div style={{ fontSize: 11, color: '#9F9FA9', fontFamily: FONT, marginTop: 6 }}>
                      <span style={{ color: '#1AB25E' }}>{b.newCount} new</span>
                      {' · '}
                      <span style={{ color: '#FF6F77' }}>{b.lostCount} lost</span>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: '#9F9FA9', fontFamily: FONT,
                  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8,
                }}
                >
                  Top Keywords
                </div>
                <div style={{ border: '1px solid #F4F4F5', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 56px 72px', gap: 8, padding: '8px 12px',
                    background: '#FAFAFA', fontSize: 11, fontWeight: 600, color: '#9F9FA9', fontFamily: FONT,
                    textTransform: 'uppercase',
                  }}
                  >
                    <span>Keyword</span>
                    <span style={{ textAlign: 'right' }}>Pos.</span>
                    <span style={{ textAlign: 'right' }}>Visibility</span>
                  </div>
                  {data.topKeywords.map((kw) => (
                    <div
                      key={kw.keyword}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 56px 72px', gap: 8, padding: '10px 12px',
                        borderTop: '1px solid #F4F4F5', fontSize: 13, fontFamily: FONT,
                      }}
                    >
                      <span style={{ color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={kw.keyword}>
                        {kw.keyword}
                      </span>
                      <span style={{ textAlign: 'right', color: '#3F3F47', fontWeight: 600 }}>{kw.position}</span>
                      <span style={{ textAlign: 'right', color: '#52525C' }}>{kw.visibilityPct.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {data.configured && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F4F4F5' }}>
            <Link href={rankHref} style={{
              fontSize: 13, fontWeight: 600, color: '#783AFB', textDecoration: 'none', fontFamily: FONT,
            }}
            >
              View full report →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default PositionTrackingWidget;
