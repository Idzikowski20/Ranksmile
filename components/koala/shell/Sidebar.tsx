import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import { useWorkspaces } from '../../../services/workspaces';
import { deriveActiveId, resolveActiveDomain, workspaceHref } from '../../../lib/activeWorkspace';
import fetchJson from '../../../lib/fetchJson';
import { countActionableRecommendations, type RecFilterable } from '../../../lib/recommendations';
import { AI_VISIBILITY_NAV, resolveSiteNav, SEO_NAV, TOOLS_NAV } from '../../../lib/navigation';
import { SidebarItem, SidebarBlock } from './SidebarItem';
import WorkspaceSelect from './WorkspaceSelect';
import SidebarPlanItem from './SidebarPlanItem';

type Props = {
  domains?: DomainType[];
  onNavigate?: () => void;
};

const SEO_ICONS: Record<string, string> = {
  performance: 'ChartLineUp',
  'site-audit': 'MagnifyingGlass',
  recommendations: 'Fire',
  'content-audit': 'Files',
  'keyword-list': 'ListBullets',
  'keyword-tracking': 'Crosshair',
  'activity-log': 'ClockCounterClockwise',
  automations: 'CalendarBlank',
};

function pathOnly(asPath: string): string {
  return (asPath.split('?')[0] || '').split('#')[0];
}

function matchPath(path: string, match: string): boolean {
  return path === match || path.startsWith(`${match}/`) || path.includes(match);
}

/**
 * Product Sidebar — Figma `4903:6905` (228px).
 * Full-width org switcher; Ranksmile routes; thin icons.
 */
export default function KoalaSidebar({ domains = [], onNavigate }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { data: wsData } = useWorkspaces();
  const activeId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const activeWorkspace = (wsData?.workspaces || []).find((w) => w.id === activeId) ?? null;
  const activeSlug = useMemo(() => {
    const resolved = resolveActiveDomain(domains, activeId, activeWorkspace?.domain);
    return resolved?.slug ?? domains[0]?.slug ?? null;
  }, [activeId, activeWorkspace, domains]);

  const path = mounted ? pathOnly(router.asPath) : '';
  const ws = (p: string) => workspaceHref(activeId, p);

  const onAiVis = path.includes('/ai-visibility');
  const [deferRecs, setDeferRecs] = useState(false);
  useEffect(() => {
    if (!onAiVis) { setDeferRecs(false); return undefined; }
    setDeferRecs(true);
    const t = window.setTimeout(() => setDeferRecs(false), 2500);
    return () => window.clearTimeout(t);
  }, [onAiVis]);

  const { data: domainRecsData } = useQuery(
    ['domainRecs', activeSlug],
    () => fetchJson(`/api/domains/${activeSlug}/recommendations`, { recommendations: [] as RecFilterable[] }),
    { enabled: Boolean(activeSlug) && !deferRecs, staleTime: 60_000 },
  );
  const recCount = countActionableRecommendations(domainRecsData?.recommendations ?? []);

  const seoResolved = activeSlug
    ? resolveSiteNav(SEO_NAV, activeSlug, (full) => workspaceHref(activeId, full))
    : [];
  const aiResolved = activeSlug
    ? resolveSiteNav(AI_VISIBILITY_NAV, activeSlug, (full) => workspaceHref(activeId, full))
    : [];
  const toolsResolved = activeSlug
    ? resolveSiteNav(TOOLS_NAV, activeSlug, (full) => workspaceHref(activeId, full))
    : [];

  return (
    <aside className="koala-sidebar" aria-label="Main navigation">
      <div className="koala-sidebar__header">
        <WorkspaceSelect />
      </div>

      <nav className="koala-sidebar__nav styled-scrollbar">
        <SidebarBlock title="Workspace">
          <SidebarItem
            href={ws('/dashboard')}
            label="Dashboard"
            icon="House"
            active={matchPath(path, '/dashboard') || path === '/' || /\/workspace\/\d+\/?$/.test(path)}
            onClick={onNavigate}
          />
          <SidebarItem
            href={ws('/articles')}
            label="Content"
            icon="Article"
            active={matchPath(path, '/articles')}
            onClick={onNavigate}
          />
        </SidebarBlock>

        {activeSlug ? (
          <>
            <SidebarBlock title="SEO">
              {seoResolved.map((item) => (
                <SidebarItem
                  key={item.id}
                  href={item.href}
                  label={item.label}
                  icon={SEO_ICONS[item.id] ?? 'Circle'}
                  active={path.includes(item.match)}
                  badge={item.id === 'recommendations' && recCount > 0 ? recCount : undefined}
                  onClick={onNavigate}
                />
              ))}
            </SidebarBlock>

            <SidebarBlock title="AI Visibility">
              {aiResolved.map((item) => (
                <SidebarItem
                  key={item.id}
                  href={item.href}
                  label={item.label}
                  icon="Sparkle"
                  active={path.includes(item.match)}
                  onClick={onNavigate}
                />
              ))}
            </SidebarBlock>

            <SidebarBlock title="Tools">
              {toolsResolved.map((item) => (
                <SidebarItem
                  key={item.id}
                  href={item.href}
                  label={item.label}
                  icon={item.id === 'keyword-research' ? 'MagnifyingGlass' : 'Tree'}
                  active={path.includes(item.match)}
                  onClick={onNavigate}
                />
              ))}
            </SidebarBlock>
          </>
        ) : null}
      </nav>

      <div className="koala-sidebar__footer">
        <SidebarPlanItem onNavigate={onNavigate} />
      </div>
    </aside>
  );
}
