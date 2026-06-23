import React, { useEffect, useMemo, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { Toaster } from 'react-hot-toast';
import { CSSTransition } from 'react-transition-group';
import { useQuery } from 'react-query';
import DashboardLayout from '../../components/common/DashboardLayout';
import { useFetchDomains } from '../../services/domains';
import Settings from '../../components/settings/Settings';
import AddDomain from '../../components/domains/AddDomain';
import Gauge from '../../components/ui/Gauge';

const Greeting = () => {
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  if (hour === null) return <>Welcome back!</>;
  if (hour < 12) return <>Good morning!</>;
  if (hour < 18) return <>Good afternoon!</>;
  return <>Good evening!</>;
};

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ReturnIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.33789 7C5.06694 4.01099 8.29866 2 12.0001 2C17.5229 2 22.0001 6.47715 22.0001 12C22.0001 17.5228 17.5229 22 12.0001 22C8.29866 22 5.06694 19.989 3.33789 17M12 16L16 12M16 12L12 8M16 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GraduationIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 14.5001V11.4945C17 11.315 17 11.2253 16.9727 11.146C16.9485 11.076 16.9091 11.0122 16.8572 10.9592C16.7986 10.8993 16.7183 10.8592 16.5578 10.779L12 8.50006M4 9.50006V16.3067C4 16.6786 4 16.8645 4.05802 17.0274C4.10931 17.1713 4.1929 17.3016 4.30238 17.4082C4.42622 17.5287 4.59527 17.6062 4.93335 17.7612L11.3334 20.6945C11.5786 20.8069 11.7012 20.8631 11.8289 20.8853C11.9421 20.9049 12.0579 20.9049 12.1711 20.8853C12.2988 20.8631 12.4214 20.8069 12.6666 20.6945L19.0666 17.7612C19.4047 17.6062 19.5738 17.5287 19.6976 17.4082C19.8071 17.3016 19.8907 17.1713 19.942 17.0274C20 16.8645 20 16.6786 20 16.3067V9.50006M2 8.50006L11.6422 3.67895C11.7734 3.61336 11.839 3.58056 11.9078 3.56766C11.9687 3.55622 12.0313 3.55622 12.0922 3.56766C12.161 3.58056 12.2266 3.61336 12.3578 3.67895L22 8.50006L12.3578 13.3212C12.2266 13.3868 12.161 13.4196 12.0922 13.4325C12.0313 13.4439 11.9687 13.4439 11.9078 13.4325C11.839 13.4196 11.7734 13.3868 11.6422 13.3212L2 8.50006Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);


const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 6V12L16 14M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CreateContentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 8.00007L2 22.0001M18 15.0001H9M6.6 19.0001H13.3373C13.5818 19.0001 13.7041 19.0001 13.8192 18.9724C13.9213 18.9479 14.0188 18.9075 14.1083 18.8527C14.2092 18.7909 14.2957 18.7044 14.4686 18.5314L19.5 13.5001C19.739 13.2611 19.8584 13.1416 19.9546 13.0358C22.0348 10.7474 22.0348 7.25275 19.9546 4.9643C19.8584 4.85851 19.739 4.73903 19.5 4.50007C19.261 4.26111 19.1416 4.14163 19.0358 4.04547C16.7473 1.96531 13.2527 1.96531 10.9642 4.04547C10.8584 4.14163 10.739 4.26111 10.5 4.50007L5.46863 9.53144C5.29568 9.70439 5.2092 9.79087 5.14736 9.89179C5.09253 9.98126 5.05213 10.0788 5.02763 10.1808C5 10.2959 5 10.4182 5 10.6628V17.4001C5 17.9601 5 18.2401 5.10899 18.4541C5.20487 18.6422 5.35785 18.7952 5.54601 18.8911C5.75992 19.0001 6.03995 19.0001 6.6 19.0001Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const OptimizeContentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 21H4.6C4.03995 21 3.75992 21 3.54601 20.891C3.35785 20.7951 3.20487 20.6422 3.10899 20.454C3 20.2401 3 19.9601 3 19.4V3M21 7L15.5657 12.4343C15.3677 12.6323 15.2687 12.7313 15.1545 12.7684C15.0541 12.8011 14.9459 12.8011 14.8455 12.7684C14.7313 12.7313 14.6323 12.6323 14.4343 12.4343L12.5657 10.5657C12.3677 10.3677 12.2687 10.2687 12.1545 10.2316C12.0541 10.1989 11.9459 10.1989 11.8455 10.2316C11.7313 10.2687 11.6323 10.3677 11.4343 10.5657L7 15M21 7H17M21 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);


