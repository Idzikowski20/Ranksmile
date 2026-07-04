import type { NextPage } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import AppShell from '../../../../components/common/AppShell';
import DomainSubLayout from '../../../../components/domains/DomainSubLayout';
import CompetitorsModal from '../../../../components/competitors/CompetitorsModal';
import { useAuditRun, useRerunAudit, useRunAudits } from '../../../../services/auditTool';
import { useCompetitors, useScanCompetitors, useSelectCompetitors } from '../../../../services/competitors';
import { useFetchDomains } from '../../../../services/domains';
import { slugToDomain } from '../../../../utils/slugToDomain';
import { AuditFactor } from '../../../../lib/auditTypes';

const AuditFactorChart = dynamic(() => import('../../../../components/audit/AuditFactorChart'), { ssr: false });

const FONT = 'var(--font-family-primary)';

const VerdictIcon = ({ verdict }: { verdict: AuditFactor['verdict'] }) => {
   if (verdict === 'ok') {
      return (
         <svg width="20" height="20" viewBox="0 0 256 256" style={{ color: '#22C55E', flexShrink: 0 }}><path fill="currentColor" d="M208 32H48a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16m-34.34 77.66l-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 11.32" /></svg>
      );
   }
   if (verdict === 'warn') {
      return (
         <svg width="20" height="20" viewBox="0 0 24 24" style={{ color: '#F0B429', flexShrink: 0 }}><path fill="currentColor" fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5zM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75m0 8.25a.75.75 0 1 0 0-1.5a.75.75 0 0 0 0 1.5" clipRule="evenodd" /></svg>
      );
   }
   return (
      <svg width="20" height="20" viewBox="0 0 24 24" style={{ color: '#3B82F6', flexShrink: 0 }}><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" /></svg>
   );
};

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
   <div style={{ border: '1px solid #E4E4E7', borderRadius: 16, background: '#fff', padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#18181B', fontFamily: FONT, marginBottom: 16 }}>{title}</div>
      {children}
   </div>
);

const FactorBlock = ({ factor }: { factor: AuditFactor }) => (
   <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
         <VerdictIcon verdict={factor.verdict} />
         <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: factor.verdict === 'warn' ? '#B45309' : factor.verdict === 'ok' ? '#15803D' : '#1D4ED8', fontFamily: FONT }}>{factor.label}</div>
            <div style={{ fontSize: 13, color: '#71717B', fontFamily: FONT, marginTop: 2 }}>{factor.message}</div>
         </div>
      </div>
      <AuditFactorChart factor={factor} />
   </div>
);

const AuditDetailPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug, id } = router.query as { domain: string; id: string };
   const domain = slug ? slugToDomain(slug) : '';
   const runId = id ? Number(id) : undefined;
   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];

   const runQ = useAuditRun(slug, runId);
   const run = runQ.data?.run;
   const result = runQ.data?.result;

   // "Select competitors" modal — shared store keyed by (domain, keyword). Changing the
   // selection re-queues this audit so the charts recompute against the chosen competitors.
   const [compOpen, setCompOpen] = useState(false);
   const compQ = useCompetitors(slug, run?.keyword);
   const scanM = useScanCompetitors(slug);
   const selectM = useSelectCompetitors(slug);
   const rerunM = useRerunAudit(slug);
   const runM = useRunAudits(slug);

   const onConfirmCompetitors = (selectedIds: number[]) => {
      if (!run?.keyword) return;
      selectM.mutate({ keyword: run.keyword, selectedIds }, {
         onSuccess: () => {
            setCompOpen(false);
            if (runId) rerunM.mutate({ id: runId }, { onSuccess: () => runM.mutate() });
         },
      });
   };

   // Surface react-query load/error state so a failed fetch shows an error instead of
   // an endless "Analyzing the page…" (which would only be true while compute runs).
   const failed = runQ.isError || run?.status === 'failed';
   const busy = !failed && (runQ.isLoading || !run || run.status === 'queued' || run.status === 'running');

   // Group factors by section, preserving first-seen order.
   const sections: { name: string; factors: AuditFactor[] }[] = [];
   (result?.factors || []).forEach((f) => {
      let s = sections.find((x) => x.name === f.section);
      if (!s) { s = { name: f.section, factors: [] }; sections.push(s); }
      s.factors.push(f);
   });

   const contentScoreFactor: AuditFactor | null = result ? {
      key: 'content_score', section: 'Content Score', label: `Your Content Score is ${result.contentScore}.`,
      you: result.contentScore, competitors: result.contentScoreCompetitors,
      suggestedMin: result.contentScoreSuggestedMin, suggestedMax: result.contentScoreSuggestedMax,
      verdict: 'info', message: 'Overall content quality vs the compared pages.', placeholder: true,
   } : null;

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>{`${run?.keyword || 'Audit'} — ${domain}`}</title></Head>
         <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
         <DomainSubLayout domain={domain} slug={slug || ''} section="Audit" contentMaxWidth="100%">
            <div style={{ maxWidth: 880, margin: '0 auto' }}>
            {/* Sticky title row: keyword + audited URL + Share */}
            <div style={{ position: 'sticky', top: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#fff', padding: '16px 0', marginBottom: 4 }}>
               <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 }}>
                  <button type="button" onClick={() => router.push(`/sites/${slug}/audit-tool`)} aria-label="Back" style={{ border: 'none', background: 'transparent', color: '#71717B', cursor: 'pointer', fontSize: 18, padding: 0, flexShrink: 0 }}>‹</button>
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#09090B', fontFamily: FONT, flexShrink: 0 }}>{run?.keyword || '…'}</span>
                  {run?.url && (
                     <a href={run.url} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: '#52525C', fontFamily: FONT, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.url}</a>
                  )}
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  {run?.keyword && (
                     <button
                        type="button"
                        onClick={() => setCompOpen(true)}
                        aria-label="Select competitors"
                        title="Select competitors"
                        style={{ border: 'none', background: 'transparent', color: '#52525C', cursor: 'pointer', display: 'inline-flex', padding: 4 }}
                     >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                     </button>
                  )}
                  <button type="button" style={{ border: 'none', borderRadius: 8, padding: '7px 16px', background: '#18181B', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>Share</button>
               </div>
            </div>

            {failed && (
               <div style={{ border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: 12, padding: 20, color: '#B91C1C', fontFamily: FONT, fontSize: 14 }}>
                  {run?.status === 'failed' ? `Audit failed${run?.error ? `: ${run.error}` : '.'}` : 'Could not load this audit. Please try again.'}
               </div>
            )}

            {!failed && busy && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#B45309', fontFamily: FONT, fontSize: 14, fontWeight: 600 }}>
                     <svg viewBox="0 0 24 24" width={16} height={16} style={{ animation: 'spin 0.7s linear infinite' }}><path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" /></svg>
                     Analyzing the page…
                  </div>
                  {[0, 1, 2].map((i) => <div key={i} style={{ border: '1px solid #E4E4E7', borderRadius: 16, height: 240, background: '#F8F8F9' }} />)}
               </div>
            )}

            {!failed && !busy && result && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {contentScoreFactor && (
                     <Panel title="Content Score">
                        <AuditFactorChart factor={contentScoreFactor} height={340} />
                     </Panel>
                  )}

                  <Panel title="Internal links">
                     {result.internalLinks.length === 0 ? (
                        <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT }}>No internal links found on the page.</div>
                     ) : (
                        <div style={{ overflow: 'auto' }}>
                           <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT }}>
                              <thead>
                                 <tr>
                                    <th style={{ textAlign: 'left', fontSize: 13, fontWeight: 500, color: '#71717B', borderBottom: '1px solid #F4F4F5', padding: '8px 12px' }}>URL</th>
                                    <th style={{ textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#71717B', borderBottom: '1px solid #F4F4F5', padding: '8px 12px', width: 100 }}>Links here</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {result.internalLinks.map((l) => (
                                    <tr key={l.url}>
                                       <td style={{ borderBottom: '1px solid #F4F4F5', padding: '10px 12px' }}>
                                          <a href={l.url} target="_blank" rel="noreferrer" style={{ color: '#783AFB', fontSize: 13, textDecoration: 'none' }}>{l.url}</a>
                                       </td>
                                       <td style={{ borderBottom: '1px solid #F4F4F5', padding: '10px 12px', textAlign: 'right' }}>{l.linked ? '✓' : '—'}</td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     )}
                  </Panel>

                  <Panel title="Terms to Use">
                     {result.terms.length === 0 ? (
                        <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT }}>
                           No term suggestions — scan competitors (top-right) to populate NLP terms for this keyword.
                        </div>
                     ) : (
                        <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                           <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT }}>
                              <thead>
                                 <tr>
                                    <th style={{ textAlign: 'left', fontSize: 13, fontWeight: 500, color: '#71717B', borderBottom: '1px solid #F4F4F5', padding: '8px 12px' }}>Term</th>
                                    <th style={{ textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#71717B', borderBottom: '1px solid #F4F4F5', padding: '8px 12px', width: 70 }}>You</th>
                                    <th style={{ textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#71717B', borderBottom: '1px solid #F4F4F5', padding: '8px 12px', width: 90 }}>Suggested</th>
                                    <th style={{ textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#71717B', borderBottom: '1px solid #F4F4F5', padding: '8px 12px', width: 90 }}>Action</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {result.terms.map((t) => {
                                    const color = t.action === 'add' ? '#DC2626' : t.action === 'remove' ? '#B45309' : '#15803D';
                                    const label = t.action === 'add' ? `Add` : t.action === 'remove' ? 'Remove' : 'OK';
                                    return (
                                       <tr key={t.term}>
                                          <td style={{ borderBottom: '1px solid #F4F4F5', padding: '10px 12px', fontSize: 13, color: '#18181B' }}>
                                             {t.term}{t.nlp && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#3B82F6', border: '1px solid #BFDBFE', borderRadius: 4, padding: '1px 4px' }}>NLP</span>}
                                          </td>
                                          <td style={{ borderBottom: '1px solid #F4F4F5', padding: '10px 12px', textAlign: 'right', fontSize: 13, color: '#52525C' }}>{t.you}</td>
                                          <td style={{ borderBottom: '1px solid #F4F4F5', padding: '10px 12px', textAlign: 'right', fontSize: 13, color: '#52525C' }}>{t.suggested}</td>
                                          <td style={{ borderBottom: '1px solid #F4F4F5', padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color }}>{label}</td>
                                       </tr>
                                    );
                                 })}
                              </tbody>
                           </table>
                        </div>
                     )}
                  </Panel>

                  {sections.map((sec) => (
                     <Panel key={sec.name} title={sec.name}>
                        {sec.factors.map((f) => <FactorBlock key={f.key} factor={f} />)}
                     </Panel>
                  ))}
               </div>
            )}
            </div>
         </DomainSubLayout>

         {compOpen && run?.keyword && (
            <CompetitorsModal
               keyword={run.keyword}
               competitors={compQ.data?.competitors || []}
               loading={compQ.isLoading}
               scanning={scanM.isLoading}
               onScan={() => { if (run.keyword) scanM.mutate({ keyword: run.keyword }); }}
               onClose={() => setCompOpen(false)}
               onConfirm={onConfirmCompetitors}
            />
         )}
      </AppShell>
   );
};

export default AuditDetailPage;
