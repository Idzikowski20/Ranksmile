import type { NextPage } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import AppShell from '../../../../components/common/AppShell';
import DomainSubLayout from '../../../../components/domains/DomainSubLayout';
import CompetitorsModal from '../../../../components/competitors/CompetitorsModal';
import { useAuditRun, useRerunAudit, useRunAudits } from '../../../../services/auditTool';
import { useFetchDomains } from '../../../../services/domains';
import { slugToDomain } from '../../../../utils/slugToDomain';
import { AuditFactor, AuditResult } from '../../../../lib/auditTypes';

const AuditFactorChart = dynamic(() => import('../../../../components/audit/AuditFactorChart'), { ssr: false });
const TermsTable = dynamic(() => import('../../../../components/audit/TermsTable'), { ssr: false });

const FONT = 'var(--font-family-primary)';

// ─── Verdict palette (mirrors the SurferSEO reference: green/yellow/blue + a red state
//     used for the Internal-links / Terms call-to-action rows) ───
type Tone = 'ok' | 'warn' | 'info' | 'red';
const HEADLINE_COLOR: Record<Tone, string> = { ok: '#15803D', warn: '#B45309', info: '#1D4ED8', red: '#B91C1C' };

const ToneIcon = ({ tone }: { tone: Tone }) => {
   if (tone === 'ok') {
      return <svg width="20" height="20" viewBox="0 0 256 256" style={{ color: '#22C55E', flexShrink: 0 }}><path fill="currentColor" d="M208 32H48a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16m-34.34 77.66l-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 11.32" /></svg>;
   }
   if (tone === 'warn') {
      return <svg width="20" height="20" viewBox="0 0 24 24" style={{ color: '#F0B429', flexShrink: 0 }}><path fill="currentColor" fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5zM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75m0 8.25a.75.75 0 1 0 0-1.5a.75.75 0 0 0 0 1.5" clipRule="evenodd" /></svg>;
   }
   if (tone === 'red') {
      return <svg width="20" height="20" viewBox="0 0 256 256" style={{ color: '#EF4444', flexShrink: 0 }}><path fill="currentColor" d="m227.31 80.23l-51.54-51.54A16.13 16.13 0 0 0 164.45 24h-72.9a16.13 16.13 0 0 0-11.32 4.69L28.69 80.23A16.13 16.13 0 0 0 24 91.55v72.9a16.13 16.13 0 0 0 4.69 11.32l51.54 51.54A16.13 16.13 0 0 0 91.55 232h72.9a16.13 16.13 0 0 0 11.32-4.69l51.54-51.54a16.13 16.13 0 0 0 4.69-11.32v-72.9a16.13 16.13 0 0 0-4.69-11.32M120 80a8 8 0 0 1 16 0v56a8 8 0 0 1-16 0Zm8 104a12 12 0 1 1 12-12a12 12 0 0 1-12 12" /></svg>;
   }
   return <svg width="20" height="20" viewBox="0 0 24 24" style={{ color: '#3B82F6', flexShrink: 0 }}><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" /></svg>;
};

// ─── Shared building blocks ───
const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
   <div style={{ border: '1px solid #E4E4E7', borderRadius: 16, background: '#fff', padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 500, color: '#18181B', fontFamily: FONT, marginBottom: 16 }}>{title}</div>
      {children}
   </div>
);

