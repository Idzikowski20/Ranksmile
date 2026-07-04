import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import EmptyEyes from '../../../components/common/EmptyEyes';
import { Skeleton } from '../../../components/ui';
import CreateAuditModal from '../../../components/audit/CreateAuditModal';
import AuditCard from '../../../components/audit/AuditCard';
import { useAuditList, useAuditStatus, useCreateAudit, useRunAudits } from '../../../services/auditTool';
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

   const onCreate = (url: string, keywords: string[]) => {
      createM.mutate({ url, keywords }, {
         onSuccess: () => { setModalOpen(false); lastKick.current = 0; runM.mutate(); },
      });
   };

   const items = listQ.data?.items || [];
   const loading = listQ.isLoading;

   const actions = (
      <button
         type="button"
         onClick={() => setModalOpen(true)}
         style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: '#2F2F34', color: '#fff', borderRadius: 6, padding: '7px 16px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', transition: 'background 150ms ease' }}
         onMouseEnter={(e) => { e.currentTarget.style.background = '#783AFB'; }}
         onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
      >
         <PlusIcon /> Create new Audit
      </button>
   );

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>{`Audit — ${domain}`}</title></Head>
         <style>{'@keyframes spin{to{transform:rotate(360deg)}}@keyframes auditBarPulse{0%,100%{opacity:.55}50%{opacity:1}}'}</style>
         <DomainSubLayout domain={domain} slug={slug || ''} section="Audit" contentMaxWidth="100%">
            <div style={{ maxWidth: 880, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
               <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#09090B', fontFamily: FONT }}>Audit</h1>
               {actions}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
               {loading && <Skeleton />}

               {!loading && items.length === 0 && (
                  <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, background: '#fff', padding: '56px 24px', textAlign: 'center' }}>
                     <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><EmptyEyes /></div>
                     <div style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>No audits yet</div>
                     <div style={{ fontSize: 13, color: '#71717B', fontFamily: FONT, marginTop: 4 }}>Create your first audit — enter a URL and the keywords to check.</div>
                  </div>
               )}

               {!loading && items.map((it) => <AuditCard key={it.id} item={it} onOpen={openDetail} />)}
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
