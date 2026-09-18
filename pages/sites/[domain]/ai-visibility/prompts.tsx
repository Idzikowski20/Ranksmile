import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { AI_VIS_MODEL_LABEL } from '@/src/core/domain/aiVisibility/config';
import AiVisPageShell from '../../../../components/aiVisibility/AiVisPageShell';
import PromptTopicsTable, { TopicRow } from '../../../../components/aiVisibility/PromptTopicsTable';
import { SkeletonRows, SkeletonBox } from '../../../../components/aiVisibility/SkeletonBlocks';
import { HoverTooltip, Button } from '../../../../components/koala/core';
import { useAiVisPromptTopics, useAiVisData } from '../../../../services/aiVisibility';
import { InfoIcon } from '../../../../components/common/inlineIcons';

const FONT = 'var(--font-family-primary)';

type PromptRowRaw = { id: number; topic: string; text: string; perModel: Array<{ model: string }> };
type PromptsData = { pending?: boolean; prompts?: PromptRowRaw[] };

const PlusIcon = () => (<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M13 5a1 1 0 1 0-2 0v6H5a1 1 0 1 0 0 2h6v6a1 1 0 1 0 2 0v-6h6a1 1 0 1 0 0-2h-6z" /></svg>);

const CARD_3D: React.CSSProperties = { border: '1px solid #dbded4', borderRadius: 12, background: '#fff' };

const StatCard = ({ label, value, hint, pending }: { label: string; value: string; hint: string; pending: boolean }) => (
   <section style={{ ...CARD_3D, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#71717B', fontFamily: FONT }}>
         {label}
         <HoverTooltip label={hint} align="center"><span style={{ display: 'inline-flex', cursor: 'help' }}><InfoIcon /></span></HoverTooltip>
      </span>
      {pending ? <SkeletonBox w={56} h={26} /> : <span style={{ fontSize: 20, fontWeight: 700, color: '#18181B', fontFamily: FONT }}>{value}</span>}
   </section>
);

const AiVisibilityPrompts: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const manageUrl = `/sites/${slug}/ai-visibility/manage`;

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

   const topicsQ = useAiVisPromptTopics(slug, { prompts: promptSel, models: modelSel });
   const topics: TopicRow[] = useMemo(() => topicsQ.data?.topics || [], [topicsQ.data]);
   const ov = topicsQ.data?.overview;

   const manageBtn = (
      <Button type="button" variant="primary" size="sm" onClick={() => router.push(manageUrl)}>Manage Prompts</Button>
   );

   return (
      <AiVisPageShell
         section="AI Visibility"
         title="Prompts"
         titleActions={manageBtn}
         toolbarPrompts={promptOptions}
         toolbarPromptSelected={promptSel}
         onToolbarPromptChange={setPromptSel}
         toolbarModels={modelKeys}
         toolbarModelSelected={modelSel}
         onToolbarModelChange={setModelSel}
         toolbarModelLabel={AI_VIS_MODEL_LABEL}
      >
         {({ crunching }) => {
            const pending = crunching || topicsQ.isLoading || !!topicsQ.data?.pending
               || topicsQ.isFetching;
            return (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                     <StatCard label="Visibility score" value={String(ov?.visibilityScore ?? 0)} hint="Your average visibility across all tracked prompts and models" pending={pending} />
                     <StatCard label="Mention rate" value={`${ov?.mentionRate ?? 0}%`} hint="Share of prompt/model answers that name your brand" pending={pending} />
                     <StatCard label="Average position" value={ov?.avgPosition != null ? ov.avgPosition.toFixed(1) : '—'} hint="How early your brand appears in the answers that name it" pending={pending} />
                  </div>

                  {pending ? (
                     <div style={{ padding: 24 }}><SkeletonRows count={6} /></div>
                  ) : (
                     <>
                        <PromptTopicsTable topics={topics} />
                        <div>
                           <Button type="button" variant="primary" size="sm" icon={<PlusIcon />} onClick={() => router.push(manageUrl)}>
                              Add prompt
                           </Button>
                        </div>
                     </>
                  )}
               </div>
            );
         }}
      </AiVisPageShell>
   );
};

export default AiVisibilityPrompts;
