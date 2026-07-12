import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React from 'react';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import AiSearchWidget from '../../../components/seoOverview/AiSearchWidget';
import SeoMetricsWidget from '../../../components/seoOverview/SeoMetricsWidget';
import PositionTrackingWidget from '../../../components/seoOverview/PositionTrackingWidget';
import SiteAuditWidget from '../../../components/seoOverview/SiteAuditWidget';
import SetupWidgetsGrid from '../../../components/seoOverview/SetupWidgetsGrid';
import TrafficAnalyticsWidget from '../../../components/seoOverview/TrafficAnalyticsWidget';
import OrganicRankingsWidget from '../../../components/seoOverview/OrganicRankingsWidget';
import BacklinksWidget from '../../../components/seoOverview/BacklinksWidget';
import ConnectGoogleBanner from '../../../components/seoOverview/ConnectGoogleBanner';
import { deriveActiveId } from '../../../lib/activeWorkspace';
import { useSeoOverview } from '../../../services/seoOverview';
import { useFetchDomains } from '../../../services/domains';
import { slugToDomain } from '../../../utils/slugToDomain';

const FONT = 'var(--font-family-primary)';

const ExternalLinkIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5z" clipRule="evenodd" />
    <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.31v2.439a.75.75 0 0 0 1.5 0v-4a.75.75 0 0 0-.75-.75h-4a.75.75 0 0 0 0 1.5h2.37l-9.193 8.496a.75.75 0 0 0-.053 1.06" clipRule="evenodd" />
  </svg>
);

const SeoOverviewPage: NextPage = () => {
  const router = useRouter();
  const { domain: slug } = router.query as { domain: string };
  const domain = slug ? slugToDomain(slug) : '';
  const workspaceId = deriveActiveId(router);
  const { data: domainsData } = useFetchDomains(router, true);
  const domains = domainsData?.domains || [];
  const overviewQ = useSeoOverview(slug);
  const data = overviewQ.data;

  const heading = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONT }}>
      SEO Dashboard:
      {' '}
      <span style={{ color: '#18181B' }}>{domain}</span>
      <a
        href={`https://${domain}`}
        target="_blank"
        rel="noreferrer noopener"
        style={{ display: 'inline-flex', color: '#9F9FA9', transition: 'color 150ms ease' }}
        aria-label={`Open ${domain} in new tab`}
      >
        <ExternalLinkIcon />
      </a>
    </span>
  );

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head><title>{`SEO Overview — ${domain} — SerpBear`}</title></Head>
      <DomainSubLayout
        domain={domain}
        slug={slug || ''}
        section="SEO"
        heading={heading}
        contentMaxWidth="100%"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
            alignItems: 'stretch',
          }}
          >
            <AiSearchWidget
              data={data?.aiSearch ?? { pending: true, visibility: 0, mentions: 0, citedPages: 0, models: [], finishedAt: null, usingFallbackScan: false }}
              slug={slug || ''}
              workspaceId={workspaceId}
              loading={overviewQ.isLoading}
            />
            <SeoMetricsWidget
              data={data?.seo ?? {
                connected: false,
                organicTraffic: { value: 0, previous: null, deltaPct: null, trend: 'same' },
                organicKeywords: { value: 0, previous: null, deltaPct: null, trend: 'same' },
                paidKeywords: 0,
                paidTraffic: 0,
                referringDomains: null,
                backlinks: null,
                trafficSparkline: [],
                keywordsSparkline: [],
                asOfDate: null,
              }}
              slug={slug || ''}
              workspaceId={workspaceId}
              loading={overviewQ.isLoading}
            />
          </div>

          <PositionTrackingWidget
            data={data?.positionTracking ?? {
              configured: false,
              visibility: { value: 0, previous: null, deltaPct: null, trend: 'same' },
              visibilityTrend: [],
              buckets: [],
              topKeywords: [],
              locationLabel: 'Poland (Google)',
              dateRangeLabel: '',
            }}
            slug={slug || ''}
            workspaceId={workspaceId}
            loading={overviewQ.isLoading}
          />

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
            gap: 20,
            alignItems: 'stretch',
          }}
          >
            <SiteAuditWidget
              data={data?.siteAudit ?? {
                configured: false, health: null, errors: 0, warnings: 0, crawledPages: 0,
                distribution: { healthy: 0, broken: 0, haveIssues: 0, redirects: 0 }, updatedAt: null,
              }}
              slug={slug || ''}
              workspaceId={workspaceId}
              loading={overviewQ.isLoading}
            />
            <SetupWidgetsGrid slug={slug || ''} workspaceId={workspaceId} />
          </div>

          <TrafficAnalyticsWidget
            data={data?.trafficAnalytics ?? {
              connected: false,
              monthLabel: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
              visits: { value: 0, previous: null, deltaPct: null, trend: 'same' },
              uniqueVisitors: { value: 0, previous: null, deltaPct: null, trend: 'same' },
              pagesPerVisit: { value: 0, previous: null, deltaPct: null, trend: 'same' },
              avgVisitDurationSec: null,
              bounceRate: { value: 0, previous: null, deltaPct: null, trend: 'same' },
              trend: [],
            }}
            slug={slug || ''}
            workspaceId={workspaceId}
            loading={overviewQ.isLoading}
          />

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
            alignItems: 'stretch',
          }}
          >
            <OrganicRankingsWidget
              data={data?.organicRankings ?? {
                connected: false, trafficTrend: [], improved: 0, declined: 0, changesByDay: [],
              }}
              slug={slug || ''}
              workspaceId={workspaceId}
              loading={overviewQ.isLoading}
            />
            <BacklinksWidget
              data={data?.backlinks ?? { available: false, referringDomains: null, trend: [], authorityBuckets: [] }}
              loading={overviewQ.isLoading}
            />
          </div>

          {!data?.gscConnected && !overviewQ.isLoading && <ConnectGoogleBanner />}
        </div>
      </DomainSubLayout>
    </AppShell>
  );
};

export default SeoOverviewPage;