const DetailsButton = ({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) => (
   <button
      type="button" onClick={onClick}
      style={{ boxSizing: 'border-box', height: 36, padding: '0 16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', background: '#F4F4F5', color: '#2F2F34', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 150ms ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#E4E4E7'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
   >{open ? label.replace(/^Show/, 'Hide') : label}</button>
);

/** One row: tone icon + headline + value line + (indented) description, with a Show/Hide
 *  toggle on the right. `expanded` reveals `children` (a chart or a table) below. */
const Row: React.FC<{
   tone: Tone; headline: string; value?: string; description?: string;
   detailsLabel?: string; expanded?: boolean; onToggle?: () => void; children?: React.ReactNode; last?: boolean;
}> = ({ tone, headline, value, description, detailsLabel, expanded, onToggle, children, last }) => (
   <div style={{ marginBottom: last ? 0 : 24 }}>
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 16 }}>
         <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
               <span style={{ display: 'inline-flex', marginTop: 1 }}><ToneIcon tone={tone} /></span>
               <div style={{ paddingLeft: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: HEADLINE_COLOR[tone], fontFamily: FONT }}>{headline}</div>
                  {value && <div style={{ fontSize: 14, color: '#3F3F47', fontFamily: FONT, marginTop: 1 }}>{value}</div>}
               </div>
            </div>
            {description && <div style={{ marginLeft: 32, marginTop: 4, fontSize: 13, color: '#71717B', fontFamily: FONT }}>{description}</div>}
         </div>
         {detailsLabel && onToggle && <DetailsButton label={detailsLabel} open={!!expanded} onClick={onToggle} />}
      </div>
      {expanded && children && <div style={{ marginTop: 12 }}>{children}</div>}
   </div>
);

// ─── Per-factor copy derived from the numbers (no backend change needed) ───
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
const nounFrom = (label: string) => label.replace(/^\s*[\d.]+\s*/, '');

function factorHeadline(f: AuditFactor): string {
   if (f.verdict === 'ok') return 'No action required.';
   if (f.verdict === 'info') {
      const vals = f.competitors.map((c) => c.value);
      const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0;
      const lo = f.suggestedMin ?? (vals.length ? Math.min(...vals) : 0);
      const hi = f.suggestedMax ?? (vals.length ? Math.max(...vals) : 0);
      return `Compared pages have ${fmt(lo)} - ${fmt(hi)} (${fmt(avg)} on average)`;
   }
   // warn — express the gap to the suggested range as an actionable Add/Remove.
   const noun = nounFrom(f.label);
   if (f.suggestedMin !== null && f.you < f.suggestedMin) {
      const g1 = f.suggestedMin - f.you;
      const g2 = (f.suggestedMax ?? f.suggestedMin) - f.you;
      return g2 > g1 ? `Add ${fmt(g1)}-${fmt(g2)} ${noun}` : `Add ${fmt(g1)} ${noun}`;
   }
   if (f.suggestedMax !== null && f.you > f.suggestedMax) {
      const g1 = f.you - f.suggestedMax;
      const g2 = f.you - (f.suggestedMin ?? f.suggestedMax);
      return g2 > g1 ? `Remove ${fmt(g1)}-${fmt(g2)} ${noun}` : `Remove ${fmt(g1)} ${noun}`;
   }
   return `Adjust ${noun}`;
}

function factorDescription(f: AuditFactor): string {
   // Real ranges (phase 2) can be stated as fact; placeholder ranges stay unstated (the
   // expanded chart already captions them as sample data).
   if (!f.placeholder && f.suggestedMin !== null && f.suggestedMax !== null && f.verdict !== 'info') {
      const base = f.message.replace(/\.\s*$/, '');
      return `${base}, while the suggested range is ${fmt(f.suggestedMin)} - ${fmt(f.suggestedMax)}.`;
   }
   return f.message;
}

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

   const [compOpen, setCompOpen] = useState(false);
   const [expanded, setExpanded] = useState<Set<string>>(new Set());
   const toggle = (key: string) => setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
   });

   const rerunM = useRerunAudit(slug);
   const runM = useRunAudits(slug);
   const rerun = () => { if (runId) rerunM.mutate({ id: runId }, { onSuccess: () => runM.mutate() }); };
   const onConfirmCompetitors = () => { setCompOpen(false); rerun(); };

   const failed = runQ.isError || run?.status === 'failed';
   // rerunM.isLoading keeps the "Analyzing…" view up the instant a re-run is fired, before
   // the polled status flips to queued/running (otherwise the stale result flashes back).
   const busy = !failed && (runQ.isLoading || rerunM.isLoading || !run || run.status === 'queued' || run.status === 'running');

   // Group factors by section, preserving first-seen order.
   const sections: { name: string; factors: AuditFactor[] }[] = [];
   (result?.factors || []).forEach((f) => {
      let s = sections.find((x) => x.name === f.section);
      if (!s) { s = { name: f.section, factors: [] }; sections.push(s); }
      s.factors.push(f);
   });

   const isPlaceholder = !!result && result.factors.length > 0 && result.factors[0].placeholder;
   const contentScoreFactor = (r: AuditResult): AuditFactor => ({
      key: 'content_score', section: 'Content Score', label: `Your Content Score is ${r.contentScore}.`,
      you: r.contentScore, competitors: r.contentScoreCompetitors,
      suggestedMin: r.contentScoreSuggestedMin, suggestedMax: r.contentScoreSuggestedMax,
      verdict: 'info', message: 'Overall content quality vs the compared pages.', placeholder: isPlaceholder,
   });

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>{`${run?.keyword || 'Audit'} — ${domain}`}</title></Head>
         <style>{'@keyframes spin{to{transform:rotate(360deg)}}@keyframes auditPulse{0%,100%{opacity:.5}50%{opacity:1}}'}</style>
         <DomainSubLayout domain={domain} slug={slug || ''} section="Audit" contentMaxWidth="100%">
            <div style={{ maxWidth: 1040, margin: '0 auto' }}>
            {/* Sticky title row: keyword + audited URL + actions */}
            <div style={{ position: 'sticky', top: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#fff', padding: '16px 0', marginBottom: 4 }}>
               <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 }}>
                  <button type="button" onClick={() => router.push(`/sites/${slug}/audit-tool`)} aria-label="Back" style={{ border: 'none', background: 'transparent', color: '#71717B', cursor: 'pointer', fontSize: 18, padding: 0, flexShrink: 0 }}>‹</button>
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#09090B', fontFamily: FONT, flexShrink: 0 }}>{run?.keyword || '…'}</span>
                  {run?.url && (
                     <a href={run.url} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: '#52525C', fontFamily: FONT, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.url}</a>
                  )}
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <button type="button" onClick={rerun} disabled={rerunM.isLoading} aria-label="Refresh audit" title="Re-run audit" style={{ border: 'none', background: 'transparent', color: '#52525C', cursor: rerunM.isLoading ? 'default' : 'pointer', display: 'inline-flex', padding: 4, opacity: rerunM.isLoading ? 0.5 : 1 }}>
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M14 22s.85-.12 4.36-3.64C21.88 14.85 21.88 9.15 18.36 5.64 17.12 4.39 15.6 3.59 14 3.22M14 22h6M14 22v-6M10 2s-.85.12-4.36 3.64C2.12 9.15 2.12 14.85 5.64 18.36 6.88 19.61 8.4 20.41 10 20.78M10 2H4M10 2v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  {run?.keyword && (
                     <button type="button" onClick={() => setCompOpen(true)} aria-label="Select competitors" title="Select competitors" style={{ border: 'none', background: 'transparent', color: '#52525C', cursor: 'pointer', display: 'inline-flex', padding: 4 }}>
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
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#18181B', fontFamily: FONT, fontSize: 14, fontWeight: 600 }}>
                     <svg viewBox="0 0 24 24" width={16} height={16} style={{ animation: 'spin 0.7s linear infinite' }}><path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" /></svg>
                     Analyzing the page…
                  </div>
                  {[0, 1, 2].map((i) => <div key={i} style={{ border: '1px solid #E4E4E7', borderRadius: 16, height: 120, background: '#F8F8F9', animation: `auditPulse 1.4s ease-in-out ${i * 0.15}s infinite` }} />)}
               </div>
            )}

            {!failed && !busy && result && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Content Score */}
                  <SectionCard title="Content Score">
                     {(() => {
                        const csMin = result.contentScoreSuggestedMin;
                        const below = csMin !== null && result.contentScore < csMin;
                        return (
                           <Row
                              last
                              tone={below ? 'warn' : 'ok'}
                              headline={below ? `Improve Content Score by at least ${csMin - result.contentScore} for the best results.` : 'No action required.'}
                              value={`Your Content Score is ${result.contentScore}.`}
                              detailsLabel="Show details" expanded={expanded.has('content_score')} onToggle={() => toggle('content_score')}
                           >
                              <AuditFactorChart factor={contentScoreFactor(result)} height={340} />
                           </Row>
                        );
                     })()}
                  </SectionCard>

                  {/* Internal links */}
                  <SectionCard title="Internal links">
                     {result.internalLinks.length === 0 ? (
                        <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT }}>No internal links found on the page.</div>
                     ) : (
                        <Row
                           last tone="info"
                           headline="Internal links found on this page."
                           value={`${result.internalLinks.length} internal link${result.internalLinks.length === 1 ? '' : 's'} detected`}
                           description="Same-site links found on the audited page. A ✓ marks a link already pointing at the audited URL."
                           detailsLabel="Show internal links" expanded={expanded.has('internal_links')} onToggle={() => toggle('internal_links')}
                        >
                           <div style={{ overflow: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT }}>
                                 <thead><tr>
                                    <th style={{ textAlign: 'left', fontSize: 13, fontWeight: 500, color: '#71717B', borderBottom: '1px solid #F4F4F5', padding: '8px 12px' }}>URL</th>
                                    <th style={{ textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#71717B', borderBottom: '1px solid #F4F4F5', padding: '8px 12px', width: 100 }}>Links here</th>
                                 </tr></thead>
                                 <tbody>
                                    {result.internalLinks.map((l) => (
                                       <tr key={l.url}>
                                          <td style={{ borderBottom: '1px solid #F4F4F5', padding: '10px 12px' }}><a href={l.url} target="_blank" rel="noreferrer" style={{ color: '#783AFB', fontSize: 13, textDecoration: 'none' }}>{l.url}</a></td>
                                          <td style={{ borderBottom: '1px solid #F4F4F5', padding: '10px 12px', textAlign: 'right' }}>{l.linked ? '✓' : '—'}</td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        </Row>
                     )}
                  </SectionCard>

                  {/* Terms to Use */}
                  <SectionCard title="Terms to Use">
                     {result.terms.length === 0 ? (
                        <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT }}>No term suggestions — scan competitors (top-right) to populate NLP terms for this keyword.</div>
                     ) : (() => {
                        const attention = result.terms.filter((t) => t.action !== 'ok').length;
                        return (
                           <Row
                              last tone={attention > 0 ? 'red' : 'ok'}
                              headline={attention > 0 ? 'Review the list of important terms and apply presented suggestions if it makes sense.' : 'No action required.'}
                              value={attention > 0 ? `${attention} out of ${result.terms.length} important terms require your attention!` : `${result.terms.length} important terms covered.`}
                              detailsLabel="Show details" expanded={expanded.has('terms')} onToggle={() => toggle('terms')}
                           >
                              <TermsTable terms={result.terms} />
                           </Row>
                        );
                     })()}
                  </SectionCard>

                  {/* Factor sections */}
                  {sections.map((sec) => (
                     <SectionCard key={sec.name} title={sec.name}>
                        {sec.factors.map((f, i) => (
                           <Row
                              key={f.key}
                              last={i === sec.factors.length - 1}
                              tone={f.verdict}
                              headline={factorHeadline(f)}
                              value={f.label}
                              description={factorDescription(f)}
                              detailsLabel="Show details" expanded={expanded.has(f.key)} onToggle={() => toggle(f.key)}
                           >
                              <AuditFactorChart factor={f} />
                           </Row>
                        ))}
                     </SectionCard>
                  ))}
               </div>
            )}
            </div>
         </DomainSubLayout>

         {compOpen && run?.keyword && (
            <CompetitorsModal slug={slug} keyword={run.keyword} onClose={() => setCompOpen(false)} onConfirm={onConfirmCompetitors} />
         )}
      </AppShell>
   );
};

export default AuditDetailPage;
