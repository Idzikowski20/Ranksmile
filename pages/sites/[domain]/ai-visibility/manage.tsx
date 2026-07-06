import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import AppShell from '../../../../components/common/AppShell';
import DomainSubLayout from '../../../../components/domains/DomainSubLayout';
import { Modal } from '../../../../components/core';
import { useFetchDomains } from '../../../../services/domains';
import { slugToDomain } from '../../../../utils/slugToDomain';
import PromptSelector from '../../../../components/aiVisibility/PromptSelector';
import type { WizardTopic, WizardPrompt } from '../../../../components/aiVisibility/wizardTypes';
import { useAiVisConfig, useSaveAiVisConfig, useStartAiVisScan, useGeneratePrompts } from '../../../../services/aiVisibility';
import { AI_VIS_PROMPT_LIMIT } from '../../../../lib/aiVisibility';

const FONT = 'var(--font-family-primary)';

const outlineBtn: React.CSSProperties = {
   display: 'inline-flex', alignItems: 'center', border: '1px solid #E4E4E7', background: '#fff',
   borderRadius: 8, padding: '6px 14px', fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT, cursor: 'pointer',
};

const DEFAULT_SELECTED = 5;

const SkeletonCard = () => (
   <div style={{ border: '1px solid #E4E4E7', borderRadius: 8, background: '#fff', height: 56, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
      <div className="aiv-pulse" style={{ width: 20, height: 20, borderRadius: 4, background: '#F4F4F5' }} />
      <div className="aiv-pulse" style={{ height: 14, width: '32%', borderRadius: 4, background: '#F4F4F5' }} />
   </div>
);

/** Manage Prompts editor. Unlike the first-run wizard (setup.tsx) this LOADS the
 *  saved config and preserves each prompt's DB id, so saving reconciles in place —
 *  existing scan results survive and only newly-added prompts get crunched. */
const AiVisibilityManage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';
   const promptsUrl = `/sites/${slug}/ai-visibility/prompts`;

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];

   const configQ = useAiVisConfig(slug);
   const save = useSaveAiVisConfig(slug);
   const startScan = useStartAiVisScan(slug);
   const generate = useGeneratePrompts(slug);

   const [topics, setTopics] = useState<WizardTopic[]>([]);
   const [bulkOpen, setBulkOpen] = useState(false);
   const [bulkText, setBulkText] = useState('');
   const seededSlug = useRef<string | null>(null);

   // Seed editable state once per domain from the saved config, carrying each prompt's DB id.
   // Keyed to `slug` so switching domains client-side re-seeds instead of showing the previous
   // domain's prompts; within the same domain the guard prevents clobbering in-progress edits.
   useEffect(() => {
      const config = configQ.data?.config;
      if (!config || seededSlug.current === slug) return;
      seededSlug.current = slug;
      setTopics(config.topics.map((t, ti) => ({
         key: `t-${ti}`,
         title: t.title,
         prompts: t.prompts.map((p) => ({ key: `db-${p.id}`, id: p.id, text: p.text, provenance: p.provenance, selected: p.selected })),
         generating: false,
      })));
   }, [configQ.data, slug]);

   const selectedCount = useMemo(
      () => topics.reduce((n, t) => n + t.prompts.filter((p) => p.selected).length, 0),
      [topics],
   );

   const addTopic = () => setTopics((prev) => [...prev, { key: `topic-${Date.now()}-${prev.length}`, title: 'New topic', prompts: [], generating: false }]);

   const addBulk = () => {
      const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length) {
         const key = `bulk-${Date.now()}`;
         const prompts: WizardPrompt[] = lines.map((text, i) => ({ key: `${key}-p${i}`, text, provenance: [], selected: true, isCustom: true }));
         setTopics((prev) => [...prev, { key, title: 'Bulk prompts', prompts, generating: false }]);
      }
      setBulkText('');
      setBulkOpen(false);
   };

   const onGenerate = async (topicKey: string, title: string) => {
      setTopics((prev) => prev.map((t) => (t.key === topicKey ? { ...t, generating: true } : t)));
      try {
         const { prompts } = await generate.mutateAsync(title);
         const wp: WizardPrompt[] = prompts.map((p, pi) => ({ key: `${topicKey}-p${pi}`, text: p.text, provenance: p.provenance, selected: pi < DEFAULT_SELECTED }));
         setTopics((prev) => prev.map((t) => (t.key === topicKey ? { ...t, prompts: wp, generating: false } : t)));
      } catch {
         setTopics((prev) => prev.map((t) => (t.key === topicKey ? { ...t, generating: false } : t)));
      }
   };

   const saving = save.isLoading || startScan.isLoading;
   const canSave = selectedCount > 0 && selectedCount <= AI_VIS_PROMPT_LIMIT && !saving;

   const onSave = async () => {
      if (!canSave) return;
      try {
         await save.mutateAsync({
            brandName: configQ.data?.config?.brandName || domain,
            topics: topics.map((t) => ({
               title: t.title,
               prompts: t.prompts.map((p) => ({ id: p.id ?? 0, text: p.text, provenance: p.provenance, selected: p.selected, isCustom: p.isCustom })),
            })),
         });
         // Incremental: carries prior results forward, only new prompts hit the model.
         await startScan.mutateAsync({ incremental: true });
         toast.success('Prompts saved — crunching new prompts');
         router.push(promptsUrl);
      } catch { /* useSaveAiVisConfig / useStartAiVisScan already toast the error */ }
   };

   const pct = Math.min(100, Math.round((selectedCount / AI_VIS_PROMPT_LIMIT) * 100));
   const loading = configQ.isLoading && seededSlug.current !== slug;

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>{`Manage Prompts — ${domain}`}</title></Head>
         <style>{'@keyframes aivPulse{0%,100%{opacity:1}50%{opacity:.5}}.aiv-pulse{animation:aivPulse 1.5s ease-in-out infinite}@keyframes aivSpin{to{transform:rotate(360deg)}}'}</style>
         <DomainSubLayout domain={domain} slug={slug || ''} section="AI Visibility" contentMaxWidth="100%">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800, width: '100%', margin: '0 auto' }}>
               {/* Heading + usage */}
               <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                     <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#09090B', fontFamily: FONT }}>Manage Prompts</h1>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, color: '#52525C', fontFamily: FONT }}>
                           <span style={{ fontWeight: 600, color: '#18181B' }}>{selectedCount} of {AI_VIS_PROMPT_LIMIT}</span> prompts used
                        </span>
                        <span style={{ display: 'inline-flex', width: 44, height: 8, borderRadius: 9999, background: '#F4F4F5', overflow: 'hidden' }}>
                           <span style={{ minWidth: 4, width: `${pct}%`, borderRadius: 9999, background: '#E6A817' }} />
                        </span>
                     </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                     <button type="button" style={outlineBtn} onClick={addTopic}>Add topic</button>
                     <button type="button" style={outlineBtn} onClick={() => setBulkOpen(true)}>Add in bulk</button>
                  </div>
               </div>

               {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                     <SkeletonCard /><SkeletonCard /><SkeletonCard />
                  </div>
               ) : (
                  <PromptSelector topics={topics} onChange={setTopics} onGenerate={onGenerate} />
               )}

               {/* Footer */}
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                  <button type="button" style={outlineBtn} onClick={() => router.push(promptsUrl)}>Cancel</button>
                  <button
                     type="button"
                     onClick={onSave}
                     disabled={!canSave}
                     style={{ display: 'inline-flex', alignItems: 'center', border: 'none', borderRadius: 8, padding: '8px 20px', background: canSave ? '#18181B' : '#D4D4D8', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: canSave ? 'pointer' : 'not-allowed', transition: 'background 150ms ease' }}
                  >
                     {saving ? 'Saving…' : 'Save'}
                  </button>
               </div>
            </div>

            {bulkOpen && (
               <Modal title="Add prompts in bulk" onClose={() => setBulkOpen(false)} width={560}>
                  <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                     <textarea
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder="One prompt per line"
                        rows={8}
                        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #D4D4D8', borderRadius: 8, padding: 12, fontSize: 14, fontFamily: FONT, color: '#18181B', resize: 'vertical', outline: 'none' }}
                     />
                     <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button type="button" style={outlineBtn} onClick={() => setBulkOpen(false)}>Cancel</button>
                        <button type="button" onClick={addBulk} style={{ border: 'none', borderRadius: 8, padding: '8px 20px', background: '#18181B', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>Add</button>
                     </div>
                  </div>
               </Modal>
            )}
         </DomainSubLayout>
      </AppShell>
   );
};

export default AiVisibilityManage;
