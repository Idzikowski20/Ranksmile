import React from 'react';
import dynamic from 'next/dynamic';
import type { OrganicRankingsSection } from '../../lib/seoOverview/types';
import { workspaceHref } from '../../lib/activeWorkspace';
import { cardFlex, CountryPill, FONT, ViewFullReport, WidgetHeader } from './widgetStyles';

const OrganicTrafficChart = dynamic(() => import('./OrganicTrafficChart'), { ssr: false });
const KeywordChangesChart = dynamic(() => import('./KeywordChangesChart'), { ssr: false });

type Props = {
  data: OrganicRankingsSection;
  slug: string;
  workspaceId: number | null;
  loading?: boolean;
};

const OrganicRankingsWidget = ({ data, slug, workspaceId, loading }: Props) => {
  const href = workspaceHref(workspaceId, `/sites/${slug}/rank-tracking`);

  return (
    <section style={cardFlex} aria-label="Organic Rankings">
      <WidgetHeader
        title="Organic Rankings"
        action={<CountryPill label="United States" flag="🇺🇸" />}
        meta={(
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#9F9FA9', fontFamily: FONT }}>
            <span>Root Domain</span>
            <span>·</span>
            <span>Desktop</span>
            <span>·</span>
            <span>Last month</span>
          </div>
        )}
      />
      <div style={{ padding: '12px 24px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ height: 220, borderRadius: 8, background: '#E8E8ED' }} />
        ) : !data.connected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: FONT }}>Connect GSC to see organic rankings.</p>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT, marginBottom: 8 }}>Organic Traffic</div>
            <div style={{ height: 100, marginBottom: 16 }}>
              <OrganicTrafficChart points={data.trafficTrend} />
            </div>
            <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT, marginBottom: 8 }}>Keywords Position Changes</div>
            <div style={{ height: 80, marginBottom: 12 }}>
              <KeywordChangesChart points={data.changesByDay} />
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, fontFamily: FONT, marginBottom: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#52525C' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1AB25E' }} />
                Improved ({data.improved})
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#52525C' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
                Declined ({data.declined})
              </span>
            </div>
            <ViewFullReport href={href} />
          </>
        )}
      </div>
    </section>
  );
};

export default OrganicRankingsWidget;
