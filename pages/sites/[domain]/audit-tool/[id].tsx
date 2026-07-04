import type { NextPage } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import React from 'react';
import AppShell from '../../../../components/common/AppShell';
import DomainSubLayout from '../../../../components/domains/DomainSubLayout';
import { useAuditRun } from '../../../../services/auditTool';
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

   const busy = !run || run.status === 'queued' || run.status === 'running';
   const failed = run?.status === 'failed';

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
         <DomainSubLayout domain={domain} slug={slug || ''} section="Audit" contentMaxWidth="880px">
            {/* Sticky title row: keyword + audited URL + Share */}
            <div style={{ position: 'sticky', top: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#fff', padding: '16px 0', marginBottom: 4 }}>
               <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 }}>
                  <button type="button" onClick={() => router.push(`/sites/${slug}/audit-tool`)} aria-label="Back" style={{ border: 'none', background: 'transparent', color: '#71717B', cursor: 'pointer', fontSize: 18, padding: 0, flexShrink: 0 }}>‹</button>
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#09090B', fontFamily: FONT, flexShrink: 0 }}>{run?.keyword || '…'}</span>
                  {run?.url && (
                     <a href={run.url} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: '#52525C', fontFamily: FONT, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.url}</a>
                  )}
               </div>
               <button type="button" style={{ border: 'none', borderRadius: 8, padding: '7px 16px', background: '#18181B', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', flexShrink: 0 }}>Share</button>
            </div>

            {failed && (
               <div style={{ border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: 12, padding: 20, color: '#B91C1C', fontFamily: FONT, fontSize: 14 }}>
                  Audit failed{run?.error ? `: ${run.error}` : '.'}
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
                     <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT }}>
                        NLP term suggestions arrive with real competitor data in the next phase.
                     </div>
                  </Panel>

                  {sections.map((sec) => (
                     <Panel key={sec.name} title={sec.name}>
                        {sec.factors.map((f) => <FactorBlock key={f.key} factor={f} />)}
                     </Panel>
                  ))}
               </div>
            )}
         </DomainSubLayout>
      </AppShell>
   );
};

export default AuditDetailPage;
