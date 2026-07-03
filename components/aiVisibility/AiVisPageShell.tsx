import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppShell from '../common/AppShell';
import DomainSubLayout from '../domains/DomainSubLayout';
import AiVisibilityToolbar from './AiVisibilityToolbar';
import { PromptOption } from './PromptPicker';
import AiVisExportMenu from './AiVisExportMenu';
import CrunchingBar from './CrunchingBar';
import { SkeletonBars } from './SkeletonBlocks';
import { useAiVisibilityGuard } from '../../lib/useAiVisibilityGuard';
import { useAiVisScanStatus } from '../../services/aiVisibility';
import { useFetchDomains } from '../../services/domains';
import { slugToDomain } from '../../utils/slugToDomain';

const FONT = 'var(--font-family-primary)';

const InfoIcon = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: '#9F9FA9', flexShrink: 0 }}>
      <path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

/**
 * Shared chrome for every AI Visibility sub-page: AppShell + breadcrumb + guard
 * (redirect to setup if unconfigured) + sticky title row (Export/Share) + toolbar
 * + persistent "Crunching data…" bar while a scan runs. `children` receives the
 * crunching flag so pages can keep showing skeletons during the first scan.
 */
const AiVisPageShell = ({ section, title, compareCompetitors, compareSelected = null, onCompareSelect, toolbarPrompts, toolbarPromptSelected, onToolbarPromptChange, toolbarModels, toolbarModelSelected, onToolbarModelChange, toolbarModelLabel, toolbarTrailing, children }: {
   section: string;
   title: string;
   // The page owns Compare state (it drives page-level queries) and hands it down
   // so the shared toolbar's "Compare" slot reflects it. Omitted → static button.
   compareCompetitors?: Array<{ domain: string }>;
   compareSelected?: string | null;
   onCompareSelect?: (d: string | null) => void;
   toolbarPrompts?: PromptOption[]; // makes "All prompts" a grouped multiselect
   toolbarPromptSelected?: number[]; // controlled selection (empty == all)
   onToolbarPromptChange?: (ids: number[]) => void;
   toolbarModels?: string[]; // available model keys → "All models" becomes a real multiselect
   toolbarModelSelected?: string[];
   onToolbarModelChange?: (m: string[]) => void;
   toolbarModelLabel?: Record<string, string>;
   toolbarTrailing?: React.ReactNode; // rendered after "All models" in the toolbar (e.g. Refresh data)
   children: (ctx: { crunching: boolean }) => React.ReactNode;
}) => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';
   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];

   const { ready } = useAiVisibilityGuard(slug);
   const { data: scan } = useAiVisScanStatus(ready ? slug : undefined);
   const crunching = scan?.status === 'queued' || scan?.status === 'running';

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>{`${title} — ${domain}`}</title></Head>
         <style>{'@keyframes aivPulse{0%,100%{opacity:1}50%{opacity:.5}}.aiv-pulse{animation:aivPulse 1.5s ease-in-out infinite}@keyframes aivSpin{to{transform:rotate(360deg)}}'}</style>
         <DomainSubLayout domain={domain} slug={slug || ''} section={section} contentMaxWidth="100%">
            {/* Sticky page title row */}
            <div style={{ position: 'sticky', top: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#fff', paddingBottom: 16, marginBottom: 4 }}>
               <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#09090B', fontFamily: FONT }}>{title}</span>
                  <InfoIcon />
               </span>
               <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AiVisExportMenu slug={slug} />
                  <button type="button" style={{ border: 'none', borderRadius: 8, padding: '7px 16px', background: '#18181B', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>Share</button>
               </div>
            </div>

            <AiVisibilityToolbar
               compareCompetitors={compareCompetitors}
               compareSelected={compareSelected}
               onCompareSelect={onCompareSelect}
               prompts={toolbarPrompts}
               promptSelected={toolbarPromptSelected}
               onPromptChange={onToolbarPromptChange}
               models={toolbarModels}
               modelSelected={toolbarModelSelected}
               onModelChange={onToolbarModelChange}
               modelLabel={toolbarModelLabel}
               trailing={toolbarTrailing}
            />

            <div style={{ marginTop: 24 }}>
               {ready ? children({ crunching: !!crunching }) : <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 24 }}><SkeletonBars /></div>}
            </div>
         </DomainSubLayout>
         <CrunchingBar visible={!!crunching} />
      </AppShell>
   );
};

export default AiVisPageShell;
