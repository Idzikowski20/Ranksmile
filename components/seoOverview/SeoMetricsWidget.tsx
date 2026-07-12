import React from 'react';
import Link from 'next/link';
import type { SeoMetricsSection } from '../../lib/seoOverview/types';
import { workspaceHref } from '../../lib/activeWorkspace';
import MiniSparkline from './MiniSparkline';
import {
  cardFlex, cardTitle, compactNum, CountryPill, FONT, MetricDelta, WidgetCtaStyle, WidgetSkeletonBar,
} from './widgetStyles';

type Props = {
  data: SeoMetricsSection;
  slug: string;
  workspaceId: number | null;
  loading?: boolean;
};

const SeoMetricsWidget = ({ data, slug, workspaceId, loading }: Props) => {
  const perfHref = workspaceHref(workspaceId, `/sites/${slug}/performance`);
  const asOf = data.asOfDate
    ? new Date(data.asOfDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <section style={cardFlex} aria-label="SEO">
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <h2 style={cardTitle}>SEO</h2>
          <CountryPill />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#9F9FA9', fontFamily: FONT, marginBottom: 4 }}>
          <span>Root Domain</span>
          <span>·</span>
          <span>Desktop</span>
          {asOf && (
            <>
              <span>·</span>
              <span>{asOf}</span>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 24px 24px', flex: 1 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <WidgetSkeletonBar key={i} />
            ))}
          </div>
        ) : !data.connected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 180, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: FONT }}>Connect Google Search Console to see organic metrics.</p>
            <Link href={perfHref} style={WidgetCtaStyle}>
              Open Performance
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
              padding: '14px 0', borderBottom: '1px solid #F4F4F5',
            }}
            >
              <div>
                <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT, marginBottom: 4 }}>Organic Traffic</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 22, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>
                    {compactNum(data.organicTraffic.value)}
                  </span>
                  <MetricDelta m={data.organicTraffic} />
                </div>
              </div>
              <MiniSparkline points={data.trafficSparkline} color="#74A9FF" filled />
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
              padding: '14px 0', borderBottom: '1px solid #F4F4F5',
            }}
            >
              <div>
                <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT, marginBottom: 4 }}>Organic Keywords</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 22, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>
                    {compactNum(data.organicKeywords.value)}
                  </span>
                  <MetricDelta m={data.organicKeywords} />
                </div>
              </div>
              <MiniSparkline points={data.keywordsSparkline} color="#8B73F6" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 14 }}>
              <div>
                <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT, marginBottom: 4 }}>Paid Keywords</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{data.paidKeywords}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT, marginBottom: 4 }}>Paid Traffic</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{data.paidTraffic}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default SeoMetricsWidget;
