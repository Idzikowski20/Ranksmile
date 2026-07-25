import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import SearchIntelligenceTabs from '../../../components/searchIntelligence/SearchIntelligenceTabs';
import KeywordTrackerPanel from '../../../components/keywords/KeywordTrackerPanel';
import { useFetchDomains } from '../../../services/domains';
import { useFetchSettings } from '../../../services/settings';
import { slugToDomain } from '../../../utils/slugToDomain';

const KeywordTrackerPage: NextPage = () => {
  const router = useRouter();
  const slug = typeof router.query.domain === 'string' ? router.query.domain : '';
  const domain = slug ? slugToDomain(slug) : '';

  const { data: domainsData } = useFetchDomains(router, true);
  const domains = domainsData?.domains || [];
  const activeDomain = domains.find(
    (d: DomainType) => d.slug === slug || d.domain === domain,
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { data: appSettings } = useFetchSettings();

  const scConfig = useMemo(() => {
    const raw = activeDomain?.search_console;
    if (!raw) return null;
    if (typeof raw === 'object') return raw as Record<string, unknown>;
    try { return JSON.parse(String(raw)) as Record<string, unknown>; } catch { return null; }
  }, [activeDomain?.search_console]);

  const scConnected = mounted && !!(
    appSettings?.search_console_integrated
    || (scConfig && (
      (scConfig.client_email && scConfig.private_key)
      || (scConfig.auth_type === 'oauth' && scConfig.oauth_refresh_token)
    ))
  );

  const { scraper_type = '', available_scrapers = [] } = appSettings?.settings || {};
  const activeScraper = available_scrapers.find(
    (s: { value?: string; label?: string; allowsCity?: boolean }) => s.value === scraper_type,
  );

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head><title>{`Rank Tracking — ${domain} — Ranksmile`}</title></Head>

      <DomainSubLayout
        domain={domain}
        slug={slug || ''}
        section="Search Intelligence"
        heading="Rank Tracking"
        contentMaxWidth="100%"
        filters={slug ? <SearchIntelligenceTabs slug={slug} active="rank-tracking" /> : undefined}
      >
        <KeywordTrackerPanel
          domain={activeDomain || null}
          isConsoleConnected={scConnected}
          router={router}
          scraperName={activeScraper?.label || ''}
          allowsCity={!!activeScraper?.allowsCity}
        />
      </DomainSubLayout>
    </AppShell>
  );
};

export default KeywordTrackerPage;
