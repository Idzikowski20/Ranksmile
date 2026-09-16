import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAiVisibilityGuard } from '@/hooks/useAiVisibilityGuard';
import { deriveActiveId, workspaceHref } from '@/src/core/domain/navigation/activeWorkspace';
import AppShell from '../common/AppShell';
import DomainSubLayout from '../domains/DomainSubLayout';
import AiVisibilityToolbar from './AiVisibilityToolbar';
import AiVisExportMenu from './AiVisExportMenu';
import ScanProgressBar, { isScanBusy } from './ScanProgressBar';
import { SkeletonBars } from './SkeletonBlocks';
import { Button, ToolRibbon } from '../koala/core';
import type { PromptOption } from './types';
import { useAiVisScanStatus } from '../../services/aiVisibility';
import { useFetchDomains } from '../../services/domains';
import { useWorkspaces } from '../../services/workspaces';
import { useDomainBusy } from '../../services/domainPipeline';
import DomainBusyNotice from '../dashboard/DomainBusyNotice';
import { slugToDomain } from '../../utils/slugToDomain';

/**
 * Shared chrome for AI Visibility sub-pages — Koala Issues/Discover pattern:
 * KoalaPageHeader (title + actions) → ToolRibbon (PageFilterBar + trailing) → content.
 */
const AiVisPageShell = ({
  section,
  title,
  titleActions,
  compareCompetitors,
  compareSelected = null,
  onCompareSelect,
  toolbarPrompts,
  toolbarPromptSelected,
  onToolbarPromptChange,
  toolbarModels,
  toolbarModelSelected,
  onToolbarModelChange,
  toolbarModelLabel,
  toolbarTrailing,
  loadingFallback,
  children,
}: {
  section: string;
  title: string;
  titleActions?: React.ReactNode;
  compareCompetitors?: Array<{ domain: string }>;
  compareSelected?: string | null;
  onCompareSelect?: (d: string | null) => void;
  toolbarPrompts?: PromptOption[];
  toolbarPromptSelected?: number[];
  onToolbarPromptChange?: (ids: number[]) => void;
  toolbarModels?: string[];
  toolbarModelSelected?: string[];
  onToolbarModelChange?: (m: string[]) => void;
  toolbarModelLabel?: Record<string, string>;
  toolbarTrailing?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  children: (ctx: { crunching: boolean }) => React.ReactNode;
}) => {
  const router = useRouter();
  const { domain: slug } = router.query as { domain: string };
  const domain = slug ? slugToDomain(slug) : '';
  const { data: domainsData } = useFetchDomains(router, true);
  const domains = domainsData?.domains || [];
  const { data: wsData } = useWorkspaces();
  const dashboardHref = workspaceHref(deriveActiveId(true, router.asPath, wsData?.activeId), '/dashboard');

  const { ready } = useAiVisibilityGuard(slug);
  // The setup pipeline rewrites the domain tables this page reads; wait it out.
  const busy = useDomainBusy(slug);
  const { data: scan } = useAiVisScanStatus(ready ? slug : undefined);
  // Sources/brands/profiles are drained after the scan row says `completed`, so the bar
  // must outlive that flip — isScanBusy covers every outstanding phase.
  const crunching = isScanBusy(scan);

  const headerActions = (
    <>
      {titleActions}
      <AiVisExportMenu slug={slug} />
      <Button variant="primary" size="sm">Share</Button>
    </>
  );

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head><title>{`${title} — ${domain}`}</title></Head>
      <style>{'@keyframes aivPulse{0%,100%{background-color:#E4E4E7}50%{background-color:#D4D4D8}}.aiv-pulse{animation:aivPulse 1.5s ease-in-out infinite;background-color:#E4E4E7;box-shadow:inset 0 0 0 1px #D4D4D8}@keyframes aivSpin{to{transform:rotate(360deg)}}'}</style>

      <DomainSubLayout
        domain={domain}
        slug={slug || ''}
        section={section}
        heading={title}
        actions={headerActions}
        contentMaxWidth="100%"
        filters={(
          <ToolRibbon>
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
          </ToolRibbon>
        )}
      >
        {busy ? <DomainBusyNotice dashboardHref={dashboardHref} /> : ready ? children({ crunching: !!crunching }) : (
          loadingFallback ?? (
            <div style={{ borderRadius: 12, padding: 24, background: '#fff' }}>
              <SkeletonBars />
            </div>
          )
        )}
      </DomainSubLayout>

      <ScanProgressBar visible={!busy && !!crunching} scan={scan} />
    </AppShell>
  );
};

export default AiVisPageShell;
