import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import KeywordTrackerPanel from '../../../components/keywords/KeywordTrackerPanel';
import { useFetchDomains } from '../../../services/domains';
import { useFetchSettings } from '../../../services/settings';
import { slugToDomain } from '../../../utils/slugToDomain';

const KeywordTrackerPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d: any) =>
      d.slug === slug || d.domain === domain,
   );

   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); }, []);

   const { data: appSettings } = useFetchSettings();

   const scConfig = useMemo(() => {
      const raw = activeDomain?.search_console;
      if (!raw) return null;
      if (typeof raw === 'object') return raw;
      try { return JSON.parse(String(raw)); } catch { return null; }
   }, [activeDomain?.search_console]);

   const scConnected = mounted && !!(
      appSettings?.search_console_integrated
      || (scConfig && (
         (scConfig.client_email && scConfig.private_key)
         || (scConfig.auth_type === 'oauth' && scConfig.oauth_refresh_token)
      ))
   );

   const { scraper_type = '', available_scrapers = [] } = appSettings?.settings || {};
   const activeScraper = available_scrapers.find((s: any) => s.value === scraper_type);

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>Keyword Tracker — {domain} — SerpBear</title></Head>

         <DomainSubLayout domain={domain} slug={slug || ''} section="Keyword Tracker" contentMaxWidth="100%">
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
