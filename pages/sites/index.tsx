import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { CSSTransition } from 'react-transition-group';
import DashboardLayout from '../../components/common/DashboardLayout';
import Settings from '../../components/settings/Settings';
import { Button, CompactSelect, MenuListItem, SearchBar } from '../../components/core';
import { SkeletonRows } from '../../components/aiVisibility/SkeletonBlocks';
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

const MetricWithTooltip = ({ icon, value, label, tooltip, color }: { icon: React.ReactNode; value: string; label: string; tooltip: string; color: string }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ color, display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</div>
      <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>{value}</span>
      <span style={{ fontSize: 12, lineHeight: '16px', color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>{label}</span>
      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            padding: '4px 8px',
            borderRadius: 6,
            background: '#18181B',
            color: '#fff',
            fontSize: 12,
            lineHeight: '16px',
            fontFamily: 'var(--font-family-primary)',
            zIndex: 20,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {tooltip}
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #18181B' }} />
        </div>
      )}
    </div>
  );
};

const Sites: NextPage = () => {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'az' | 'clicks' | 'impressions'>('az');
  const [toConfigureOpen, setToConfigureOpen] = useState(true);
  const [configuredOpen, setConfiguredOpen] = useState(true);
  const [openMenuSite, setOpenMenuSite] = useState<string | null>(null);

  const handleConfigure = (site: SiteInfo) => {
    router.push(`/sites/configure?siteUrl=${encodeURIComponent(site.siteUrl)}`);
  };

  const { data: gscData, isLoading } = useQuery('gsc-sites', async () => {
    const res = await fetch('/api/sites');
    if (!res.ok) throw new Error('Failed to fetch GSC sites');
    return res.json() as Promise<{ sites: GSCSite[]; domainStats?: Record<string, { impressions: number; clicks: number; position: number; chart: { date: string; clicks: number; impressions: number }[] }>; error?: string }>;
  });

  const { data: gscAccounts } = useQuery('gsc-accounts-avatar', async () => {
    const res = await fetch('/api/gsc/accounts', { credentials: 'include' });
    if (!res.ok) return null;
    return res.json() as Promise<{ accounts?: { picture?: string; email?: string }[] }>;
  });
  const accountPicture = gscAccounts?.accounts?.[0]?.picture || '';
  const accountInitial = gscAccounts?.accounts?.[0]?.email?.charAt(0).toUpperCase() || '?';

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

  function buildAreaPath(data: number[], width: number, height: number): string {
    if (!data.length) return '';
    const max = Math.max(...data, 1);
    const stepX = width / (data.length - 1 || 1);
    let d = `M0,${height}`;
    data.forEach((v, i) => {
      const y = height - (v / max) * height;
      d += ` L${i * stepX},${y}`;
    });
    d += ` L${width},${height} Z`;
    return d;
  }

  function buildLinePath(data: number[], width: number, height: number): string {
    if (!data.length) return '';
    const max = Math.max(...data, 1);
    const stepX = width / (data.length - 1 || 1);
    return data.map((v, i) => {
      const y = height - (v / max) * height;
      return `${i === 0 ? 'M' : 'L'}${i * stepX},${y}`;
    }).join(' ');
  }

  const sortLabel: Record<string, string> = {
    az: 'Alphabetically (A-Z)',
    clicks: 'Clicks',
    impressions: 'Impressions',
  };

  const renderCard = (site: SiteInfo) => {
    const displayName = site.propertyType === 'url' ? site.siteUrl : site.domain;
    const faviconDomain = site.domain;
    const stats = gscData?.domainStats?.[site.domain];
    const chartData = stats?.chart || [];
    const chartW = 300;
    const chartH = 80;
    const impressionPath = buildAreaPath(chartData.map((d) => d.impressions), chartW, chartH);
    const clickPath = buildLinePath(chartData.map((d) => d.clicks), chartW, chartH);

    const firstDate = chartData[0]?.date || '';
    const lastDate = chartData[chartData.length - 1]?.date || '';
    const dateLabel = firstDate && lastDate ? `${firstDate} – ${lastDate}` : 'Last 30 days';

    // Find matched domain record for last-edited info
    const matchedDomain = domains.find((d) => d.slug === site.slug);
    const lastEdited = matchedDomain?.lastUpdated
      ? (() => {
          const d = new Date(matchedDomain.lastUpdated);
          const diff = Date.now() - d.getTime();
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          if (days === 0) return 'Today';
          if (days === 1) return 'Yesterday';
          return `${days}d ago`;
        })()
      : null;

    const menuOpen = openMenuSite === site.siteUrl;

    return (
      <div
        key={site.siteUrl}
        style={{
          position: 'relative',
          width: '100%',
          cursor: site.gscConfigured ? 'pointer' : 'default',
          borderRadius: 12,
          border: '1px solid #E4E4E7',
          padding: 24,
          transition: 'border-color 0.15s',
          background: '#fff',
        }}
        onClick={() => {
          if (site.gscConfigured) {
            router.push(`/sites/${site.slug}/performance`);
          }
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
          {/* Header row: favicon + domain + menu */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <img
                alt=""
                style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }}
                src={`https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=32`}
              />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {site.gscConfigured ? (
                  <Link href={`/sites/${site.slug}/performance`} passHref>
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
                <span style={{ fontSize: 11, lineHeight: '16px', fontWeight: 500, textTransform: 'uppercase', color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
                  {site.propertyType === 'domain' ? 'Domain Property' : 'URL Property'}
                </span>
              </div>
            </div>

            {/* "..." menu */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Button
                type="button"
                variant="transparent"
                size="xs"
                aria-label="More actions"
                aria-expanded={menuOpen}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMenuSite(menuOpen ? null : site.siteUrl); }}
                icon={(
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
                    <path d="M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0m5.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0m7-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3" />
                  </svg>
                )}
              />
              {menuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={(e) => { e.stopPropagation(); setOpenMenuSite(null); }} />
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      zIndex: 10,
                      background: '#fff',
                      border: '1px solid #E4E4E7',
                      borderRadius: 8,
                      boxShadow: '0px 4px 16px rgba(0,0,0,0.12)',
                      overflow: 'hidden',
                      minWidth: 160,
                      padding: 4,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {site.gscConfigured && (
                      <MenuListItem
                        label="View details"
                        onClick={() => { setOpenMenuSite(null); router.push(`/sites/${site.slug}/performance`); }}
                      />
                    )}
                    <MenuListItem
                      label={site.gscConfigured ? 'Reconfigure' : 'Configure'}
                      onClick={() => { setOpenMenuSite(null); handleConfigure(site); }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Chart — for configured sites with data, placeholder spacer otherwise */}
          {site.gscConfigured && chartData.length > 1 ? (
            <div style={{ width: '100%', height: chartH, overflow: 'hidden' }}>
              <svg viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                <path d={impressionPath} fill="rgba(168,85,247,0.15)" />
                <path d={buildLinePath(chartData.map((d) => d.impressions), chartW, chartH)} fill="none" stroke="#A855F7" strokeWidth="1" />
                <path d={clickPath} fill="none" stroke="#3B82F6" strokeWidth="1" />
              </svg>
            </div>
          ) : (
            <div style={{ width: '100%', height: chartH }} />
          )}

          {/* Bottom row: metrics + edited + avatar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <MetricWithTooltip
                color="#3B82F6"
                value={site.gscConfigured ? formatNumber(site.clicks) : '—'}
                label=""
                tooltip={site.gscConfigured ? `${formatNumber(site.clicks)} clicks · ${dateLabel}` : 'No data'}
                icon={
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
                    <path d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1M5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06A.75.75 0 1 1 6.11 5.173L5.05 4.11a.75.75 0 0 1 0-1.06m9.9 0a.75.75 0 0 1 0 1.06l-1.06 1.062a.75.75 0 0 1-1.062-1.061l1.061-1.06a.75.75 0 0 1 1.06 0M3 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 3 8m11 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 14 8m-6.828 2.828a.75.75 0 0 1 0 1.061L6.11 12.95a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0m3.596-3.32a.75.75 0 0 0-1.37.365l-.492 6.861a.75.75 0 0 0 1.204.65l1.043-.799.985 3.678a.75.75 0 0 0 1.45-.388l-.978-3.646 1.292.204a.75.75 0 0 0 .74-1.16z" />
                  </svg>
                }
              />
              <MetricWithTooltip
                color="#A855F7"
                value={site.gscConfigured ? formatNumber(site.impressions) : '—'}
                label=""
                tooltip={site.gscConfigured ? `${formatNumber(site.impressions)} impressions · ${dateLabel}` : 'No data'}
                icon={
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
                    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" />
                    <path fillRule="evenodd" d="M.664 10.59a1.65 1.65 0 0 1 0-1.186A10 10 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10 10 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41M14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0" clipRule="evenodd" />
                  </svg>
                }
              />
              <MetricWithTooltip
                color="#EF4444"
                value={site.gscConfigured && site.position > 0 ? site.position.toFixed(1) : '—'}
                label=""
                tooltip={site.gscConfigured && site.position > 0 ? `Avg position ${site.position.toFixed(1)} · ${dateLabel}` : 'No data'}
                icon={
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
                    <path fillRule="evenodd" d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.202-.257.59-.218.793.039q.418.53.943.954c.332.269.786-.049.773-.476L7 7c0-.919.206-1.789.575-2.567a6.03 6.03 0 0 1 2.486-2.665c.247-.14.55-.016.677.238A6.97 6.97 0 0 0 13.5 4.938M14 12a4 4 0 0 1-4 4c-1.913 0-3.52-1.398-3.91-3.182-.093-.429.44-.643.814-.413a4 4 0 0 0 1.601.564c.303.038.531-.24.51-.544a5.98 5.98 0 0 1 1.315-4.192.45.45 0 0 1 .431-.16A4 4 0 0 1 14 12" clipRule="evenodd" />
                  </svg>
                }
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {site.gscConfigured && lastEdited && (
                <span style={{ fontSize: 12, lineHeight: '16px', color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
                  Edited {lastEdited}
                </span>
              )}
              {site.gscConfigured ? (
                <div style={{ width: 32, height: 32, borderRadius: 999, background: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#18181B', flexShrink: 0, overflow: 'hidden', fontFamily: 'var(--font-family-primary)' }}>
                  {accountPicture ? (
                    <img alt="" src={accountPicture} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <span>{accountInitial}</span>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleConfigure(site); }}
                >
                  Configure
                </Button>
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
            <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <CompactSelect
                size="sm"
                value={sortBy}
                onChange={(opt) => setSortBy(opt.value as 'az' | 'clicks' | 'impressions')}
                options={[
                  { value: 'az', label: sortLabel.az },
                  { value: 'clicks', label: sortLabel.clicks },
                  { value: 'impressions', label: sortLabel.impressions },
                ]}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={(
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path d="M17 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0zm0 13a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0zM3.75 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75M4.5 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0zM10 11a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5A.75.75 0 0 1 10 11m.75-8.25a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0zM10 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-6.25 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4m12.5 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4" />
                  </svg>
                )}
              >
                Filters
              </Button>
            </div>
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search" width={200} />
          </div>

          {/* ─── Content ─── */}
          {isLoading ? (
            <div className="md:grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 24 }}>
                  <SkeletonRows count={4} />
                </div>
              ))}
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
              {configured.length > 0 && (
                <div>
                  <h3 style={{ margin: 0 }}>
                    <Button
                      type="button"
                      variant="transparent"
                      size="sm"
                      onClick={() => setConfiguredOpen(!configuredOpen)}
                      style={{ padding: 0, minHeight: 'auto', height: 'auto', color: '#52525C', fontWeight: 600, fontSize: 16, marginBottom: configuredOpen ? 24 : 0 }}
                    >
                      Connected
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        aria-hidden="true"
                        style={{ flexShrink: 0, transition: 'transform 0.2s', transform: configuredOpen ? 'rotate(180deg)' : undefined }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </Button>
                  </h3>
                  {configuredOpen && (
                    <div className="md:grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                      {configured.map(renderCard)}
                    </div>
                  )}
                </div>
              )}

              {toConfigure.length > 0 && (
                <div>
                  <h3 style={{ margin: 0 }}>
                    <Button
                      type="button"
                      variant="transparent"
                      size="sm"
                      onClick={() => setToConfigureOpen(!toConfigureOpen)}
                      style={{ padding: 0, minHeight: 'auto', height: 'auto', color: '#52525C', fontWeight: 600, fontSize: 16, marginBottom: toConfigureOpen ? 24 : 0 }}
                    >
                      To configure
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        aria-hidden="true"
                        style={{ flexShrink: 0, transition: 'transform 0.2s', transform: toConfigureOpen ? 'rotate(180deg)' : undefined }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </Button>
                  </h3>
                  {toConfigureOpen && (
                    <div className="md:grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                      {toConfigure.map(renderCard)}
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
