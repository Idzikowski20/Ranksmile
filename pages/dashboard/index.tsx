import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { CSSTransition } from 'react-transition-group';
import { useQuery, useQueryClient } from 'react-query';
import { deriveActiveId, resolveActiveDomain, workspaceHref } from '@/src/core/domain/navigation/activeWorkspace';
import { useStaggerReveal } from '@/components/motion/useStaggerReveal';
import fetchJson from '@/src/infrastructure/http/fetchJson';
import { authClient } from '@/src/infrastructure/auth/client';
import DashboardLayout from '../../components/common/DashboardLayout';
import { KoalaPage } from '../../components/koala/layout';
import { FeedbackPopover } from '../../components/koala/product';
import { Button } from '../../components/koala/core';
import { useFetchDomains } from '../../services/domains';
import { useWorkspaces } from '../../services/workspaces';
import { useProfile } from '../../services/profile';
import Settings from '../../components/settings/Settings';
import AddDomain from '../../components/domains/AddDomain';
import DashboardGreeting from '../../components/dashboard/DashboardGreeting';
import PageTour from '../../components/onboarding/PageTour';
import GetStartedPanel from '../../components/dashboard/GetStartedPanel';
import ActionTiles from '../../components/dashboard/ActionTiles';
import DashboardArticles from '../../components/dashboard/DashboardArticles';
import type { ArticleCardData } from '../../components/articles/ArticleCard';
import { useSetupStatus, useRunSetup, isSetupBusy } from '../../services/domainPipeline';

type DashboardArticle = ArticleCardData & { source?: string };

