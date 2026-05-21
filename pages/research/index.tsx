import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { CSSTransition } from 'react-transition-group';
import Icon from '../../components/common/Icon';
import DashboardLayout from '../../components/common/DashboardLayout';
import KeywordIdeasTable from '../../components/ideas/KeywordIdeasTable';
import { exportKeywordIdeas } from '../../utils/client/exportcsv';
import { useFetchKeywordIdeas, useMutateKeywordIdeas } from '../../services/adwords';
import { useFetchSettings } from '../../services/settings';
import Settings from '../../components/settings/Settings';
import SelectField from '../../components/common/SelectField';
import allCountries, { adwordsLanguages } from '../../utils/countries';
import AddDomain from '../../components/domains/AddDomain';
import { useFetchDomains } from '../../services/domains';

const Research: NextPage = () => {
   const router = useRouter();
   const [showSettings, setShowSettings] = useState(false);
   const [showFavorites, setShowFavorites] = useState(false);
   const [showAddDomain, setShowAddDomain] = useState(false);
   const [language, setLanguage] = useState('1000');
   const [country, setCountry] = useState('US');
   const [seedKeywords, setSeedKeywords] = useState('');

   const { data: appSettings } = useFetchSettings();
   const { data: domainsData } = useFetchDomains(router);
   const domains = domainsData?.domains || [];

   const adwordsConnected = !!(appSettings && appSettings?.settings?.adwords_refresh_token
      && appSettings?.settings?.adwords_developer_token, appSettings?.settings?.adwords_account_id);
   const { data: keywordIdeasData, isLoading: isLoadingIdeas, isError: errorLoadingIdeas } = useFetchKeywordIdeas(router, adwordsConnected);
   const { mutate: updateKeywordIdeas, isLoading: isUpdatingIdeas } = useMutateKeywordIdeas(router);

   const keywordIdeas: IdeaKeyword[] = keywordIdeasData?.data?.keywords || [];
   const favorites: IdeaKeyword[] = keywordIdeasData?.data?.favorites || [];
   const keywordIdeasSettings = keywordIdeasData?.data?.settings || undefined;
   const { country: previousCountry, language: previousLang, keywords: previousSeedKeywords } = keywordIdeasSettings || {};

   useEffect(() => {
      if (previousCountry) { setCountry(previousCountry); }
      if (previousLang) { setLanguage(previousLang.toString()); }
      if (previousSeedKeywords) { setSeedKeywords(previousSeedKeywords.join(',')); }
   }, [previousCountry, previousLang, previousSeedKeywords]);

   const reloadKeywordIdeas = () => {
      const keywordPayload = seedKeywords ? seedKeywords.split(',').map((key) => key.trim()) : undefined;
      updateKeywordIdeas({ seedType: 'custom', language, domain: 'research', keywords: keywordPayload, country });
   };

   const countryOptions = useMemo(() => {
      return Object.keys(allCountries)
         .filter((countryISO) => allCountries[countryISO][3] !== 0)
         .map((countryISO) => ({ label: allCountries[countryISO][0], value: countryISO }));
   }, []);

   const languageOptions = useMemo(() => Object.entries(adwordsLanguages).map(([value, label]) => ({ label, value })), []);

   return (
      <DashboardLayout
         domains={domains}
         showAddModal={() => setShowAddDomain(true)}
         showSettings={() => setShowSettings(true)}
      >
         <Head>
            <title>Research — SerpBear</title>
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
                  gap: 16,
                  paddingBottom: 32,
               }}
            >
               {/* ─── Header ─── */}
               <div
                  style={{
                     display: 'flex',
                     flexDirection: 'column',
                     gap: 24,
                     paddingTop: 24,
                     paddingBottom: 8,
                  }}
               >
                  {/* Title row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <span
                        style={{
                           fontSize: 20,
                           lineHeight: '28px',
                           fontWeight: 600,
                           color: '#2F2F34',
                           fontFamily: 'var(--font-family-primary)',
                        }}
                     >
                        Research
                     </span>

                     <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Export button */}
                        <button
                           type="button"
                           onClick={() => exportKeywordIdeas(showFavorites ? favorites : keywordIdeas, 'research')}
                           disabled={keywordIdeas.length === 0}
                           style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 16px',
                              borderRadius: 6,
                              border: 'none',
                              background: '#F4F4F5',
                              fontSize: 14,
                              lineHeight: '20px',
                              fontWeight: 600,
                              color: keywordIdeas.length === 0 ? '#9F9FA9' : '#2F2F34',
                              cursor: keywordIdeas.length === 0 ? 'not-allowed' : 'pointer',
                              fontFamily: 'var(--font-family-primary)',
                              transition: 'background 0.15s',
                              opacity: keywordIdeas.length === 0 ? 0.5 : 1,
                           }}
                           onMouseEnter={(e) => {
                              if (keywordIdeas.length > 0) (e.currentTarget as HTMLButtonElement).style.background = '#E4E4E7';
                           }}
                           onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5';
                           }}
                        >
                           <svg viewBox="0 0 24 24" width="16" height="16" style={{ flexShrink: 0 }}>
                              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                           </svg>
                           Export CSV
                        </button>

                        {/* Load Ideas button */}
                        <button
                           type="button"
                           onClick={() => !isUpdatingIdeas && adwordsConnected && reloadKeywordIdeas()}
                           disabled={!adwordsConnected}
                           title={!adwordsConnected ? 'Connect Google Ads to generate keyword ideas' : ''}
                           style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 16px',
                              borderRadius: 6,
                              border: 'none',
                              background: !adwordsConnected ? '#F4F4F5' : '#2F2F34',
                              fontSize: 14,
                              lineHeight: '20px',
                              fontWeight: 600,
                              color: !adwordsConnected ? '#9F9FA9' : '#fff',
                              cursor: !adwordsConnected ? 'not-allowed' : 'pointer',
                              fontFamily: 'var(--font-family-primary)',
                              transition: 'background 0.15s',
                              opacity: !adwordsConnected ? 0.6 : 1,
                           }}
                           onMouseEnter={(e) => {
                              if (adwordsConnected) (e.currentTarget as HTMLButtonElement).style.background = '#783AFB';
                           }}
                           onMouseLeave={(e) => {
                              if (adwordsConnected) (e.currentTarget as HTMLButtonElement).style.background = '#2F2F34';
                           }}
                        >
                           {isUpdatingIdeas ? (
                              <Icon type="loading" size={16} />
                           ) : (
                              <svg viewBox="0 0 24 24" width="16" height="16" style={{ flexShrink: 0 }}>
                                 <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
                              </svg>
                           )}
                           {isUpdatingIdeas ? 'Loading...' : 'Load Ideas'}
                        </button>
                     </div>
                  </div>

                  {/* ─── Filters row ─── */}
                  <div
                     style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: 12,
                        padding: '16px',
                        background: '#FAFAFA',
                        border: '1px solid #F4F4F5',
                        borderRadius: 10,
                     }}
                  >
                     {/* Seed Keywords */}
                     <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label
                           style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#52525C',
                              fontFamily: 'var(--font-family-primary)',
                              letterSpacing: '0.02em',
                           }}
                        >
                           Seed Keywords
                        </label>
                        <input
                           type="text"
                           value={seedKeywords}
                           onChange={(e) => setSeedKeywords(e.target.value)}
                           onKeyDown={(e) => {
                              if (e.key === 'Enter' && adwordsConnected && !isUpdatingIdeas) reloadKeywordIdeas();
                           }}
                           placeholder="keyword1, keyword2..."
                           style={{
                              width: '100%',
                              height: 34,
                              padding: '0 12px',
                              border: '1px solid #D4D4D8',
                              borderRadius: 6,
                              fontSize: 13,
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

                     {/* Country */}
                     <div style={{ width: 180, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label
                           style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#52525C',
                              fontFamily: 'var(--font-family-primary)',
                              letterSpacing: '0.02em',
                           }}
                        >
                           Country
                        </label>
                        <SelectField
                           selected={[country]}
                           options={countryOptions}
                           defaultLabel="All Countries"
                           updateField={(updated: string[]) => setCountry(updated[0])}
                           flags={true}
                           multiple={false}
                           fullWidth={true}
                           maxHeight={48}
                           rounded="rounded"
                        />
                     </div>

                     {/* Language */}
                     <div style={{ width: 160, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label
                           style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#52525C',
                              fontFamily: 'var(--font-family-primary)',
                              letterSpacing: '0.02em',
                           }}
                        >
                           Language
                        </label>
                        <SelectField
                           selected={[language]}
                           options={languageOptions}
                           defaultLabel="All Languages"
                           updateField={(updated: string[]) => setLanguage(updated[0])}
                           rounded="rounded"
                           multiple={false}
                           fullWidth={true}
                           maxHeight={48}
                        />
                     </div>
                  </div>
               </div>

               {/* ─── Keyword Ideas Table ─── */}
               <KeywordIdeasTable
                  isLoading={isLoadingIdeas}
                  noIdeasDatabase={errorLoadingIdeas}
                  domain={null}
                  keywords={keywordIdeas}
                  favorites={favorites}
                  isAdwordsIntegrated={adwordsConnected}
                  showFavorites={showFavorites}
                  setShowFavorites={setShowFavorites}
               />
            </div>
         </div>

         {showAddDomain && (
            <AddDomain
               domains={domains}
               closeModal={() => setShowAddDomain(false)}
            />
         )}

         <CSSTransition in={showSettings} timeout={300} classNames="settings_anim" unmountOnExit mountOnEnter>
            <Settings closeSettings={() => setShowSettings(false)} />
         </CSSTransition>
      </DashboardLayout>
   );
};

export default Research;
