import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React from 'react';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import EmptyEyes from '../../../components/common/EmptyEyes';
import { useFetchDomains } from '../../../services/domains';
import { slugToDomain } from '../../../utils/slugToDomain';

const FONT = 'var(--font-family-primary)';

const AiHumanizerPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>{`AI Humanizer — ${domain} — SerpBear`}</title></Head>

         <DomainSubLayout domain={domain} slug={slug || ''} section="AI Humanizer" heading="AI Humanizer" contentMaxWidth="100%">
            <div style={{ border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, background: '#fff', padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', fontFamily: FONT }}>
               <EmptyEyes size={48} />
               <div style={{ fontSize: 16, fontWeight: 600, color: '#18181B' }}>AI Humanizer coming soon</div>
               <p style={{ maxWidth: 380, fontSize: 14, lineHeight: 1.5, color: '#52525C', margin: 0 }}>
                  Rewrite AI-generated drafts into natural, human-sounding copy that reads authentically. This tool is on its way.
               </p>
            </div>
         </DomainSubLayout>
      </AppShell>
   );
};

export default AiHumanizerPage;
