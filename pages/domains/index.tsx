import React, { useEffect, useMemo, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { CSSTransition } from 'react-transition-group';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/common/DashboardLayout';
import AddDomain from '../../components/domains/AddDomain';
import Settings from '../../components/settings/Settings';
import { Button } from '../../components/koala/core';
import { KoalaPage, KoalaPageHeader, KoalaPanel, KoalaEmptyState } from '../../components/koala/layout';
import { useCheckMigrationStatus, useFetchSettings } from '../../services/settings';
import { useFetchDomains } from '../../services/domains';
import DomainItem from '../../components/domains/DomainItem';
import Icon from '../../components/common/Icon';
import Footer from '../../components/common/Footer';

type thumbImages = { [domain:string] : string }

const Domains: NextPage = () => {
   const router = useRouter();
   const [showSettings, setShowSettings] = useState(false);
   const [showAddDomain, setShowAddDomain] = useState(false);
   const [domainThumbs, setDomainThumbs] = useState<thumbImages>({});
   const { data: appSettingsData, isLoading: isAppSettingsLoading } = useFetchSettings();
   const { data: domainsData, isLoading } = useFetchDomains(router, true);
   const { data: migrationStatus } = useCheckMigrationStatus();

   const appSettings:SettingsType = appSettingsData?.settings || {};
   const { scraper_type = '' } = appSettings;

   const totalKeywords = useMemo(() => {
      let keywords = 0;
      if (domainsData?.domains) {
         domainsData.domains.forEach(async (domain:DomainType) => {
            keywords += domain?.keywordCount || 0;
         });
      }
      return keywords;
   }, [domainsData]);

   const domainSCAPiObj = useMemo(() => {
      const domainsSCAPI:{ [ID:string] : boolean } = {};
      if (domainsData?.domains) {
         domainsData.domains.forEach(async (domain:DomainType) => {
            const domainSc = domain?.search_console ? JSON.parse(domain.search_console) : {};
            domainsSCAPI[domain.ID] = domainSc.client_email && domainSc.private_key;
         });
      }
      return domainsSCAPI;
   }, [domainsData]);

   // Pre-populate thumbs — v=3 bust cache starej wersji API
   useEffect(() => {
      if (domainsData?.domains) {
         setDomainThumbs((current) => {
            const updated: thumbImages = { ...current };
            domainsData.domains.forEach((domain: DomainType) => {
               if (!updated[domain.domain]) {
                  updated[domain.domain] = `/api/favicon?v=3&domain=${encodeURIComponent(domain.domain)}`;
               }
            });
            return updated;
         });
      }
   }, [domainsData]);

   // Favikony są teraz ładowane bezpośrednio przez server-side proxy /api/favicon
   // Nie potrzebujemy screenshot_key ani localStorage
   const manuallyUpdateThumb = async (domain: string) => {
      // Wymuszamy reload przez dodanie timestamp do URL (browser pominie cache)
      setDomainThumbs((currentThumbs) => ({
         ...currentThumbs,
         [domain]: `/api/favicon?domain=${encodeURIComponent(domain)}&t=${Date.now()}`,
      }));
      toast(`${domain} favicon reloaded!`, { icon: '✔️' });
   };

   return (
      <DashboardLayout
         domains={domainsData?.domains || []}
         showAddModal={() => setShowAddDomain(true)}
         showSettings={() => setShowSettings(true)}
      >
         {((!scraper_type || (scraper_type === 'none')) && !isAppSettingsLoading) && (
               <div className=' p-3 bg-red-600 text-white text-sm text-center'>
                  A Scrapper/Proxy has not been set up Yet. Open Settings to set it up and start using the app.
               </div>
         )}
         {migrationStatus?.hasMigrations && (
               <div className=' p-3 bg-black text-white text-sm text-center'>
                  You need to Update your database. Stop Ranksmile and run this command to update your database:
                  <code className=' bg-gray-700 px-2 py-0 ml-1'>npm run db:migrate</code>
               </div>
         )}
         <Head>
            <title>Domains - Ranksmile</title>
         </Head>
         <KoalaPage maxWidth={880}>
            <KoalaPageHeader
               title="Domains"
               subtitle={`${domainsData?.domains?.length || 0} domains · ${totalKeywords} keywords`}
               borderless
               actions={(
                  <Button type="button" variant="primary" data-testid="addDomainButton" onClick={() => setShowAddDomain(true)}>
                     Add domain
                  </Button>
               )}
            />
            <KoalaPanel noPadding>
               {domainsData?.domains && domainsData.domains.map((domain:DomainType) => (
                  <DomainItem
                     key={domain.ID}
                     domain={domain}
                     selected={false}
                     isConsoleIntegrated={!!(appSettings && appSettings.search_console_integrated) || !!domainSCAPiObj[domain.ID] }
                     thumb={domainThumbs[domain.domain]}
                     updateThumb={manuallyUpdateThumb}
                  />
               ))}
               {isLoading && (
                  <div style={{ padding: '48px 24px', textAlign: 'center', fontSize: 14, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                     <Icon type="loading" /> Loading domains…
                  </div>
               )}
               {!isLoading && domainsData && domainsData.domains && domainsData.domains.length === 0 && (
                  <KoalaEmptyState
                     title="No domains yet"
                     description="Add a domain to start tracking keywords and content."
                     actions={(
                        <Button type="button" variant="primary" onClick={() => setShowAddDomain(true)}>
                           Add domain
                        </Button>
                     )}
                  />
               )}
            </KoalaPanel>
         </KoalaPage>

         <CSSTransition in={showAddDomain} timeout={300} classNames="modal_anim" unmountOnExit mountOnEnter>
            <AddDomain closeModal={() => setShowAddDomain(false)} domains={domainsData?.domains || []} />
         </CSSTransition>
         <CSSTransition in={showSettings} timeout={300} classNames="settings_anim" unmountOnExit mountOnEnter>
             <Settings closeSettings={() => setShowSettings(false)} />
         </CSSTransition>
         <Footer currentVersion={appSettings?.version ? appSettings.version : ''} />
      </DashboardLayout>
   );
};

export default Domains;
