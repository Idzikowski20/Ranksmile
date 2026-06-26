import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { CSSTransition } from 'react-transition-group';
import { useQuery, useQueryClient } from 'react-query';
import DashboardLayout from '../../components/common/DashboardLayout';
import { useFetchDomains } from '../../services/domains';
import Settings from '../../components/settings/Settings';
import AddDomain from '../../components/domains/AddDomain';
import DashboardGreeting from '../../components/dashboard/DashboardGreeting';
import GetStartedCard from '../../components/dashboard/GetStartedCard';
import BrandPerformance from '../../components/dashboard/BrandPerformance';
import RecommendationsSection, { RecommendationItem } from '../../components/dashboard/RecommendationsSection';
import RecentlyEdited, { RecentlyEditedItem } from '../../components/dashboard/RecentlyEdited';
import LearnSection from '../../components/dashboard/LearnSection';
import SetupPipeline from '../../components/dashboard/SetupPipeline';
import { useSetupStatus, useRunSetup } from '../../services/domainPipeline';

const formatShortDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const DashboardPage: NextPage = () => {
  const { data: domainsData } = useFetchDomains({} as any);
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);

  const { data: sitesData, isLoading: sitesLoading } = useQuery('dashboardSites', async () => {
    const res = await fetch('/api/sites');
    if (!res.ok) return { domainStats: {} };
    return res.json();
  }, { retry: false });

  const { data: articlesData, isLoading: articlesLoading } = useQuery('dashboardArticles', async () => {
    const res = await fetch('/api/articles');
    if (!res.ok) return { articles: [] };
    return res.json();
  });

  // ── Clicks: aggregate GSC daily clicks across all domains ──
  const clickSeries = useMemo(() => {
    const stats = sitesData?.domainStats || {};
    const byDate = new Map<string, number>();
    Object.values(stats).forEach((s: unknown) => {
      type StatEntry = { chart?: Array<{ date: string; clicks?: number }> };
      ((s as StatEntry)?.chart || []).forEach((p) => {
        byDate.set(p.date, (byDate.get(p.date) || 0) + (p.clicks || 0));
      });
    });
    return [...byDate.keys()].sort().map((date) => ({ date, clicks: byDate.get(date) || 0 }));
  }, [sitesData]);

  const points = clickSeries.map((p) => p.clicks);
  const clicksTotal = points.reduce((a, b) => a + b, 0);
  const half = Math.floor(clickSeries.length / 2);
  const prevSum = points.slice(0, half).reduce((a, b) => a + b, 0);
  const currSum = points.slice(half).reduce((a, b) => a + b, 0);
  const deltaPct = prevSum > 0 ? Math.round(((currSum - prevSum) / prevSum) * 100) : (currSum > 0 ? 100 : 0);
  const hasData = clickSeries.length > 0;

  const domains: DomainType[] = domainsData?.domains || [];
  const primaryDomain = domains[0];
  const activeDomainSlug: string | null = primaryDomain?.slug ?? null;
  const clicksHref = primaryDomain ? `/sites/${primaryDomain.slug}` : '/sites';
  const recommendationsHref = primaryDomain ? `/sites/${primaryDomain.slug}/recommendations` : '/sites';

  // Domain-level recommendations produced by the setup pipeline (the scan output).
  const { data: domainRecsData } = useQuery(
    ['domainRecs', activeDomainSlug],
    async () => {
      const res = await fetch(`/api/domains/${activeDomainSlug}/recommendations`);
      if (!res.ok) return { recommendations: [] };
      return res.json();
    },
    { enabled: !!activeDomainSlug, retry: false },
  );

  // ── Pipeline polling ──
  const { data: setup } = useSetupStatus(activeDomainSlug);
  const runSetup = useRunSetup();

  // Fallback kick: if no job exists yet for this domain, trigger one — but ONCE per
  // domain. The ref latch + isLoading guard stop a refetch (window focus, the done
  // invalidation, an enqueue race) from re-reading 'none' and spamming run-setup.
  const kickedRef = useRef<string | null>(null);
  useEffect(() => {
    if (setup && setup.status === 'none' && activeDomainSlug
        && kickedRef.current !== activeDomainSlug && !runSetup.isLoading) {
      kickedRef.current = activeDomainSlug;
      runSetup.mutate(activeDomainSlug);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.status, activeDomainSlug]);

  // On transition to done, refresh the dashboard data queries
  useEffect(() => {
    if (setup?.status === 'done') {
      queryClient.invalidateQueries('dashboardArticles');
      queryClient.invalidateQueries('dashboardSites');
      queryClient.invalidateQueries(['domainRecs', activeDomainSlug]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.status]);

  const pipelineActive = setup && (setup.status === 'queued' || setup.status === 'running' || setup.status === 'failed');

  // ── Recommendations: the domain pipeline's scan output (pages requiring optimization).
  //    Falls back to analyzed articles with a content score when the scan produced none. ──
  const recommendations: RecommendationItem[] = useMemo(() => {
    type DomainRec = { id: number; title: string; priority: string | null };
    const domainRecs: DomainRec[] = domainRecsData?.recommendations ?? [];
    if (domainRecs.length > 0) {
      return domainRecs.map((r) => ({ id: r.id, title: r.title, priority: r.priority || 'low', href: recommendationsHref }));
    }
    type ArticleRow = { id: number; title: string; content_score: number; source: string };
    const arts: ArticleRow[] = (articlesData?.articles ?? []).filter(
      (a: ArticleRow) => a.source !== 'site_context' && a.title && (a.content_score ?? 0) > 0,
    );
    return arts
      .sort((a, b) => (b.content_score || 0) - (a.content_score || 0))
      .map((a) => ({ id: a.id, title: a.title, score: a.content_score || 0, href: recommendationsHref }));
  }, [domainRecsData, articlesData, recommendationsHref]);

  const recentlyEdited: RecentlyEditedItem[] = useMemo(() => {
    type ArticleRow = { id: number | string; title: string; content_score: number; target_keyword: string | null; updated_at: string | null; created_at: string | null; source?: string };
    // Only real articles — exclude site_context rows AND skeleton drafts whose title is
    // still the raw page URL (configure seeds those before analysis fills a real title).
    const arts: ArticleRow[] = (articlesData?.articles ?? []).filter(
      (a: ArticleRow) => a.source !== 'site_context' && a.title && !/^https?:\/\//i.test(a.title),
    );
    return arts
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        title: a.title,
        keywords: a.target_keyword || '',
        score: a.content_score || 0,
        updatedAt: a.updated_at || a.created_at || '',
        href: `/articles/${a.id}`,
      }));
  }, [articlesData]);

  const startLabel = formatShortDate(clickSeries[0]?.date || '');
  const endLabel = formatShortDate(clickSeries[clickSeries.length - 1]?.date || '');

  return (
    <DashboardLayout
      domains={domains}
      showAddModal={() => setShowAddDomain(true)}
      showSettings={() => setShowSettings(true)}
    >
      <>
        <Head>
          <title>Dashboard — SerpBear</title>
          <meta name="description" content="SerpBear Dashboard" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <div style={{ flex: 1, overflow: 'auto', padding: '48px 16px' }} className="styled-scrollbar">
          <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>
            <DashboardGreeting clicksTotal={clicksTotal} deltaPct={deltaPct} hasData={hasData} loading={sitesLoading} clicksHref={clicksHref} />
            <GetStartedCard />
            <BrandPerformance
              total={clicksTotal}
              deltaPct={deltaPct}
              points={points}
              startLabel={startLabel}
              endLabel={endLabel}
              clicksHref={clicksHref}
              loading={sitesLoading}
            />
            <RecentlyEdited items={recentlyEdited} loading={articlesLoading} />
            {/* The domain pipeline renders INSIDE the Recommendations section (its output
                IS the recommendations) — never a takeover of the whole dashboard. */}
            <RecommendationsSection
              items={recommendations.slice(0, 3)}
              total={recommendations.length}
              faviconDomain={primaryDomain?.domain || ''}
              viewHref={recommendationsHref}
              loading={articlesLoading}
              pipeline={pipelineActive && setup ? (
                <SetupPipeline
                  stages={setup.stages}
                  stagePercent={setup.stagePercent}
                  status={setup.status}
                  error={setup.error}
                  onRetry={() => { if (activeDomainSlug) runSetup.mutate(activeDomainSlug); }}
                />
              ) : undefined}
            />
            <LearnSection />
          </div>
        </div>

        {showAddDomain && (
          <AddDomain domains={domains} closeModal={() => setShowAddDomain(false)} />
        )}

        <CSSTransition in={showSettings} timeout={300} classNames="settings_anim" unmountOnExit mountOnEnter>
          <Settings closeSettings={() => setShowSettings(false)} />
        </CSSTransition>
      </>
    </DashboardLayout>
  );
};

export default DashboardPage;
