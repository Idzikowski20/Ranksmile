import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppShell from '../common/AppShell';
import DomainSubLayout from '../domains/DomainSubLayout';
import AiVisibilityToolbar from './AiVisibilityToolbar';
import AiVisExportMenu from './AiVisExportMenu';
import CrunchingBar from './CrunchingBar';
import { SkeletonBars } from './SkeletonBlocks';
import { Button, ToolRibbon } from '../core';
import type { PromptOption } from './types';
import { useAiVisibilityGuard } from '../../lib/useAiVisibilityGuard';
import { useAiVisScanStatus } from '../../services/aiVisibility';
import { useFetchDomains } from '../../services/domains';
import { slugToDomain } from '../../utils/slugToDomain';

/**
 * Shared chrome for AI Visibility sub-pages — Sentry Issues/Discover pattern:
 * SentryPageHeader (title + actions) → ToolRibbon (PageFilterBar + trailing) → content.
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

  const { ready } = useAiVisibilityGuard(slug);
  const { data: scan } = useAiVisScanStatus(ready ? slug : undefined);
  const crunching = scan?.status === 'queued' || scan?.status === 'running';

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
        {ready ? children({ crunching: !!crunching }) : (
          loadingFallback ?? (
            <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 24 }}>
              <SkeletonBars />
            </div>
          )
        )}
      </DomainSubLayout>

      <CrunchingBar visible={!!crunching} />
    </AppShell>
  );
};

export default AiVisPageShell;
