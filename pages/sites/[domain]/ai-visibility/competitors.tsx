import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import AiVisPageShell from '../../../../components/aiVisibility/AiVisPageShell';
import CompetitorsTable, { CompetitorRow } from '../../../../components/aiVisibility/CompetitorsTable';
import CompetitorDetailModal from '../../../../components/aiVisibility/CompetitorDetailModal';
import { SkeletonRows } from '../../../../components/aiVisibility/SkeletonBlocks';
import { useAiVisCompetitors, useAiVisData } from '../../../../services/aiVisibility';
import { AI_VIS_MODEL_LABEL } from '../../../../lib/aiVisibility';

type PromptRow = { id: number; topic: string; text: string; perModel: Array<{ model: string }> };
type PromptsData = { pending?: boolean; prompts?: PromptRow[] };

const AiVisibilityCompetitors: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };

   const [promptSel, setPromptSel] = useState<number[]>([]);
   const [modelSel, setModelSel] = useState<string[]>([]);
   const [modalIndex, setModalIndex] = useState<number | null>(null);

   const promptsQ = useAiVisData<PromptsData>(slug, 'prompts');
   const promptOptions = useMemo(
      () => (promptsQ.data?.prompts || []).map((p) => ({ id: p.id, text: p.text, topic: p.topic })),
      [promptsQ.data],
   );
   const modelKeys = useMemo(
      () => Array.from(new Set((promptsQ.data?.prompts || []).flatMap((p) => p.perModel.map((m) => m.model)))),
      [promptsQ.data],
   );

   const competitorsQ = useAiVisCompetitors(slug, { prompts: promptSel, models: modelSel });
   const competitors: CompetitorRow[] = useMemo(() => competitorsQ.data?.competitors || [], [competitorsQ.data]);
   const domains = useMemo(() => competitors.map((c) => c.domain), [competitors]);

   const navigateModal = (delta: number) => {
      setModalIndex((i) => (i == null ? i : Math.max(0, Math.min(domains.length - 1, i + delta))));
   };

   return (
      <AiVisPageShell
         section="AI Visibility"
         title="Competitors"
         toolbarPrompts={promptOptions}
         toolbarPromptSelected={promptSel}
         onToolbarPromptChange={setPromptSel}
         toolbarModels={modelKeys}
         toolbarModelSelected={modelSel}
         onToolbarModelChange={setModelSel}
         toolbarModelLabel={AI_VIS_MODEL_LABEL}
      >
         {({ crunching }) => {
            const pending = crunching || competitorsQ.isLoading || !!competitorsQ.data?.pending
               || (competitorsQ.isFetching && competitors.length === 0);
            return (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {pending ? (
                     <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 24 }}><SkeletonRows count={10} withIcon /></div>
                  ) : (
                     <CompetitorsTable
                        competitors={competitors}
                        onSelect={(d) => setModalIndex(domains.indexOf(d))}
                     />
                  )}

                  {modalIndex != null && domains[modalIndex] && (
                     <CompetitorDetailModal
                        slug={slug}
                        list={domains}
                        index={modalIndex}
                        onNavigate={navigateModal}
                        onClose={() => setModalIndex(null)}
                     />
                  )}
               </div>
            );
         }}
      </AiVisPageShell>
   );
};

export default AiVisibilityCompetitors;
