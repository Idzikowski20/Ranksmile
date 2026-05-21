import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { CSSTransition } from 'react-transition-group';
import DashboardLayout from '../../components/common/DashboardLayout';
import Settings from '../../components/settings/Settings';
import { useFetchDomains } from '../../services/domains';

type GSCSite = {
  siteUrl: string;
  permissionLevel: string;
};

type SiteInfo = {
  siteUrl: string;
  domain: string;
  slug: string;
  existingDomainId: number | null;
  propertyType: 'domain' | 'url';
  permissionLevel: string;
  gscConfigured: boolean;
  impressions: number;
  clicks: number;
  position: number;
};

function parseGSCSiteUrl(siteUrl: string): { domain: string; propertyType: 'domain' | 'url' } {
  if (siteUrl.startsWith('sc-domain:')) {
    return { domain: siteUrl.replace('sc-domain:', ''), propertyType: 'domain' };
  }
  // URL prefix property
  try {
    const url = new URL(siteUrl);
    return { domain: url.hostname, propertyType: 'url' };
  } catch {
    return { domain: siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, ''), propertyType: 'url' };
  }
}

function findMatchingDomain(gscDomain: string, domains: DomainType[]): DomainType | undefined {
  return domains.find((d) => {
    const dbDomain = d.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return dbDomain === gscDomain || dbDomain === `www.${gscDomain}` || gscDomain === `www.${dbDomain}`;
  });
}

