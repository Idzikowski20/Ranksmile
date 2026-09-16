import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { deriveActiveId, resolveActiveDomain } from '@/src/core/domain/navigation/activeWorkspace';
import { useWorkspaces } from '../../services/workspaces';
import { useRunSetup, useSetupStatus } from '../../services/domainPipeline';
import DomainSetupProgressBar from './DomainSetupProgressBar';

/**
 * The domain-analysis pill on every page of the shell, not only the dashboard: the
 * analysis keeps running in the background, so its progress (and its Retry) follow the
 * user wherever they go. Kicking the job stays with the dashboard; this only watches.
 */
export default function DomainSetupWatcher({ domains }: { domains: DomainType[] }) {
  const router = useRouter();
  const { data: wsData } = useWorkspaces();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const activeWsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const activeWorkspace = wsData?.workspaces?.find((w) => w.id === activeWsId) ?? null;
  const slug = resolveActiveDomain(domains, activeWsId, activeWorkspace?.domain)?.slug ?? null;

  const { data: setup } = useSetupStatus(slug);
  const runSetup = useRunSetup();
  return <DomainSetupProgressBar setup={setup} onRetry={() => { if (slug) runSetup.mutate(slug); }} />;
}
