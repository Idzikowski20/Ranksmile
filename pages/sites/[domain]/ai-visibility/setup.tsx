import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AI_VIS_PROMPT_LIMIT, brandFromDomain } from '@/src/core/domain/aiVisibility/config';
import AppShell from '../../../../components/common/AppShell';
import DomainSubLayout from '../../../../components/domains/DomainSubLayout';
import { Modal, Button, Input } from '../../../../components/koala/core';
import { useFetchDomains } from '../../../../services/domains';
import { slugToDomain } from '../../../../utils/slugToDomain';
import PromptSelector from '../../../../components/aiVisibility/PromptSelector';
import type { WizardTopic, WizardPrompt } from '../../../../components/aiVisibility/wizardTypes';
import { useSaveAiVisConfig, useStartAiVisScan, useGeneratePrompts, useAiVisConfig } from '../../../../services/aiVisibility';

const FONT = 'var(--font-family-primary)';

const DEFAULT_SELECTED = 5;

/** Titles the wizard creates itself; they name no service. */
const PLACEHOLDER_TITLES = new Set(['New topic', 'Bulk prompts']);

const AiVisibilitySetup: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';

   // The name the answers are matched against. Prefilled from the domain, replaced by
   // whatever a previous setup saved, and editable — a brand is rarely its domain spelled
   // out, and this is the string the whole metric hangs on.
   const configQ = useAiVisConfig(slug);
   const [brandName, setBrandName] = useState('');
   const brandTouched = useRef(false);
   // Client-side navigation keeps this component mounted, so an edited field would other-
   // wise survive a domain switch and Finish would save the previous brand under the new
   // slug. Clearing on slug change lets the prefill below run again for the new domain.
   useEffect(() => {
      brandTouched.current = false;
      setBrandName('');
   }, [slug]);
   useEffect(() => {
      if (brandTouched.current) return; // never overwrite what the user is typing
      const saved = configQ.data?.config?.brandName?.trim();
      // A previously saved domain-as-brand is not a real answer either: offer the guess.
      const usable = saved && saved !== domain ? saved : brandFromDomain(domain);
      if (usable) setBrandName(usable);
   }, [configQ.data, domain]);

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];

   const [topics, setTopics] = useState<WizardTopic[]>([]);
   const [bulkOpen, setBulkOpen] = useState(false);
   const [bulkText, setBulkText] = useState('');
   const seeded = useRef(false);

   const save = useSaveAiVisConfig(slug);
   const startScan = useStartAiVisScan(slug);
   const generate = useGeneratePrompts(slug);

   const selectedCount = useMemo(
      () => topics.reduce((n, t) => n + t.prompts.filter((p) => p.selected).length, 0),
      [topics],
   );

   // Seed once: pull the domain's topics, create a wizard topic per title, and
   // auto-generate prompts for the first few (first DEFAULT_SELECTED selected).
   useEffect(() => {
      if (!slug || seeded.current) return;
      seeded.current = true;
      (async () => {
         let titles: string[] = [];
         try {
            const r = await fetch(`/api/domains/${slug}/topics`);
            let j = await r.json();
            if (j.needsLocalization) {
               const reg = await fetch(`/api/domains/${slug}/topics/regenerate`, { method: 'POST' });
               if (reg.ok) {
                  j = await reg.json();
               }
            }
            titles = (j.topics || []).map((t: { title: string }) => t.title).slice(0, 5);
         } catch { /* no topics — start with one empty topic */ }
         if (titles.length === 0) {
            setTopics([{ key: 'topic-0', title: 'New topic', prompts: [], generating: false }]);
            return;
         }
         setTopics(titles.map((title, i) => ({ key: `topic-${i}`, title, prompts: [], generating: true })));
         // Sibling titles go with every request. The topics are usually near-synonyms and
         // these calls run in parallel, so without them each one reaches for the same few
         // obvious use cases and the wizard fills up with near-duplicates.
         await Promise.all(titles.map(async (title, i) => {
            try {
               const { prompts } = await generate.mutateAsync({
                  topic: title,
                  siblingTopics: titles.filter((t) => t !== title),
               });
               const wp: WizardPrompt[] = prompts.map((p, pi) => ({
                  key: `topic-${i}-p${pi}`, text: p.text, provenance: p.provenance, selected: pi < DEFAULT_SELECTED,
               }));
               setTopics((prev) => prev.map((t) => (t.key === `topic-${i}` ? { ...t, prompts: wp, generating: false } : t)));
            } catch {
               setTopics((prev) => prev.map((t) => (t.key === `topic-${i}` ? { ...t, generating: false } : t)));
            }
         }));
      })();
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [slug]);

   const addTopic = () => setTopics((prev) => [{ key: `topic-${Date.now()}-${prev.length}`, title: 'New topic', prompts: [], generating: false }, ...prev]);

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
         const { prompts } = await generate.mutateAsync({
            topic: title,
            refresh: true,
            // Real topics only: an untouched "New topic" card or the bulk bucket would have
            // the model reserve use cases for a subject nobody is tracking.
            siblingTopics: topics
               .filter((t) => t.key !== topicKey && !PLACEHOLDER_TITLES.has(t.title.trim()))
               .map((t) => t.title),
         });
         const wp: WizardPrompt[] = prompts.map((p, pi) => ({ key: `${topicKey}-p${pi}`, text: p.text, provenance: p.provenance, selected: pi < DEFAULT_SELECTED }));
         setTopics((prev) => prev.map((t) => (t.key === topicKey ? { ...t, prompts: wp, generating: false } : t)));
      } catch {
         setTopics((prev) => prev.map((t) => (t.key === topicKey ? { ...t, generating: false } : t)));
      }
   };

   const finishing = save.isLoading || startScan.isLoading;
   const canFinish = selectedCount > 0 && selectedCount <= AI_VIS_PROMPT_LIMIT && !finishing && !!brandName.trim();

   const onFinish = async () => {
      if (!canFinish) return;
      await save.mutateAsync({
         brandName: brandName.trim() || brandFromDomain(domain),
         topics: topics.map((t) => ({
            title: t.title,
            prompts: t.prompts.map((p) => ({ id: 0, text: p.text, provenance: p.provenance, selected: p.selected, isCustom: p.isCustom })),
         })),
      });
      await startScan.mutateAsync();
      router.replace(`/sites/${slug}/ai-visibility/overview`);
   };

   const pct = Math.min(100, Math.round((selectedCount / AI_VIS_PROMPT_LIMIT) * 100));

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>{`AI Visibility Setup — ${domain}`}</title></Head>
         <style>{'@keyframes aivPulse{0%,100%{opacity:1}50%{opacity:.5}}.aiv-pulse{animation:aivPulse 1.5s ease-in-out infinite}@keyframes aivSpin{to{transform:rotate(360deg)}}'}</style>
         {/* No fillHeight: .koala-page is already the page scroller, like every
             other AI Visibility page. fillHeight is only for pages whose content is
             an .rs-data-table that scrolls internally. */}
         <DomainSubLayout domain={domain} slug={slug || ''} section="AI Visibility" contentMaxWidth="100%">
            <div
               style={{
                  display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800, width: '100%', margin: '0 auto',
               }}
            >
               {/* Heading + usage */}
               <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                     <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--koala-text-primary)', fontFamily: FONT }}>Select prompts you want to track</h1>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, color: 'var(--koala-text-secondary)', fontFamily: FONT }}>
                           <span style={{ fontWeight: 600, color: 'var(--koala-text-primary)' }}>{selectedCount} of {AI_VIS_PROMPT_LIMIT}</span> prompts used
                        </span>
                        <span style={{ display: 'inline-flex', width: 44, height: 8, borderRadius: 9999, background: 'var(--koala-bg-secondary)', overflow: 'hidden' }}>
                           <span style={{ minWidth: 4, width: `${pct}%`, borderRadius: 9999, background: 'var(--koala-status-warning, #E6A817)' }} />
                        </span>
                     </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                     <Button type="button" variant="secondary" size="sm" onClick={addTopic}>Add topic</Button>
                     <Button type="button" variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>Add in bulk</Button>
                  </div>
               </div>

               {/* Brand name: what the answers are matched against, so it leads the wizard. */}
               <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420 }}>
                  <label
                     htmlFor="aiv-brand-name"
                     style={{ fontSize: 13, fontWeight: 600, color: 'var(--koala-text-primary)', fontFamily: FONT }}
                  >
                     Your brand name
                  </label>
                  <Input
                     id="aiv-brand-name"
                     value={brandName}
                     onChange={(e) => { brandTouched.current = true; setBrandName(e.target.value); }}
                     placeholder={brandFromDomain(domain) || 'Brand name'}
                     hasError={!brandName.trim()}
                     aria-describedby="aiv-brand-hint"
                  />
                  <span id="aiv-brand-hint" style={{ fontSize: 12, color: 'var(--koala-text-secondary)', fontFamily: FONT }}>
                     Exactly as people write it — this is the name we look for in the AI answers.
                  </span>
               </div>

               <PromptSelector topics={topics} onChange={setTopics} onGenerate={onGenerate} />

               {/* Footer */}
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                  <span style={{ fontSize: 14, color: 'var(--koala-text-primary)', fontFamily: FONT }}>Uses {selectedCount} prompts from your limit</span>
                  <Button type="button" variant="primary" size="sm" onClick={onFinish} disabled={!canFinish}>
                     {finishing ? 'Starting…' : 'Finish'}
                  </Button>
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
                        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--koala-border-primary)', borderRadius: 8, padding: 12, fontSize: 14, fontFamily: FONT, color: 'var(--koala-text-primary)', background: 'var(--koala-bg-primary)', resize: 'vertical', outline: 'none' }}
                     />
                     <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBulkOpen(false)}>Cancel</Button>
                        <Button type="button" variant="primary" size="sm" onClick={addBulk}>Add</Button>
                     </div>
                  </div>
               </Modal>
            )}
         </DomainSubLayout>
      </AppShell>
   );
};

export default AiVisibilitySetup;
