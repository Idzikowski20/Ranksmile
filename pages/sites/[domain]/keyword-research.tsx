import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import KeywordResearchPanel from '../../../components/keywords/KeywordResearchPanel';
import { useFetchDomains } from '../../../services/domains';
import { useFetchSettings } from '../../../services/settings';
import { slugToDomain } from '../../../utils/slugToDomain';

const KeywordResearchPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';

   const { data: domainsData, isLoading: domainsLoading } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d: any) => d.slug === slug);

   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); }, []);

   const { data: appSettings } = useFetchSettings();
   // Defer adwordsConnected check until client mount to avoid hydration mismatch.
   // useFetchSettings() returns undefined during SSR → adwordsConnected would be false
   // on the server but true on the client, producing different DOM trees.
   const adwordsConnected = mounted && !!(appSettings?.adwords_refresh_token
      && appSettings?.adwords_developer_token
      && appSettings?.adwords_account_id);

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>Keyword Research — {domain} — SerpBear</title></Head>

         <DomainSubLayout domain={domain} slug={slug || ''} section="Keyword Research" contentMaxWidth="100%">
            <KeywordResearchPanel
               domain={activeDomain || null}
               slug={slug || ''}
               isAdwordsConnected={adwordsConnected}
            />
         </DomainSubLayout>
      </AppShell>
   );
};

export default KeywordResearchPage;
