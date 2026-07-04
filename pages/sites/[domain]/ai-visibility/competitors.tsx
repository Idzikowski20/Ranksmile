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
   const [modalDomain, setModalDomain] = useState<string | null>(null);

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

   // Resolve the open competitor by domain against the current list so re-sorting or
   // re-fetching the list can never make the modal jump to a different row.
   const modalIndex = modalDomain == null ? -1 : domains.indexOf(modalDomain);

   const navigateModal = (delta: number) => {
      if (modalIndex < 0) return;
      const next = Math.max(0, Math.min(domains.length - 1, modalIndex + delta));
      setModalDomain(domains[next]);
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
                        onSelect={setModalDomain}
                     />
                  )}

                  {modalIndex >= 0 && (
                     <CompetitorDetailModal
                        slug={slug}
                        list={domains}
                        index={modalIndex}
                        onNavigate={navigateModal}
                        onClose={() => setModalDomain(null)}
                     />
                  )}
               </div>
            );
         }}
      </AiVisPageShell>
   );
};

export default AiVisibilityCompetitors;