const skeletonStyle: React.CSSProperties = {
  background: '#F4F4F5',
  borderRadius: 6,
  animation: 'skeletonPulse 1.6s ease-in-out infinite',
};

const QuickStartSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ ...skeletonStyle, width: 20, height: 20, borderRadius: 4 }} />
      <div style={{ ...skeletonStyle, width: 80, height: 16 }} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }} className="dashboard-quickstart-grid">
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            padding: '16px 24px',
            borderRadius: 16,
            background: '#FFFFFF',
            border: '1px solid #F4F4F5',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ ...skeletonStyle, width: 36, height: 36, borderRadius: 8 }} />
          <div style={{ ...skeletonStyle, width: '55%', height: 14 }} />
        </div>
      ))}
    </div>
  </div>
);

const RecentlyEditedSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ ...skeletonStyle, width: 20, height: 20, borderRadius: 4 }} />
      <div style={{ ...skeletonStyle, width: 110, height: 16 }} />
    </div>
    <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, background: '#FFFFFF', overflow: 'hidden' }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '14px 20px',
            borderBottom: i < 3 ? '1px solid #F4F4F5' : 'none',
          }}
        >
          <div style={{ ...skeletonStyle, width: 44, height: 44, borderRadius: 9999, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ ...skeletonStyle, width: '70%', height: 14 }} />
            <div style={{ ...skeletonStyle, width: '40%', height: 12 }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const learnCards = [
  {
    label: 'New Video',
    title: '🎥  Write SEO Content That Ranks in Google and AI Search',
    meta: '25 min watch',
    image: 'https://images.surferseo.art/aaaca828-1c75-4a83-ae7c-7d4f98d003d7.png',
    href: 'https://youtu.be/QL_fgTOS4pI?si=pOMr46mtVCvsOvFj',
  },
  {
    label: 'Live Webinar',
    title: 'How to Optimize for AI Search and Capture High-Intent Traffic',
    meta: 'ft. Eli Schwartz',
    image: 'https://images.surferseo.art/bee9137c-88a0-4945-981e-fc84f9fb55f0.png',
    href: 'https://youtube.com/live/x5CgYCRLgbc?feature=share',
  },
  {
    label: 'Product Updates',
    title: "What's new at Surfer? April 2026",
    meta: '5 min read',
    image: 'https://images.surferseo.art/08a48d9f-9364-4ce5-adb1-eba7d1528841.jpg',
    href: 'https://surferseo.com/blog/whats-new-at-surfer-april-2026-product-roundup/',
  },
  {
    label: 'Data Study',
    title: 'Does AI More Strongly Recommend a Brand When More Cited Sources Mention It? (289,105 URLs Studied)',
    meta: '10 min read',
    image: 'https://images.surferseo.art/63585938-a875-45c1-9575-f703cde59f3a.avif',
    href: 'https://surferseo.com/blog/brand-mention-effect-on-ai-recommendations/',
  },
];

function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}