const Sites: NextPage = () => {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'az' | 'clicks' | 'impressions'>('az');
  const [sortOpen, setSortOpen] = useState(false);
  const [toConfigureOpen, setToConfigureOpen] = useState(true);
  const [configuredOpen, setConfiguredOpen] = useState(true);

  const handleConfigure = (site: SiteInfo) => {
    router.push(`/sites/configure?siteUrl=${encodeURIComponent(site.siteUrl)}`);
  };

  const { data: gscData, isLoading } = useQuery('gsc-sites', async () => {
    const res = await fetch('/api/sites');
    if (!res.ok) throw new Error('Failed to fetch GSC sites');
    return res.json() as Promise<{ sites: GSCSite[]; error?: string }>;
  });

  const { data: domainsData } = useFetchDomains(router, true);
  const domains = domainsData?.domains || [];

  const sites: SiteInfo[] = useMemo(() => {
    if (!gscData?.sites) return [];
    return gscData.sites.map((gs) => {
      const { domain, propertyType } = parseGSCSiteUrl(gs.siteUrl);
      const matchedDomain = findMatchingDomain(domain, domains);
      const slug = matchedDomain?.slug || domain.replace(/\./g, '-');
      return {
        siteUrl: gs.siteUrl,
        domain,
        slug,
        existingDomainId: matchedDomain?.ID || null,
        propertyType,
        permissionLevel: gs.permissionLevel,
        gscConfigured: !!matchedDomain,
        impressions: matchedDomain?.scImpressions || 0,
        clicks: matchedDomain?.scVisits || 0,
        position: matchedDomain?.scPosition ? Math.round(matchedDomain.scPosition) : 0,
      };
    });
  }, [gscData, domains]);

  const filteredSites = useMemo(() => {
    let filtered = sites;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => s.domain.toLowerCase().includes(q));
    }
    if (sortBy === 'az') {
      filtered = [...filtered].sort((a, b) => a.domain.localeCompare(b.domain));
    } else if (sortBy === 'clicks') {
      filtered = [...filtered].sort((a, b) => b.clicks - a.clicks);
    } else if (sortBy === 'impressions') {
      filtered = [...filtered].sort((a, b) => b.impressions - a.impressions);
    }
    return filtered;
  }, [sites, searchQuery, sortBy]);

  const toConfigure = filteredSites.filter((s) => !s.gscConfigured);
  const configured = filteredSites.filter((s) => s.gscConfigured);

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const sortLabel: Record<string, string> = {
    az: 'Alphabetically (A-Z)',
    clicks: 'Clicks',
    impressions: 'Impressions',
  };

  const renderCard = (site: SiteInfo) => {
    const displayName = site.propertyType === 'url' ? site.siteUrl : site.domain;
    const faviconDomain = site.domain;

    return (
      <div
        key={site.siteUrl}
        className="group/card"
        style={{
          position: 'relative',
          minHeight: 242,
          width: '100%',
          cursor: 'pointer',
          borderRadius: 12,
          border: '1px solid #E4E4E7',
          padding: 24,
          transition: 'box-shadow 0.15s',
          background: '#fff',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            borderRadius: 12,
            opacity: 0,
            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)',
            transition: 'opacity 0.15s',
          }}
          className="group-hover/card:opacity-100"
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%', flexGrow: 1, justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%', flexGrow: 1, justifyContent: 'space-between' }}>
            {/* Domain name row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <img
                    alt=""
                    style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }}
                    src={`https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=32`}
                  />
                  {site.gscConfigured ? (
                    <Link href={`/domain/${site.slug}`} passHref>
                      <a
                        title={site.siteUrl}
                        style={{
                          fontSize: 16,
                          lineHeight: '24px',
                          fontWeight: 600,
                          color: '#2F2F34',
                          textDecoration: 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: 'var(--font-family-primary)',
                        }}
                      >
                        {displayName}
                      </a>
                    </Link>
                  ) : (
                    <span
                      title={site.siteUrl}
                      style={{
                        fontSize: 16,
                        lineHeight: '24px',
                        fontWeight: 600,
                        color: '#2F2F34',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-family-primary)',
                      }}
                    >
                      {displayName}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Open details"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    color: '#9F9FA9',
                    flexShrink: 0,
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    if (site.gscConfigured) {
                      router.push(`/domain/${site.slug}`);
                    }
                  }}
                >
                  <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0m5.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0m7-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3" />
                  </svg>
                </button>
              </div>
              <span style={{ fontSize: 12, fontWeight: 400, textTransform: 'uppercase', color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
                {site.propertyType === 'domain' ? 'Domain Property' : 'URL Property'}
              </span>
            </div>

            {/* Metrics row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
                  <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" style={{ flexShrink: 0, color: '#3B82F6' }}>
                    <path d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1M5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06A.75.75 0 1 1 6.11 5.173L5.05 4.11a.75.75 0 0 1 0-1.06m9.9 0a.75.75 0 0 1 0 1.06l-1.06 1.062a.75.75 0 0 1-1.062-1.061l1.061-1.06a.75.75 0 0 1 1.06 0M3 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 3 8m11 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 14 8m-6.828 2.828a.75.75 0 0 1 0 1.061L6.11 12.95a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0m3.596-3.32a.75.75 0 0 0-1.37.365l-.492 6.861a.75.75 0 0 0 1.204.65l1.043-.799.985 3.678a.75.75 0 0 0 1.45-.388l-.978-3.646 1.292.204a.75.75 0 0 0 .74-1.16z" />
                  </svg>
                  <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: '#2F2F34', fontFamily: 'var(--font-family-primary)' }}>
                    {site.gscConfigured ? formatNumber(site.clicks) : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
                  <svg viewBox="0 0 20 20" width="20" height="20" style={{ flexShrink: 0, color: '#A855F7' }}>
                    <g fill="currentColor">
                      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" />
                      <path fillRule="evenodd" d="M.664 10.59a1.65 1.65 0 0 1 0-1.186A10 10 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10 10 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41M14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0" clipRule="evenodd" />
                    </g>
                  </svg>
                  <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: '#2F2F34', fontFamily: 'var(--font-family-primary)' }}>
                    {site.gscConfigured ? formatNumber(site.impressions) : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" style={{ flexShrink: 0, color: '#EF4444' }}>
                    <path fillRule="evenodd" d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.202-.257.59-.218.793.039q.418.53.943.954c.332.269.786-.049.773-.476L7 7c0-.919.206-1.789.575-2.567a6.03 6.03 0 0 1 2.486-2.665c.247-.14.55-.016.677.238A6.97 6.97 0 0 0 13.5 4.938M14 12a4 4 0 0 1-4 4c-1.913 0-3.52-1.398-3.91-3.182-.093-.429.44-.643.814-.413a4 4 0 0 0 1.601.564c.303.038.531-.24.51-.544a5.98 5.98 0 0 1 1.315-4.192.45.45 0 0 1 .431-.16A4 4 0 0 1 14 12" clipRule="evenodd" />
                  </svg>
                  <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: '#2F2F34', fontFamily: 'var(--font-family-primary)' }}>
                    {site.gscConfigured && site.position > 0 ? site.position.toFixed(1) : '—'}
                  </span>
                </div>
              </div>
              {!site.gscConfigured ? (
                <button
                  type="button"
                  onClick={() => handleConfigure(site)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#F4F4F5',
                    fontSize: 14,
                    lineHeight: '20px',
                    fontWeight: 600,
                    color: '#2F2F34',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family-primary)',
                    transition: 'background 0.15s',
                  }}
                >
                  Configure
                </button>
              ) : (
                <Link href={`/domain/console/${site.slug}`} passHref>
                  <a
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#F4F4F5',
                      fontSize: 14,
                      lineHeight: '20px',
                      fontWeight: 600,
                      color: '#2F2F34',
                      cursor: 'pointer',
                      textDecoration: 'none',
                      fontFamily: 'var(--font-family-primary)',
                      transition: 'background 0.15s',
                    }}
                  >
                    View
                  </a>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout
      domains={domains}
      showAddModal={() => {}}
      showSettings={() => setShowSettings(true)}
    >
      <Head>
        <title>Sites — SerpBear</title>
      </Head>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          background: '#fff',
          padding: '0 16px',
        }}
        className="styled-scrollbar"
      >
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
            paddingTop: 24,
            paddingBottom: 32,
          }}
        >
          {/* ─── Header ─── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  data-tour="page-heading"
                  style={{
                    fontSize: 20,
                    lineHeight: '28px',
                    fontWeight: 600,
                    color: '#2F2F34',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Sites
                </span>
              </div>
            </div>
            <Link href="/settings" passHref>
              <a
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  fontSize: 14,
                  lineHeight: '20px',
                  fontWeight: 600,
                  color: '#9F9FA9',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-family-primary)',
                  transition: 'color 0.15s',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <g clipPath="url(#g_icon)">
                    <path d="M15.6823 8.18368C15.6823 7.63986 15.6382 7.0931 15.5442 6.55811H7.99829V9.63876H12.3194C12.1401 10.6323 11.564 11.5113 10.7203 12.0698V14.0687H13.2983C14.8122 12.6753 15.6823 10.6176 15.6823 8.18368Z" fill="#4285F4" />
                    <path d="M7.99812 16C10.1558 16 11.9753 15.2915 13.3011 14.0687L10.7231 12.0698C10.0058 12.5578 9.07988 12.8341 8.00106 12.8341C5.91398 12.8341 4.14436 11.426 3.50942 9.53296H0.849121V11.5936C2.2072 14.295 4.97332 16 7.99812 16Z" fill="#34A853" />
                    <path d="M3.50665 9.53295C3.17154 8.53938 3.17154 7.4635 3.50665 6.46993V4.4093H0.849292C-0.285376 6.66982 -0.285376 9.33306 0.849292 11.5936L3.50665 9.53295Z" fill="#FBBC04" />
                    <path d="M7.99812 3.16589C9.13867 3.14825 10.241 3.57743 11.067 4.36523L13.3511 2.0812C11.9048 0.723121 9.98526 -0.0235266 7.99812 -1.02057e-05C4.97332 -1.02057e-05 2.2072 1.70493 0.849121 4.40932L3.50648 6.46995C4.13848 4.57394 5.91104 3.16589 7.99812 3.16589Z" fill="#EA4335" />
                  </g>
                  <defs>
                    <clipPath id="g_icon">
                      <rect width="15.6825" height="16" fill="white" />
                    </clipPath>
                  </defs>
                </svg>
                Search Console accounts
                <svg viewBox="0 0 20 20" width="20" height="20" style={{ flexShrink: 0 }}>
                  <path fill="currentColor" fillRule="evenodd" d="M5.22 14.78a.75.75 0 0 0 1.06 0l7.22-7.22v5.69a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-.75-.75h-7.5a.75.75 0 0 0 0 1.5h5.69l-7.22 7.22a.75.75 0 0 0 0 1.06" clipRule="evenodd" />
                </svg>
              </a>
            </Link>
          </div>

          {/* ─── Controls: Sort, Filters, Search ─── */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setSortOpen(!sortOpen)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 16px',
                    borderRadius: 9999,
                    border: '1px solid #D4D4D8',
                    background: 'transparent',
                    fontSize: 14,
                    lineHeight: '20px',
                    fontWeight: 600,
                    color: '#2F2F34',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family-primary)',
                    transition: 'background 0.15s',
                  }}
                >
                  <span>{sortLabel[sortBy]}</span>
                  <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" style={{ flexShrink: 0, transition: 'transform 0.15s', transform: sortOpen ? 'rotate(180deg)' : undefined, color: '#9F9FA9' }}>
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
                  </svg>
                </button>
                {sortOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setSortOpen(false)} />
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        zIndex: 10,
                        background: '#fff',
                        border: '1px solid #D4D4D8',
                        borderRadius: 8,
                        boxShadow: '0px 4px 16px rgba(0,0,0,0.12)',
                        overflow: 'hidden',
                        minWidth: 220,
                      }}
                    >
                      {(['az', 'clicks', 'impressions'] as const).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setSortBy(key); setSortOpen(false); }}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 16px',
                            border: 'none',
                            background: sortBy === key ? '#F4F4F5' : 'transparent',
                            fontSize: 14,
                            lineHeight: '20px',
                            fontWeight: sortBy === key ? 600 : 400,
                            color: '#2F2F34',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-family-primary)',
                          }}
                        >
                          {sortLabel[key]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 16px',
                  borderRadius: 9999,
                  border: '1px solid #D4D4D8',
                  background: 'transparent',
                  fontSize: 14,
                  lineHeight: '20px',
                  fontWeight: 600,
                  color: '#2F2F34',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family-primary)',
                }}
              >
                <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M17 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0zm0 13a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0zM3.75 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75M4.5 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0zM10 11a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5A.75.75 0 0 1 10 11m.75-8.25a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0zM10 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-6.25 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4m12.5 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4" />
                </svg>
                <span>Filters</span>
              </button>
            </div>

            <div style={{ width: 200 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: '#9F9FA9' }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search"
                  aria-label="Search by url"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: 32,
                    paddingLeft: 32,
                    paddingRight: 12,
                    border: '1px solid #D4D4D8',
                    borderRadius: 8,
                    fontSize: 13,
                    lineHeight: '16px',
                    color: '#2F2F34',
                    background: '#fff',
                    outline: 'none',
                    fontFamily: 'var(--font-family-primary)',
                    boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; }}
                />
              </div>
            </div>
          </div>

          {/* ─── Content ─── */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', fontSize: 14, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
              Loading sites from Search Console...
            </div>
          ) : gscData?.error && sites.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 0',
                fontSize: 14,
                color: '#9F9FA9',
                border: '1px solid #E4E4E7',
                borderRadius: 12,
                fontFamily: 'var(--font-family-primary)',
              }}
            >
              <p style={{ marginBottom: 8, color: '#EF4444' }}>Could not fetch sites from Search Console.</p>
              <p style={{ margin: 0 }}>{gscData.error}</p>
              <p style={{ margin: '16px 0 0 0', fontSize: 13 }}>
                Go to{' '}
                <Link href="/settings" passHref>
                  <a style={{ color: '#783AFB', textDecoration: 'underline' }}>Settings</a>
                </Link>
                {' '}to connect your Search Console account.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {toConfigure.length > 0 && (
                <div>
                  <h3 style={{ margin: 0 }}>
                    <button
                      type="button"
                      onClick={() => setToConfigureOpen(!toConfigureOpen)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        fontSize: 16,
                        lineHeight: '24px',
                        fontWeight: 600,
                        color: '#52525C',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family-primary)',
                        marginBottom: toConfigureOpen ? 24 : 0,
                      }}
                    >
                      To configure
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{ flexShrink: 0, transition: 'transform 0.2s', transform: toConfigureOpen ? 'rotate(180deg)' : undefined }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </h3>
                  {toConfigureOpen && (
                    <div className="md:grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 24 }}>
                      {toConfigure.map(renderCard)}
                    </div>
                  )}
                </div>
              )}

              {configured.length > 0 && (
                <div>
                  <h3 style={{ margin: 0 }}>
                    <button
                      type="button"
                      onClick={() => setConfiguredOpen(!configuredOpen)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        fontSize: 16,
                        lineHeight: '24px',
                        fontWeight: 600,
                        color: '#52525C',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family-primary)',
                        marginBottom: configuredOpen ? 24 : 0,
                      }}
                    >
                      Connected
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{ flexShrink: 0, transition: 'transform 0.2s', transform: configuredOpen ? 'rotate(180deg)' : undefined }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </h3>
                  {configuredOpen && (
                    <div className="md:grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 24 }}>
                      {configured.map(renderCard)}
                    </div>
                  )}
                </div>
              )}

              {filteredSites.length === 0 && !isLoading && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '48px 0',
                    fontSize: 14,
                    color: '#9F9FA9',
                    border: '1px solid #E4E4E7',
                    borderRadius: 12,
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  {sites.length === 0 ? 'No sites found. Connect your Search Console account to see sites.' : 'No sites match your search.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CSSTransition in={showSettings} timeout={300} classNames="settings_anim" unmountOnExit mountOnEnter>
        <Settings closeSettings={() => setShowSettings(false)} />
      </CSSTransition>
    </DashboardLayout>
  );
};

export default Sites;
