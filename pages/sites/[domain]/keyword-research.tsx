import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import EmptyEyes from '../../../components/common/EmptyEyes';
import CreateTopicResearchModal from '../../../components/topicResearch/CreateTopicResearchModal';
import TopicResearchCard from '../../../components/topicResearch/TopicResearchCard';
import { Button } from '../../../components/koala/core';
import {
   useKeywordResearchList, useKeywordResearchStatus, useCreateKeywordResearch, useRunKeywordResearch, useDeleteKeywordResearch,
} from '../../../services/keywordResearch';
import { useFetchDomains } from '../../../services/domains';
import { slugToDomain } from '../../../utils/slugToDomain';

const FONT = 'var(--font-family-primary)';

const PlusIcon = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);

const KeywordResearchPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';
   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];

   const [modalOpen, setModalOpen] = useState(false);

   const listQ = useKeywordResearchList(slug);
   const statusQ = useKeywordResearchStatus(slug);
   const createM = useCreateKeywordResearch(slug);
   const runM = useRunKeywordResearch(slug);
   const deleteM = useDeleteKeywordResearch(slug);

   const lastKick = useRef(0);
   const inFlight = statusQ.data ? statusQ.data.queued + statusQ.data.running : 0;
   useEffect(() => {
      if (inFlight <= 0 || runM.isLoading) return;
      const now = Date.now();
      if (now - lastKick.current < 2500) return;
      lastKick.current = now;
      runM.mutate();
   }, [inFlight, runM]);

   const openDetail = (id: number) => { router.push(`/sites/${slug}/keyword-research/${id}`); };

   const onCreate = (seed: string, country: string) => {
      createM.mutate({ seed, country }, {
         onSuccess: () => { setModalOpen(false); lastKick.current = 0; runM.mutate(); },
      });
   };

   const items = listQ.data?.items || [];
   const loading = listQ.isLoading;

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>{`Keyword Research — ${domain}`}</title></Head>
         <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
         <DomainSubLayout domain={domain} slug={slug || ''} section="Keyword Research" contentMaxWidth="100%">
            <div style={{ width: '100%', maxWidth: 880, margin: '0 auto' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
                  <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#09090B', fontFamily: FONT }}>Keyword Research</h1>
                  <Button type="button" variant="primary" size="sm" icon={<PlusIcon />} onClick={() => setModalOpen(true)}>
                     New research
                  </Button>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {loading && Array.from({ length: 4 }).map((_, i) => (
                     <div key={`kr-skel-${i}`} style={{ height: 96, border: '1px solid #E4E4E7', borderRadius: 12, background: '#f3f4f0', animation: 'skeletonPulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
                  ))}

                  {!loading && items.length === 0 && (
                     <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, background: '#fff', padding: '56px 24px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><EmptyEyes /></div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>No keyword research yet</div>
                        <div style={{ fontSize: 13, color: '#71717B', fontFamily: FONT, marginTop: 4 }}>Enter a seed keyword to discover clusters and keyword ideas.</div>
                     </div>
                  )}

                  {!loading && items.map((it) => (
                     <TopicResearchCard key={it.id} item={it} onOpen={openDetail} onDelete={(id) => deleteM.mutate({ id })} />
                  ))}

                  {!loading && items.length > 0 && (
                     <div style={{ textAlign: 'center', color: '#71717B', fontSize: 14, fontFamily: FONT, padding: '24px 0' }}>No more results found.</div>
                  )}
               </div>
            </div>
         </DomainSubLayout>

         {modalOpen && (
            <CreateTopicResearchModal
               title="New Keyword Research"
               intro="Enter a seed keyword — we'll expand keywords, group them into clusters, and surface metrics."
               seedLabel="Keyword seed"
               seedHint="The main keyword you want to explore"
               onClose={() => setModalOpen(false)}
               onCreate={onCreate}
               submitting={createM.isLoading}
            />
         )}
      </AppShell>
   );
};

export default KeywordResearchPage;
