import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import AiVisPageShell from '../../../../components/aiVisibility/AiVisPageShell';
import SourcesTable, { SourceRow } from '../../../../components/aiVisibility/SourcesTable';
import SourceDetailModal from '../../../../components/aiVisibility/SourceDetailModal';
import { SkeletonRows, SkeletonBox } from '../../../../components/aiVisibility/SkeletonBlocks';
import HoverTooltip from '../../../../components/common/HoverTooltip';
import { Toggle, SearchBar } from '../../../../components/ui';
import { useAiVisData } from '../../../../services/aiVisibility';
import { AI_VIS_MODEL_LABEL } from '../../../../lib/aiVisibility';

const FONT = 'var(--font-family-primary)';

type SourcesData = { pending?: boolean; sources?: SourceRow[] };
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
   const sourcesQ = useAiVisData<SourcesData>(slug, 'sources');
   const [groupByDomain, setGroupByDomain] = useState(false);
   const [search, setSearch] = useState('');
   const [modal, setModal] = useState<ModalState | null>(null);

   const sources = useMemo(() => sourcesQ.data?.sources || [], [sourcesQ.data]);
   const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return sources;
      return sources.filter((s) => s.url.toLowerCase().includes(q) || s.domain.toLowerCase().includes(q));
   }, [sources, search]);

   const domainCount = useMemo(() => new Set(sources.map((s) => s.domain)).size, [sources]);
   const referenceCount = useMemo(() => sources.reduce((acc, s) => acc + s.timesShown, 0), [sources]);

   const navigateModal = (delta: number) => {
      setModal((m) => {
         if (!m) return m;
         const next = Math.max(0, Math.min(m.list.length - 1, m.index + delta));
         return { ...m, index: next };
      });
   };

   return (
      <AiVisPageShell section="AI Visibility" title="Sources">
         {({ crunching }) => {
            const pending = crunching || sourcesQ.isLoading || !!sourcesQ.data?.pending;
            return (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                     <StatCard label="Domains" value={fmtK(domainCount)} hint="Distinct domains cited across your tracked prompts" pending={pending} />
                     <StatCard label="URLs" value={fmtK(sources.length)} hint="Unique pages cited by the AI engines" pending={pending} />
                     <StatCard label="References" value={fmtK(referenceCount)} hint="Total citations across all AI answers" pending={pending} />
                  </div>

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
