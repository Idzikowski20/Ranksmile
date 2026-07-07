import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import AiVisPageShell from '../../../../components/aiVisibility/AiVisPageShell';
import FanoutTable from '../../../../components/aiVisibility/FanoutTable';
import AiVisDetailModal from '../../../../components/aiVisibility/AiVisDetailModal';
import { FanoutPageSkeleton } from '../../../../components/aiVisibility/SkeletonBlocks';
import { SearchBar, SegmentedControl, Button } from '../../../../components/core';
import { useAiVisData, useAiVisFanout, type FanoutByQueryRow, type FanoutByPromptRow } from '../../../../services/aiVisibility';
import { AI_VIS_MODEL_LABEL } from '../../../../lib/aiVisibility';

const FONT = 'var(--font-family-primary)';

type PromptRowRaw = { id: number; topic: string; text: string; perModel: Array<{ model: string }> };
type PromptsData = { pending?: boolean; prompts?: PromptRowRaw[] };

// Contract shared with the parallel-built modal.
type AiVisDetailItem = { promptId?: number; query?: string; title: string };
type GroupBy = 'fanout' | 'prompt';

const RobotEmpty = ({ title, hint }: { title: string; hint: string }) => (
   <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: '#fff' }}>
      <style>{'@keyframes aivBlink{0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(0.1)}}'}</style>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
         <rect x="10" y="16" width="28" height="22" rx="6" fill="#F4F4F5" stroke="#E4E4E7" strokeWidth="2" />
         <rect x="22.5" y="7" width="3" height="7" rx="1.5" fill="#D4D4D8" />
         <circle cx="24" cy="7" r="2.5" fill="#9F9FA9" />
         <g style={{ transformOrigin: '18px 26px', animation: 'aivBlink 3s ease-in-out infinite' }}><circle cx="18" cy="26" r="3" fill="#71717B" /></g>
         <g style={{ transformOrigin: '30px 26px', animation: 'aivBlink 3s ease-in-out infinite' }}><circle cx="30" cy="26" r="3" fill="#71717B" /></g>
         <path d="M19 32h10" stroke="#9F9FA9" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{title}</span>
      <span style={{ fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>{hint}</span>
   </div>
);

const AiVisibilityFanoutQueries: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };

   const [promptSel, setPromptSel] = useState<number[]>([]);
   const [modelSel, setModelSel] = useState<string[]>([]);
   const [groupBy, setGroupBy] = useState<GroupBy>('fanout');
   const [search, setSearch] = useState('');
   const [dir, setDir] = useState<'asc' | 'desc'>('desc');
   const [open, setOpen] = useState<{ kind: 'prompt' | 'fanout'; index: number } | null>(null);

   // Filter OPTIONS (prompt + model), same source as prompts.tsx.
   const promptsQ = useAiVisData<PromptsData>(slug, 'prompts');
   const promptOptions = useMemo(
      () => (promptsQ.data?.prompts || []).map((p) => ({ id: p.id, text: p.text, topic: p.topic })),
      [promptsQ.data],
   );
   const modelKeys = useMemo(
      () => Array.from(new Set((promptsQ.data?.prompts || []).flatMap((p) => p.perModel.map((m) => m.model)))),
      [promptsQ.data],
   );

   const fanoutQ = useAiVisFanout(slug, { prompts: promptSel, models: modelSel });

   return (
      <AiVisPageShell
         section="AI Visibility"
         title="Fanout Queries"
         toolbarPrompts={promptOptions}
         toolbarPromptSelected={promptSel}
         onToolbarPromptChange={setPromptSel}
         toolbarModels={modelKeys}
         toolbarModelSelected={modelSel}
         onToolbarModelChange={setModelSel}
         toolbarModelLabel={AI_VIS_MODEL_LABEL}
         loadingFallback={<FanoutPageSkeleton />}
      >
         {({ crunching }) => {
            const pending = crunching || fanoutQ.isLoading || fanoutQ.isFetching || !!fanoutQ.data?.pending;
            const data = fanoutQ.data;
            const commonPhrases = data?.commonPhrases || [];
            const q = search.trim().toLowerCase();

            // Filter + sort the parent rows for the active group. This is the single
            // source of truth: the table renders these in order, and modal `items`
            // are mapped from the same array so `index` lines up. Plain consts (not
            // useMemo) because we're inside the shell's render-prop callback.
            const byTimes = (a: { timesShown: number }, b: { timesShown: number }) => (dir === 'asc' ? a.timesShown - b.timesShown : b.timesShown - a.timesShown);
            const fanoutBase = data?.groupByFanout || [];
            const fanoutRows: FanoutByQueryRow[] = [...(q ? fanoutBase.filter((r) => r.query.toLowerCase().includes(q)) : fanoutBase)].sort(byTimes);
            const promptBase = data?.groupByPrompt || [];
            const promptRows: FanoutByPromptRow[] = [...(q ? promptBase.filter((r) => r.text.toLowerCase().includes(q)) : promptBase)].sort(byTimes);

            const rows = groupBy === 'fanout' ? fanoutRows : promptRows;
            const items: AiVisDetailItem[] = groupBy === 'fanout'
               ? fanoutRows.map((r) => ({ query: r.query, title: r.query }))
               : promptRows.map((r) => ({ promptId: r.id, title: r.text }));

            const toggleSort = () => setDir((d) => (d === 'asc' ? 'desc' : 'asc'));

            if (pending) {
               return <FanoutPageSkeleton />;
            }

            return (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Common phrases */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                     <span style={{ fontSize: 15, fontWeight: 600, color: '#3F3F47', fontFamily: FONT }}>Common phrases</span>
                     {commonPhrases.length === 0 ? (
                        <span style={{ fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>No common phrases yet.</span>
                     ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                           {commonPhrases.map((p) => (
                              <Button
                                 key={p.phrase}
                                 type="button"
                                 variant="secondary"
                                 size="sm"
                                 onClick={() => setSearch(p.phrase)}
                                 style={{ borderRadius: 9999, background: '#F4F4F5', border: 'none', gap: 6 }}
                              >
                                 <span>{p.phrase}</span>
                                 <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999, background: '#fff', color: '#71717B', fontSize: 12, fontWeight: 600 }}>{p.count}</span>
                              </Button>
                           ))}
                        </div>
                     )}
                  </div>

                  {/* Controls: search (left) + group-by segmented control (right) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                     <SearchBar value={search} onChange={setSearch} placeholder="Search queries…" width={250} />
                     <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: '#71717B', fontFamily: FONT }}>Group by</span>
                        <SegmentedControl
                           size="sm"
                           name="fanout-group-by"
                           value={groupBy}
                           onChange={setGroupBy}
                           options={[
                              { value: 'fanout', label: 'Fanout' },
                              { value: 'prompt', label: 'Prompt' },
                           ]}
                        />
                     </div>
                  </div>

                  {/* Table / empty */}
                  {rows.length === 0 ? (
                     <RobotEmpty title="No fanout queries found" hint="Try changing the filters" />
                  ) : (
                     <FanoutTable group={groupBy} rows={rows} dir={dir} onToggleSort={toggleSort} onOpenRow={(index) => setOpen({ kind: groupBy, index })} />
                  )}

                  {open && items[open.index] && (
                     <AiVisDetailModal
                        slug={slug}
                        kind={open.kind}
                        items={items}
                        index={open.index}
                        onNavigate={(nextIndex) => setOpen({ kind: open.kind, index: nextIndex })}
                        onClose={() => setOpen(null)}
                     />
                  )}
               </div>
            );
         }}
      </AiVisPageShell>
   );
};

export default AiVisibilityFanoutQueries;