const DashboardPage: NextPage = () => {
  const router = useRouter();
  const { data: domainsData } = useFetchDomains(router);
  const queryClient = useQueryClient();
  const { data: wsData } = useWorkspaces();
  const { data: profile } = useProfile();
  const session = authClient.useSession?.();
  // SSR-safe active workspace id so links carry the /workspace/<id> prefix the rest of
  // the app uses (parsed from the URL after mount; falls back to the workspaces activeId).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const activeWsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);

  const domains: DomainType[] = domainsData?.domains || [];
  const activeWorkspace = wsData?.workspaces.find((w) => w.id === activeWsId) ?? null;
  const primaryDomain = resolveActiveDomain(domains, activeWsId, activeWorkspace?.domain) ?? null;
  const primaryDomainId = primaryDomain?.ID ?? null;
  const primaryDomainName = primaryDomain?.domain ?? null;
  const activeDomainSlug: string | null = primaryDomain?.slug ?? null;

  const userName = mounted ? (profile?.name || session?.data?.user?.name || '') : '';
  const firstName = userName.trim().split(/\s+/)[0] || '';
  const author = userName ? { name: userName, avatarUrl: profile?.avatarUrl } : undefined;

  const { data: sitesData, isLoading: sitesLoading } = useQuery(
    ['dashboardSites', activeWsId, primaryDomainName],
    () => fetchJson('/api/sites', { domainStats: {} as Record<string, unknown> }),
    { enabled: !!primaryDomainName, retry: false },
  );

  const { data: articlesData, isLoading: articlesLoading } = useQuery(
    ['dashboardArticles', activeWsId, primaryDomainId],
    () => fetchJson(`/api/articles?domainId=${primaryDomainId}&limit=100`, { articles: [] as DashboardArticle[] }),
    { enabled: !!primaryDomainId, retry: false },
  );

  // ── Clicks: GSC daily clicks for the active workspace's domain, last 30 vs previous 30 ──
  const clickSeries = useMemo(() => {
    if (!primaryDomainName) return [];
    const stats = sitesData?.domainStats || {};
    type StatEntry = { chart?: Array<{ date: string; clicks?: number }> };
    const chart = (stats[primaryDomainName] as StatEntry | undefined)?.chart || [];
    return chart.map((p) => ({ date: p.date, clicks: p.clicks || 0 }));
  }, [sitesData, primaryDomainName]);
  const recent30 = clickSeries.slice(-30);
  const prev30 = clickSeries.slice(-60, -30);
  const clicksTotal = recent30.reduce((a, b) => a + b.clicks, 0);
  const prevSum = prev30.reduce((a, b) => a + b.clicks, 0);
  const deltaPct = prevSum > 0 ? Math.round(((clicksTotal - prevSum) / prevSum) * 100) : (clicksTotal > 0 ? 100 : 0);
  const hasData = recent30.length > 0;

  const site = (path: string) => workspaceHref(activeWsId, primaryDomain ? `/sites/${primaryDomain.slug}${path}` : '/dashboard');
  const clicksHref = site('');
  const createHref = workspaceHref(activeWsId, '/articles/new');
  const articlesHref = workspaceHref(activeWsId, '/articles');

  // ── Pipeline polling ──
  const { data: setup } = useSetupStatus(activeDomainSlug);
  const busy = isSetupBusy(setup);
  const runSetup = useRunSetup();

  // Fallback kick: if no job exists yet for this domain, trigger one — but ONCE per
  // domain. The ref latch + isLoading guard stop a refetch (window focus, the done
  // invalidation, an enqueue race) from re-reading 'none' and spamming run-setup.
  const kickedRef = useRef<string | null>(null);
  const revealRef = useStaggerReveal<HTMLDivElement>(':scope > *');
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
      queryClient.invalidateQueries(['dashboardArticles', activeWsId, primaryDomainId]);
      queryClient.invalidateQueries(['dashboardSites', activeWsId, primaryDomainName]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.status]);

  // Only real articles — exclude site_context rows AND skeleton drafts whose title is
  // still the raw page URL (configure seeds those before analysis fills a real title).
  const articles = useMemo(
    () => (articlesData?.articles ?? []).filter((a) => a.source !== 'site_context' && a.title && !/^https?:\/\//i.test(a.title)),
    [articlesData],
  );

  return (
    <DashboardLayout
      domains={domains}
      showAddModal={() => setShowAddDomain(true)}
      showSettings={() => setShowSettings(true)}
    >
      <>
        <Head>
          <title>Dashboard — Ranksmile</title>
          <meta name="description" content="Ranksmile Dashboard" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <PageTour />
        <KoalaPage maxWidth={1120}>
          <div ref={revealRef} style={{ display: 'flex', flexDirection: 'column', gap: 32 }} data-testid="dashboard-widget-row">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <DashboardGreeting
                name={firstName}
                clicksTotal={clicksTotal}
                deltaPct={deltaPct}
                hasData={hasData}
                loading={sitesLoading}
                clicksHref={clicksHref}
              />
              <FeedbackPopover context="dashboard">
                {({ open, anchorRef }) => (
                  <span ref={anchorRef as React.RefObject<HTMLSpanElement>}>
                    <Button type="button" variant="secondary" size="sm" onClick={open}>
                      Leave feedback
                    </Button>
                  </span>
                )}
              </FeedbackPopover>
            </div>

            <GetStartedPanel createHref={createHref} />

            <ActionTiles tiles={[
              { key: 'create', title: 'Create content', description: 'Write an article that ranks', href: createHref, icon: 'NotePencil', disabled: busy },
              { key: 'keywords', title: 'Track keywords', description: 'Watch your Google rankings', href: site('/keyword-tracking'), icon: 'ChartLineUp' },
              { key: 'ai', title: 'Track AI visibility', description: 'See where AI answers mention you', href: site('/ai-visibility/overview'), icon: 'Sparkle', disabled: busy },
            ]} />

            <DashboardArticles
              articles={articles}
              loading={articlesLoading}
              hrefFor={(a) => `/articles/${a.id}`}
              allHref={articlesHref}
              author={author}
            />
          </div>
        </KoalaPage>

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
