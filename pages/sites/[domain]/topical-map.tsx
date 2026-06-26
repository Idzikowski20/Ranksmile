import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React from 'react';
import { useQuery } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { useFetchDomains } from '../../../services/domains';
import { slugToDomain } from '../../../utils/slugToDomain';
import { Skeleton } from '../../../components/ui';
import { useSetupStatus } from '../../../services/domainPipeline';

const TopicalMapPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d: DomainType) => d.slug === slug);
   const activeDomainId: number | null = activeDomain?.ID ?? null;

   const { data: topicsData, isLoading: topicsLoading } = useQuery(
      ['domain-topics', activeDomainId],
      async () => {
         const r = await fetch(`/api/domains/${slug}/topics`);
         return r.json() as Promise<{ topics: Array<{ id: number; title: string; summary: string | null }> }>;
      },
      { enabled: !!activeDomainId, staleTime: 60_000 },
   );
   const { data: setupStatus } = useSetupStatus(slug);

   const isAnalyzing = setupStatus?.status === 'running' || setupStatus?.status === 'queued';
   const topics = topicsData?.topics ?? [];

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head>
            <title>{`Topical Map — ${domain} — SerpBear`}</title>
         </Head>

         <DomainSubLayout domain={domain} slug={slug || ''} section="Topical Map">
            {topicsLoading || (isAnalyzing && !topics.length) ? (
               <Skeleton />
            ) : topics.length === 0 ? (
               <div
                  style={{
                     display: 'flex',
                     flexDirection: 'column',
                     alignItems: 'center',
                     justifyContent: 'center',
                     padding: '80px 24px',
                     textAlign: 'center',
                     gap: 20,
                  }}
               >
                  {/* Icon */}
                  <div
                     style={{
                        width: 64,
                        height: 64,
                        borderRadius: 16,
                        background: '#F4F4F5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#52525C',
                     }}
                  >
                     <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.05493 11H5C6.10457 11 7 11.8954 7 13V14C7 15.1046 7.89543 16 9 16C10.1046 16 11 16.8954 11 18V20.9451M8 3.93552V5.5C8 6.88071 9.11929 8 10.5 8H11C12.1046 8 13 8.89543 13 10C13 11.1046 13.8954 12 15 12C16.1046 12 17 11.1046 17 10C17 8.89543 17.8954 8 19 8L20.0645 8M15 20.4879V18C15 16.8954 15.8954 16 17 16H20.0645M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" />
                     </svg>
                  </div>

                  <div>
                     <h2 style={{ fontSize: 20, fontWeight: 700, color: '#09090B', fontFamily: 'var(--font-family-primary)', margin: '0 0 8px' }}>
                        Topical Map
                     </h2>
                     <p style={{ fontSize: 14, color: '#71717B', maxWidth: 420, margin: '0 auto', lineHeight: 1.6, fontFamily: 'var(--font-family-primary)' }}>
                        Discover topic clusters and content gaps for <strong>{domain}</strong>. Build a comprehensive topical authority strategy by mapping out all the topics your site should cover.
                     </p>
                  </div>

                  <p style={{ fontSize: 12, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)', margin: 0 }}>
                     Topics will appear here once the domain analysis completes.
                  </p>
               </div>
            ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{
                     display: 'flex',
                     alignItems: 'center',
                     background: '#fff',
                     borderBottom: '1px solid #F4F4F5',
                     padding: '10px 20px',
                     borderRadius: '8px 8px 0 0',
                  }}>
                     <span style={{ fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                        {topics.length} topic cluster{topics.length !== 1 ? 's' : ''}
                     </span>
                  </div>
                  <div style={{ border: '1px solid #F4F4F5', borderTop: 'none', borderRadius: '0 0 8px 8px', background: '#fff' }}>
                     {topics.map((topic, i) => (
                        <div
                           key={topic.id}
                           style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 16,
                              padding: '16px 20px',
                              borderBottom: i < topics.length - 1 ? '1px solid #F4F4F5' : 'none',
                           }}
                        >
                           <div
                              style={{
                                 width: 8,
                                 height: 8,
                                 borderRadius: '50%',
                                 background: '#783AFB',
                                 marginTop: 6,
                                 flexShrink: 0,
                              }}
                           />
                           <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
                                 {topic.title}
                              </p>
                              {topic.summary && (
                                 <p style={{ margin: 0, fontSize: 12, color: '#52525C', fontFamily: 'var(--font-family-primary)', lineHeight: 1.6 }}>
                                    {topic.summary}
                                 </p>
                              )}
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}
         </DomainSubLayout>
      </AppShell>
   );
};

export default TopicalMapPage;
