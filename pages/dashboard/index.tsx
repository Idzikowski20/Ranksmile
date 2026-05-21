import React, { useEffect, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { Toaster } from 'react-hot-toast';
import { CSSTransition } from 'react-transition-group';
import DashboardLayout from '../../components/common/DashboardLayout';
import { useFetchDomains } from '../../services/domains';
import Settings from '../../components/settings/Settings';
import AddDomain from '../../components/domains/AddDomain';

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

// -- Onboarding checklist data --
const checklistSteps = [
  { label: 'Audit your content', href: '/domains', done: false },
  { label: 'Write and optimize your content', href: '/articles', done: false },
];

// -- Learn cards data --
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

const DashboardPage: NextPage = () => {
  const { data: domainsData } = useFetchDomains({} as any);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);

  const completedSteps = checklistSteps.filter((s) => s.done).length;
  const totalSteps = checklistSteps.length;
  const progressPct = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

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

            {/* ─── Get Started ─── */}
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
                        gap: 8,
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
                          display: 'inline-block',
                          width: 16,
                          height: 16,
                          borderRadius: 9999,
                          border: '2px solid #52525C',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 14,
                          lineHeight: '20px',
                          color: '#000',
                          fontFamily: 'var(--font-family-primary)',
                        }}
                      >
                        {step.label}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

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
