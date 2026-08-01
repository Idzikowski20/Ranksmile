import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import EmptyEyes from '../../../components/common/EmptyEyes';
import CreateAuditModal from '../../../components/audit/CreateAuditModal';
import AuditCard from '../../../components/audit/AuditCard';
import { Button } from '../../../components/core';
import { useAuditList, useAuditStatus, useCreateAudit, useRunAudits, useDeleteAudit } from '../../../services/auditTool';
import { useFetchDomains } from '../../../services/domains';
import { slugToDomain } from '../../../utils/slugToDomain';

const FONT = 'var(--font-family-primary)';

const PlusIcon = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);

const AuditToolPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';
   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];

   const [modalOpen, setModalOpen] = useState(false);

   const listQ = useAuditList(slug);
   const statusQ = useAuditStatus(slug);
   const createM = useCreateAudit(slug);
   const runM = useRunAudits(slug);
   const deleteM = useDeleteAudit(slug);

   // Client-driven worker: while any audit is queued/running, keep POSTing /run
   // (each is its own serverless invocation). Debounced so we don't stack calls.
   const lastKick = useRef(0);
   const inFlight = statusQ.data ? statusQ.data.queued + statusQ.data.running : 0;
   useEffect(() => {
      if (inFlight <= 0 || runM.isLoading) return;
      const now = Date.now();
      if (now - lastKick.current < 2500) return;
      lastKick.current = now;
      runM.mutate();
   }, [inFlight, runM]);

   const openDetail = (id: number) => { router.push(`/sites/${slug}/audit-tool/${id}`); };

   const onCreate = (url: string, keywords: string[], country: string) => {
      createM.mutate({ url, keywords, country }, {
         onSuccess: () => { setModalOpen(false); lastKick.current = 0; runM.mutate(); },
      });
   };

   const items = listQ.data?.items || [];
   const loading = listQ.isLoading;

   const actions = (
      <Button type="button" variant="primary" size="sm" icon={<PlusIcon />} onClick={() => setModalOpen(true)}>
         Create new Audit
      </Button>
   );

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>{`Audit URL — ${domain}`}</title></Head>
         <style>{'@keyframes spin{to{transform:rotate(360deg)}}@keyframes auditBarPulse{0%,100%{opacity:.55}50%{opacity:1}}'}</style>
         <DomainSubLayout
            domain={domain}
            slug={slug || ''}
            section="Site Audit"
            heading="Audit URL"
            subtitle="Analyze one specific page"
            contentMaxWidth="100%"
         >
            <div style={{ width: '100%', maxWidth: 880, margin: '0 auto' }}>
            <div className="audit-url-list-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
               <div style={{ fontSize: 13, color: '#6A6772', fontFamily: FONT }}>One-off URL audits</div>
               {actions}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
               {loading && Array.from({ length: 4 }).map((_, i) => (
                  <div key={`audit-skel-${i}`} style={{ height: 133, display: 'flex', alignItems: 'center', border: '1px solid #E4E4E7', borderRadius: 12, gap: 12, animation: 'skeletonPulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.08}s` }}>
                     <div style={{ width: 84, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 24 }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F0F0F4' }} />
                     </div>
                     <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ width: '45%', height: 16, borderRadius: 6, background: '#F0F0F4' }} />
                        <div style={{ width: '28%', height: 12, borderRadius: 6, background: '#F5F5F9' }} />
                     </div>
                     <div style={{ paddingRight: 24, display: 'flex', gap: 16, flexShrink: 0 }}>
                        <div style={{ width: 60, height: 12, borderRadius: 6, background: '#F5F5F9' }} />
                        <div style={{ width: 40, height: 12, borderRadius: 6, background: '#F5F5F9' }} />
                     </div>
                  </div>
               ))}

               {!loading && items.length === 0 && (
                  <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, background: '#fff', padding: '56px 24px', textAlign: 'center' }}>
                     <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><EmptyEyes /></div>
                     <div style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>No audits yet</div>
                     <div style={{ fontSize: 13, color: '#71717B', fontFamily: FONT, marginTop: 4 }}>Create your first audit — enter a URL and the keywords to check.</div>
                  </div>
               )}

               {!loading && items.map((it) => <AuditCard key={it.id} item={it} onOpen={openDetail} onDelete={(id) => deleteM.mutate({ id })} />)}

               {!loading && items.length > 0 && (
                  <div style={{ textAlign: 'center', color: '#71717B', fontSize: 14, fontFamily: FONT, padding: '24px 0' }}>No more results found.</div>
               )}
            </div>
            </div>
         </DomainSubLayout>

         {modalOpen && (
            <CreateAuditModal
               onClose={() => setModalOpen(false)}
               onCreate={onCreate}
               submitting={createM.isLoading}
            />
         )}
      </AppShell>
   );
};

export default AuditToolPage;
