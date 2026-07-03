import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import AiVisPageShell from '../../../../components/aiVisibility/AiVisPageShell';
import SourcesTable, { SourceRow } from '../../../../components/aiVisibility/SourcesTable';
import SourceDetailModal from '../../../../components/aiVisibility/SourceDetailModal';
import MentionGapCards from '../../../../components/aiVisibility/MentionGapCards';
import { SkeletonRows, SkeletonBox } from '../../../../components/aiVisibility/SkeletonBlocks';
import HoverTooltip from '../../../../components/common/HoverTooltip';
import { Toggle, SearchBar } from '../../../../components/ui';
import { useAiVisSources, useAiVisData } from '../../../../services/aiVisibility';
import { AI_VIS_MODEL_LABEL } from '../../../../lib/aiVisibility';

const FONT = 'var(--font-family-primary)';

type GapCard = { brand: string; gap: number; shared: number; you: number };
type SourcesData = { pending?: boolean; sources?: SourceRow[]; gapCards?: GapCard[]; gapCandidates?: string[]; ownLabel?: string };
type PromptRow = { id: number; topic: string; text: string; perModel: Array<{ model: string }> };
type PromptsData = { pending?: boolean; prompts?: PromptRow[] };
type ModalState = { list: SourceRow[]; index: number; navigable: boolean };

const InfoIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: '#9F9FA9', flexShrink: 0 }}><path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const fmtK = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n));

const StatCard = ({ label, value, hint, pending }: { label: string; value: string; hint: string; pending: boolean }) => (
   <section style={{ border: '1px solid #F4F4F5', borderRadius: 12, background: '#fff', padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#71717B', fontFamily: FONT }}>
         {label}
         <HoverTooltip label={hint} align="center"><span style={{ display: 'inline-flex', cursor: 'help' }}><InfoIcon /></span></HoverTooltip>
      </span>
      {pending ? <SkeletonBox w={56} h={26} /> : <span style={{ fontSize: 20, fontWeight: 700, color: '#18181B', fontFamily: FONT }}>{value}</span>}
   </section>
);

const AiVisibilitySources: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const [groupByDomain, setGroupByDomain] = useState(false);
   const [search, setSearch] = useState('');
   const [modal, setModal] = useState<ModalState | null>(null);

   // Selected Mention-Gap competitor brands — persisted per domain. `null` = not yet
   // hydrated from localStorage, so we defer sending gapBrands until we know the choice
   // (undefined lets the server pick its default top-4).
   const [gapBrands, setGapBrands] = useState<string[] | null>(null);
   const gapKey = slug ? `aiVisGapBrands:${slug}` : '';
   useEffect(() => {
      if (!gapKey) return;
      try {
         const raw = window.localStorage.getItem(gapKey);
         setGapBrands(raw ? JSON.parse(raw) : []);
      } catch { setGapBrands([]); }
   }, [gapKey]);
   const setGap = (next: string[]) => {
      setGapBrands(next);
      try { window.localStorage.setItem(gapKey, JSON.stringify(next)); } catch { /* quota/full — non-fatal */ }
   };

   // Prompt/model filters (empty == all). The prompt list + model universe come from
   // the `prompts` view so they stay stable regardless of the current source filtering.
   const [promptSel, setPromptSel] = useState<number[]>([]);
   const [modelSel, setModelSel] = useState<string[]>([]);
   const promptsQ = useAiVisData<PromptsData>(slug, 'prompts');
   const promptOptions = useMemo(
      () => (promptsQ.data?.prompts || []).map((p) => ({ id: p.id, text: p.text, topic: p.topic })),
      [promptsQ.data],
   );
   const modelKeys = useMemo(
      () => Array.from(new Set((promptsQ.data?.prompts || []).flatMap((p) => p.perModel.map((m) => m.model)))),
      [promptsQ.data],
   );

   const sourcesQ = useAiVisSources<SourcesData>(slug, {
      prompts: promptSel,
      models: modelSel,
      gapBrands: gapBrands ?? undefined,
   });

   const sources = useMemo(() => sourcesQ.data?.sources || [], [sourcesQ.data]);
   const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return sources;
      return sources.filter((s) => s.url.toLowerCase().includes(q) || s.domain.toLowerCase().includes(q));
   }, [sources, search]);

   const domainCount = useMemo(() => new Set(sources.map((s) => s.domain)).size, [sources]);
   const referenceCount = useMemo(() => sources.reduce((acc, s) => acc + s.timesShown, 0), [sources]);

   const gapCards = useMemo(() => sourcesQ.data?.gapCards || [], [sourcesQ.data]);
   const gapCandidates = useMemo(() => sourcesQ.data?.gapCandidates || [], [sourcesQ.data]);
   const ownLabel = sourcesQ.data?.ownLabel || 'You';
   // Brands currently on screen — drives add/swap exclusion. Prefer the server's cards
   // (source of truth) so the default top-4 pre-fills the picker's exclude set too.
   const shownBrands = useMemo(() => gapCards.map((c) => c.brand), [gapCards]);

   const navigateModal = (delta: number) => {
      setModal((m) => {
         if (!m) return m;
         const next = Math.max(0, Math.min(m.list.length - 1, m.index + delta));
         return { ...m, index: next };
      });
   };

   return (
      <AiVisPageShell
         section="AI Visibility"
         title="Sources"
         toolbarPrompts={promptOptions}
         toolbarPromptSelected={promptSel}
         onToolbarPromptChange={setPromptSel}
         toolbarModels={modelKeys}
         toolbarModelSelected={modelSel}
         onToolbarModelChange={setModelSel}
         toolbarModelLabel={AI_VIS_MODEL_LABEL}
      >
         {({ crunching }) => {
            const pending = crunching || sourcesQ.isLoading || !!sourcesQ.data?.pending;
            return (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                     <StatCard label="Domains" value={fmtK(domainCount)} hint="Unique domains found in AI answers" pending={pending} />
                     <StatCard label="URLs" value={fmtK(sources.length)} hint="Unique URLs found in AI answers" pending={pending} />
                     <StatCard label="References" value={fmtK(referenceCount)} hint="Number of times URLs appear in AI answers" pending={pending} />
                  </div>

                  {/* Mention Gap */}
                  {!pending && gapCandidates.length > 0 && (
                     <MentionGapCards
                        cards={gapCards}
                        candidates={gapCandidates}
                        ownLabel={ownLabel}
                        selected={shownBrands}
                        onSelected={setGap}
                     />
                  )}

                  {/* Table toolbar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                     <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{groupByDomain ? 'Domains' : 'URLs'}</span>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: FONT }}>
                           <Toggle checked={groupByDomain} onChange={() => setGroupByDomain((v) => !v)} />
                           Group by domain
                        </label>
                        <SearchBar value={search} onChange={setSearch} placeholder="Search" width={220} />
                     </div>
                  </div>

                  {/* Table */}
                  {pending ? (
                     <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 24 }}><SkeletonRows count={8} withIcon /></div>
                  ) : (
                     <SourcesTable
                        sources={filtered}
                        grouped={groupByDomain}
                        modelLabel={AI_VIS_MODEL_LABEL}
                        onSelect={(list, index, navigable) => setModal({ list, index, navigable })}
                     />
                  )}

                  {modal && (
                     <SourceDetailModal
                        slug={slug}
                        list={modal.list}
                        index={modal.index}
                        navigable={modal.navigable}
                        onNavigate={navigateModal}
                        onClose={() => setModal(null)}
                     />
                  )}
               </div>
            );
         }}
      </AiVisPageShell>
   );
};

export default AiVisibilitySources;
