import React, { useEffect, useMemo, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { CSSTransition } from 'react-transition-group';
import toast, { Toaster } from 'react-hot-toast';
import DashboardLayout from '../../components/common/DashboardLayout';
import AddDomain from '../../components/domains/AddDomain';
import Settings from '../../components/settings/Settings';
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
                  You need to Update your database. Stop Serpbear and run this command to update your database:
                  <code className=' bg-gray-700 px-2 py-0 ml-1'>npm run db:migrate</code>
               </div>
         )}
         <Head>
            <title>Domains - SerpBear</title>
         </Head>
         <div className="flex flex-col w-full max-w-5xl mx-auto p-6 lg:p-8 lg:pt-8">
            <div className='flex justify-between mb-2 items-center'>
               <div className=' text-sm text-gray-600'>
                  {domainsData?.domains?.length || 0} Domains <span className=' text-gray-300 ml-1 mr-1'>|</span> {totalKeywords} keywords
               </div>
               <div>
                  <button
                  data-testid="addDomainButton"
                  className={'ml-2 inline-block py-2 text-blue-700 font-bold text-sm'}
                  onClick={() => setShowAddDomain(true)}>
                     <span
                     className='text-center leading-4 mr-2 inline-block rounded-full w-7 h-7 pt-1 bg-blue-700 text-white font-bold text-lg'>+</span>
                     <i className=' not-italic hidden lg:inline-block'>Add Domain</i>
                  </button>
               </div>
            </div>
            <div className='flex w-full flex-col mb-8'>
               {domainsData?.domains && domainsData.domains.map((domain:DomainType) => {
                  return <DomainItem
                           key={domain.ID}
                           domain={domain}
                           selected={false}
                           isConsoleIntegrated={!!(appSettings && appSettings.search_console_integrated) || !!domainSCAPiObj[domain.ID] }
                           thumb={domainThumbs[domain.domain]}
                           updateThumb={manuallyUpdateThumb}
                           // isConsoleIntegrated={false}
                           />;
               })}
               {isLoading && (
                  <div className='noDomains mt-4 p-5 py-12 rounded border text-center bg-white text-sm'>
                     <Icon type="loading" /> Loading Domains...
                  </div>
               )}
               {!isLoading && domainsData && domainsData.domains && domainsData.domains.length === 0 && (
                  <div className='noDomains mt-4 p-5 py-12 rounded border text-center bg-white text-sm'>
                     No Domains Found. Add a Domain to get started!
                  </div>
               )}
            </div>
         </div>

         <CSSTransition in={showAddDomain} timeout={300} classNames="modal_anim" unmountOnExit mountOnEnter>
            <AddDomain closeModal={() => setShowAddDomain(false)} domains={domainsData?.domains || []} />
         </CSSTransition>
         <CSSTransition in={showSettings} timeout={300} classNames="settings_anim" unmountOnExit mountOnEnter>
             <Settings closeSettings={() => setShowSettings(false)} />
         </CSSTransition>
         <Footer currentVersion={appSettings?.version ? appSettings.version : ''} />
         <Toaster position='bottom-center' containerClassName="react_toaster" />
      </DashboardLayout>
   );
};

export default Domains;