const DashboardPage: NextPage = () => {
  const { data: domainsData, isLoading: domainsLoading } = useFetchDomains({} as any);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSkipped(localStorage.getItem('onboardingSkipped') === 'true');
    setHydrated(true);
  }, []);

  const { data: gscData, isLoading: gscLoading } = useQuery('gscAccounts', async () => {
    const res = await fetch('/api/gsc/accounts');
    if (!res.ok) return { accounts: [] };
    return res.json();
  }, { retry: false });

  const { data: articlesData, isLoading: articlesLoading } = useQuery('dashboardArticles', async () => {
    const res = await fetch('/api/articles');
    if (!res.ok) return { articles: [] };
    return res.json();
  });

  const step1Done = (gscData?.accounts?.length ?? 0) > 0;
  const step2Done = (domainsData?.domains ?? []).some((d: any) => {
    if (!d.search_console) return false;
    try {
      const sc = JSON.parse(d.search_console);
      return sc.client_email === 'true' || sc.auth_type === 'oauth';
    } catch { return false; }
  });
  const allDone = step1Done && step2Done;

  const checklistSteps = [
    { label: 'Podłącz swoje konto Google Search Console', href: '/settings/google_search_console', done: step1Done },
    { label: 'Skonfiguruj chociaż jedną domenę z GSC', href: '/sites', done: step2Done },
  ];

  const completedSteps = checklistSteps.filter((s) => s.done).length;
  const totalSteps = checklistSteps.length;
  const progressPct = (completedSteps / totalSteps) * 100;

  const recentArticles = useMemo(() =>
    [...(articlesData?.articles ?? [])]
      .filter((a: any) => a.source !== 'site_context' && a.title)
      .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 4),
  [articlesData]);

  const handleSkip = () => {
    localStorage.setItem('onboardingSkipped', 'true');
    setSkipped(true);
  };

  const topSectionLoading = !hydrated || (gscLoading && !skipped) || (domainsLoading && !skipped);
  const showQuickStart = hydrated && (allDone || skipped);

  return (
    <DashboardLayout
      domains={domainsData?.domains || []}
      showAddModal={() => setShowAddDomain(true)}
      showSettings={() => setShowSettings(true)}
    >
      <>
      <Head>
        <title>Dashboard — SerpBear</title>
        <meta name="description" content="SerpBear Dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '48px 16px',
        }}
        className="styled-scrollbar"
      >
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 48,
          }}
        >
            {/* ─── Greeting ─── */}
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 24,
                  lineHeight: '32px',
                  fontWeight: 600,
                  color: '#09090b',
                  fontFamily: 'var(--font-family-primary)',
                  letterSpacing: 0,
                }}
              >
                <Greeting />
              </h1>
            </div>

            {topSectionLoading ? (
              <QuickStartSkeleton />
            ) : showQuickStart ? (
              <>
                {/* ─── Quick Start ─── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#52525C' }}>
                    <ReturnIcon />
                    <span
                      style={{
                        fontSize: 14,
                        lineHeight: '20px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-family-primary)',
                      }}
                    >
                      Quick start
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 16,
                    }}
                    className="dashboard-quickstart-grid"
                  >
                    {/* Create Content */}
                    <a
                      href="/articles"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '16px 24px',
                        borderRadius: 16,
                        background: '#FFFFFF',
                        textDecoration: 'none',
                        color: 'inherit',
                        transition: 'background-color 150ms ease, color 150ms ease',
                      }}
                      className="quickstart-card"
                    >
                      <div
                        style={{
                          display: 'flex',
                          flex: 1,
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#FFFFFF',
                            border: '1px solid #E4E4E7',
                            borderRadius: 8,
                            padding: 8,
                            boxShadow: '0px 1px 2px 0px rgba(26, 29, 40, 0.06)',
                            color: '#52525C',
                          }}
                        >
                          <CreateContentIcon />
                        </div>
                        <span
                          style={{
                            fontSize: 14,
                            lineHeight: '20px',
                            fontWeight: 500,
                            color: '#000',
                            fontFamily: 'var(--font-family-primary)',
                          }}
                        >
                          Create Content
                        </span>
                      </div>
                    </a>

                    {/* Optimize Content */}
                    <a
                      href="/sites"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '16px 24px',
                        borderRadius: 16,
                        background: '#FFFFFF',
                        textDecoration: 'none',
                        color: 'inherit',
                        transition: 'background-color 150ms ease, color 150ms ease',
                      }}
                      className="quickstart-card"
                    >
                      <div
                        style={{
                          display: 'flex',
                          flex: 1,
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#FFFFFF',
                            border: '1px solid #E4E4E7',
                            borderRadius: 8,
                            padding: 8,
                            boxShadow: '0px 1px 2px 0px rgba(26, 29, 40, 0.06)',
                            color: '#52525C',
                          }}
                        >
                          <OptimizeContentIcon />
                        </div>
                        <span
                          style={{
                            fontSize: 14,
                            lineHeight: '20px',
                            fontWeight: 500,
                            color: '#000',
                            fontFamily: 'var(--font-family-primary)',
                          }}
                        >
                          Optimize Content
                        </span>
                      </div>
                    </a>
                  </div>
                </div>

                {/* ─── Recently Edited ─── */}
                {articlesLoading ? (
                  <RecentlyEditedSkeleton />
                ) : recentArticles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#52525C' }}>
                      <ClockIcon />
                      <span
                        style={{
                          fontSize: 14,
                          lineHeight: '20px',
                          fontWeight: 600,
                          fontFamily: 'var(--font-family-primary)',
                        }}
                      >
                        Recently edited
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        border: '1px solid #F4F4F5',
                        borderRadius: 12,
                        background: '#FFFFFF',
                        overflow: 'hidden',
                      }}
                    >
                      {recentArticles.map((article: any, i: number) => (
                        <a
                          key={article.id}
                          href={article.slug ? `/articles/${article.slug}` : '/articles'}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: '14px 20px',
                            borderBottom: i < recentArticles.length - 1 ? '1px solid #F4F4F5' : 'none',
                            textDecoration: 'none',
                            color: 'inherit',
                            transition: 'background 150ms ease',
                          }}
                          className="recent-article-row"
                        >
                          <Gauge score={article.content_score ?? 0} size="sm" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 14,
                                lineHeight: '20px',
                                fontWeight: 500,
                                color: '#18181B',
                                fontFamily: 'var(--font-family-primary)',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {article.title}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                lineHeight: '16px',
                                color: '#A1A1AA',
                                fontFamily: 'var(--font-family-primary)',
                                marginTop: 2,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {article.target_keyword ? `${article.target_keyword} · ` : ''}
                              {formatRelativeDate(article.updated_at)}
                            </div>
                          </div>
                          <span style={{ color: '#A1A1AA', flexShrink: 0 }}>
                            <ChevronRightIcon />
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* ─── Get Started (Onboarding) ─── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: '#52525C',
                  }}
                >
                  <ReturnIcon />
                  <span
                    style={{
                      fontSize: 14,
                      lineHeight: '20px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-family-primary)',
                    }}
                  >
                    Get started
                  </span>
                </div>

                {/* Onboarding card */}
                <div
                  style={{
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    border: '1px solid #F4F4F5',
                    borderRadius: 12,
                    width: '100%',
                  }}
                >
                  {/* Header row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                    }}
                  >
                    <span
                      style={{
                        color: '#52525C',
                        fontSize: 14,
                        lineHeight: '20px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-family-primary)',
                      }}
                    >
                      {completedSteps} of {totalSteps} steps complete
                    </span>
                    <button
                      type="button"
                      onClick={handleSkip}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        fontSize: 14,
                        lineHeight: '20px',
                        color: '#52525C',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family-primary)',
                      }}
                    >
                      Skip checklist
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div
                    style={{
                      width: '100%',
                      height: 4,
                      background: '#E4E4E7',
                      borderRadius: 9999,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${progressPct}%`,
                        height: '100%',
                        background: '#137832',
                        borderRadius: 9999,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>

                  {/* Checklist items */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 16,
                      width: '100%',
                    }}
                  >
                    {checklistSteps.map((step, i) => (
                      <a
                        key={i}
                        href={step.href}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 10,
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          fontSize: 16,
                          lineHeight: '24px',
                          color: 'inherit',
                          textDecoration: 'none',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-family-primary)',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 18,
                            height: 18,
                            borderRadius: 9999,
                            flexShrink: 0,
                            ...(step.done
                              ? { background: '#137832', border: 'none' }
                              : { border: '2px solid #52525C', background: 'transparent' }),
                          }}
                        >
                          {step.done && <CheckIcon />}
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            lineHeight: '20px',
                            color: step.done ? '#A1A1AA' : '#18181B',
                            fontFamily: 'var(--font-family-primary)',
                            textDecoration: step.done ? 'line-through' : 'none',
                          }}
                        >
                          {step.label}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Learn ─── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#52525C',
                }}
              >
                <GraduationIcon />
                <span
                  style={{
                    fontSize: 14,
                    lineHeight: '20px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Learn
                </span>
              </div>

              {/* Cards grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(1, 1fr)',
                  gap: 12,
                }}
                className="dashboard-learn-grid"
              >
                {learnCards.map((card, i) => (
                  <a
                    key={i}
                    href={card.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      borderRadius: 16,
                      border: '1px solid #F4F4F5',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                      willChange: 'transform',
                    }}
                    className="learn-card"
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        aspectRatio: '16 / 9',
                        width: '100%',
                        overflow: 'hidden',
                        background: '#F4F4F5',
                      }}
                    >
                      <img
                        src={card.image}
                        alt={card.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        loading="lazy"
                      />
                    </div>
                    {/* Content */}
                    <div
                      style={{
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        flex: 1,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          lineHeight: '16px',
                          fontWeight: 500,
                          color: '#9F9FA9',
                          fontFamily: 'var(--font-family-primary)',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {card.label}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          lineHeight: '20px',
                          fontWeight: 600,
                          color: '#000',
                          fontFamily: 'var(--font-family-primary)',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {card.title}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          lineHeight: '16px',
                          fontWeight: 500,
                          color: '#9F9FA9',
                          marginTop: 'auto',
                          fontFamily: 'var(--font-family-primary)',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {card.meta}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

      <Toaster
        position="bottom-center"
        containerClassName="react_toaster"
        toastOptions={{
          style: {
            background: '#fff',
            color: '#111827',
            border: '1px solid #e4e4e7',
            fontSize: 13,
            fontFamily: 'var(--font-family-primary)',
          },
        }}
      />

      {showAddDomain && (
        <AddDomain
          domains={domainsData?.domains || []}
          closeModal={() => setShowAddDomain(false)}
        />
      )}

      <CSSTransition in={showSettings} timeout={300} classNames="settings_anim" unmountOnExit mountOnEnter>
        <Settings closeSettings={() => setShowSettings(false)} />
      </CSSTransition>
      </>
    </DashboardLayout>
  );
};

export default DashboardPage;
