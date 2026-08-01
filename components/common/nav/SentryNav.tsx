import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import { useWorkspaces } from '../../../services/workspaces';
import { deriveActiveId, resolveActiveDomain, workspaceHref } from '../../../lib/activeWorkspace';
import fetchJson from '../../../lib/fetchJson';
import { countActionableRecommendations } from '../../../lib/recommendations';
import { AI_VISIBILITY_NAV, AUDIT_URL_PATH, resolveSiteNav, SEO_NAV, TOOLS_NAV } from '../../../lib/navigation';
import {
  IconDashboard, IconIssues, IconCompass, IconSiren, IconSettings, IconTools,
  IconFire, IconChevron,
} from './sentryIcons';
import SentryNavFooter from './SentryNavFooter';


type Props = {
  domains?: DomainType[];
};

type SecondaryLink = { label: string; href: string; match: string };
type PrimaryItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  match: string;
  secondary?: { title: string; sections: { label?: string; links: SecondaryLink[] }[] };
};

const useLocalStorage = <T, >(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void, boolean] => {
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) setValue(JSON.parse(stored) as T);
    } catch { /* ignore JSON/storage errors */ }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore storage errors */ }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated];
};

/* ─── Main component ─────────────────────────────────────────────────────── */
const SentryNav = ({ domains = [] }: Props) => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [docked, setDocked, dockedReady] = useLocalStorage('ranksmile-nav-docked', true);
  const [pinnedKey, setPinnedKey, pinnedReady] = useLocalStorage<string | null>('ranksmile-nav-pinned-key', null);
  const navReady = dockedReady && pinnedReady;
  const isDocked = navReady && docked;

  const { data: wsData } = useWorkspaces();

  const activeId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const activeWorkspace = (wsData?.workspaces || []).find((w) => w.id === activeId) ?? null;
  const activeSlug = useMemo(() => {
    const resolved = resolveActiveDomain(domains, activeId, activeWorkspace?.domain);
    return resolved?.slug ?? domains[0]?.slug ?? null;
  }, [activeId, activeWorkspace, domains]);

  // Recommendations count (flame badge) — shares the checklist's query key.
  // Defer on AI Vis so overview/history aren't starved on Neon.
  const onAiVis = router.asPath.includes('/ai-visibility');
  const [deferRecs, setDeferRecs] = useState(false);
  useEffect(() => {
    if (!onAiVis) { setDeferRecs(false); return undefined; }
    setDeferRecs(true);
    const t = window.setTimeout(() => setDeferRecs(false), 2500);
    return () => window.clearTimeout(t);
  }, [onAiVis]);
  const { data: domainRecsData } = useQuery(
    ['domainRecs', activeSlug],
    () => fetchJson(`/api/domains/${activeSlug}/recommendations`, { recommendations: [] as Array<{ type?: string | null; score?: number | null }> }),
    { enabled: !!activeSlug && !deferRecs, staleTime: 5 * 60 * 1000, retry: false },
  );
  const recCount = useMemo(
    () => countActionableRecommendations(domainRecsData?.recommendations ?? []),
    [domainRecsData],
  );

  // Active-state helpers
  const path = mounted ? router.asPath.split('?')[0].split('#')[0].replace(/\/$/, '') : '';
  const isMatch = (suffix: string, exact = false) => {
    if (!mounted) return false;
    return exact ? path.endsWith(suffix) : path.includes(suffix);
  };

  const primaryItems: PrimaryItem[] = useMemo(() => {
    const items: PrimaryItem[] = [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <IconDashboard />,
        href: workspaceHref(activeId, '/dashboard'),
        match: '/dashboard',
      },
      {
        key: 'content',
        label: 'Content',
        icon: <IconIssues />,
        href: workspaceHref(activeId, '/articles'),
        match: '/articles',
      },
    ];
    if (activeSlug) {
      const hrefFn = (p: string) => workspaceHref(activeId, p);
      const seoLinks = resolveSiteNav(SEO_NAV, activeSlug, hrefFn);
      const aiLinks = resolveSiteNav(AI_VISIBILITY_NAV, activeSlug, hrefFn);
      const toolsLinks = resolveSiteNav(TOOLS_NAV, activeSlug, hrefFn);
      items.push({
        key: 'seo',
        label: 'SEO',
        icon: <IconCompass />,
        href: seoLinks[0]?.href ?? workspaceHref(activeId, `/sites/${activeSlug}/performance`),
        match: `/sites/${activeSlug}`,
        secondary: {
          title: 'SEO',
          sections: [{
            links: seoLinks.map(({ label, href, match }) => ({ label, href, match })),
          }],
        },
      });
      items.push({
        key: 'aivis',
        label: 'AI Vis',
        icon: <IconSiren />,
        href: aiLinks[0]?.href ?? workspaceHref(activeId, `/sites/${activeSlug}/ai-visibility/overview`),
        match: `/sites/${activeSlug}/ai-visibility`,
        secondary: {
          title: 'AI Visibility',
          sections: [{
            links: aiLinks.map(({ label, href, match }) => ({ label, href, match })),
          }],
        },
      });
      items.push({
        key: 'tools',
        label: 'Tools',
        icon: <IconTools />,
        href: toolsLinks[0]?.href ?? workspaceHref(activeId, `/sites/${activeSlug}/keyword-research`),
        match: `/sites/${activeSlug}/keyword-research`,
        secondary: {
          title: 'Tools',
          sections: [{
            links: toolsLinks.map(({ label, href, match }) => ({ label, href, match })),
          }],
        },
      });
    }
    items.push({
      key: 'settings',
      label: 'Settings',
      icon: <IconSettings />,
      href: '/settings/general',
      match: '/settings',
      secondary: {
        title: 'Settings',
        sections: [
          { label: 'Organization', links: [
            { label: 'General', href: '/settings/general', match: '/settings/general' },
            { label: 'People', href: '/settings/people', match: '/settings/people' },
          ] },
          { label: 'Billing', links: [
            { label: 'Your subscription', href: '/settings/billing_subscription', match: '/settings/billing_subscription' },
            { label: 'Usage', href: '/settings/billing_usage', match: '/settings/billing_usage' },
            { label: 'Invoices', href: '/settings/billing_invoices', match: '/settings/billing_invoices' },
            { label: 'Billing details', href: '/settings/billing_details', match: '/settings/billing_details' },
          ] },
          { label: 'Integrations', links: [
            { label: 'Search Console', href: '/settings/google_search_console', match: '/settings/google_search_console' },
            { label: 'WordPress', href: '/settings/wordpress', match: '/settings/wordpress' },
            { label: 'API', href: '/settings/api', match: '/settings/api' },
          ] },
          { label: 'Workspace', links: [
            { label: 'General', href: '/settings/workspace_general', match: '/settings/workspace_general' },
            { label: 'Members', href: '/settings/members', match: '/settings/members' },
            { label: 'Brand Knowledge', href: '/settings/brand_knowledge', match: '/settings/brand_knowledge' },
            { label: 'Custom Voices', href: '/settings/custom_voices', match: '/settings/custom_voices' },
          ] },
          { label: 'Your account', links: [
            { label: 'Profile', href: '/settings/profile', match: '/settings/profile' },
            { label: 'Notifications', href: '/settings/notifications', match: '/settings/notifications' },
          ] },
        ],
      },
    });
    return items;
  }, [activeId, activeSlug]);

  // Hovered/active secondary flyout
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [collapsing, setCollapsing] = useState(false);
  const collapseTimerRef = useRef<number | null>(null);
  const hoverSuppressRef = useRef(false);
  const hoverSuppressTimerRef = useRef<number | null>(null);
  const FLYOUT_CLOSE_MS = 240;

  const clearHoverPreview = () => {
    if (isDocked) return;
    hoverSuppressRef.current = true;
    if (hoverSuppressTimerRef.current != null) window.clearTimeout(hoverSuppressTimerRef.current);
    hoverSuppressTimerRef.current = window.setTimeout(() => {
      hoverSuppressRef.current = false;
      hoverSuppressTimerRef.current = null;
    }, FLYOUT_CLOSE_MS);
    setHoveredKey(null);
  };

  const setHoverPreview = (key: string | null) => {
    if (hoverSuppressRef.current && key !== null) return;
    setHoveredKey(key);
  };

  useEffect(() => () => {
    if (hoverSuppressTimerRef.current != null) window.clearTimeout(hoverSuppressTimerRef.current);
    if (collapseTimerRef.current != null) window.clearTimeout(collapseTimerRef.current);
  }, []);

  const handleRailMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    clearHoverPreview();
  };
  const activePrimary = useMemo(() => primaryItems.find((it) => {
    if (!it.secondary) return false;
    return isMatch(it.match);
  }) ?? null, [primaryItems, path, mounted]);

  // When docked (or mid-collapse): hover previews other groups; active route or pinnedKey is the default.
  const secondaryKey = useMemo(() => {
    if (isDocked || collapsing) return hoveredKey ?? activePrimary?.key ?? pinnedKey;
    return hoveredKey;
  }, [isDocked, collapsing, hoveredKey, activePrimary?.key, pinnedKey]);

  const flyoutItem = useMemo(() => {
    let key = secondaryKey;
    if (isDocked && !key) key = activeSlug ? 'seo' : 'settings';
    if (!key) return null;
    return primaryItems.find((it) => it.key === key && it.secondary) ?? null;
  }, [secondaryKey, isDocked, activeSlug, primaryItems]);

  // Ensure docked mode always has a visible group when none is pinned yet.
  useEffect(() => {
    if (!navReady) return;
    if (isDocked && !pinnedKey && !activePrimary?.key) {
      setPinnedKey(activeSlug ? 'seo' : 'settings');
    }
  }, [navReady, isDocked, pinnedKey, activePrimary?.key, activeSlug, setPinnedKey]);

  // Sync pinned group when navigating while the secondary panel is docked.
  useEffect(() => {
    if (isDocked && activePrimary?.key && !hoveredKey) setPinnedKey(activePrimary.key);
  }, [isDocked, activePrimary?.key, hoveredKey, setPinnedKey]);

  // Keep the flyout mounted through its close animation (Sentry animates hide with
  // the same spring, so we can't unmount instantly). `rendered` holds the last shown
  // item; `open` drives the CSS transform. rAF defers the open flag one frame after
  // mount so the enter transition runs from the base (-100%) state, not instantly.
  const [rendered, setRendered] = useState<PrimaryItem | null>(flyoutItem);
  const [open, setOpen] = useState(false);

  const toggleDock = () => {
    if (isDocked) {
      // Animate the panel sliding under the rail before removing layout space —
      // otherwise app-content jumps wider for one frame (white flash).
      setCollapsing(true);
      setOpen(false);
      if (collapseTimerRef.current != null) window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = window.setTimeout(() => {
        setDocked(false);
        setCollapsing(false);
        collapseTimerRef.current = null;
      }, FLYOUT_CLOSE_MS);
      return;
    }
    setDocked(true);
    setOpen(true);
    setPinnedKey((cur) => hoveredKey ?? activePrimary?.key ?? rendered?.key ?? cur);
  };

  const secondaryOpen = !collapsing && (isDocked || open);

  useEffect(() => {
    if (flyoutItem) {
      setRendered(flyoutItem);
      if (isDocked) {
        setOpen(true);
        return undefined;
      }
      const raf = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(raf);
    }
    if (isDocked) return undefined;
    setOpen(false);
    const t = setTimeout(() => {
      setRendered(null);
    }, 220);
    return () => clearTimeout(t);
  }, [flyoutItem, isDocked]);

  // Active state for a secondary flyout link. Performance (base /sites/<slug>) must
  // match exactly; AI-vis + deeper SEO routes use suffix matching.
  const isSecondaryActive = (matchSuffix: string) => {
    if (matchSuffix === '/dashboard') return isMatch('/dashboard', true);
    if (matchSuffix.includes('/ai-visibility/')) return isMatch(matchSuffix);
    if (activeSlug && matchSuffix.endsWith(activeSlug)) return path.endsWith(matchSuffix);
    return isMatch(matchSuffix);
  };

  const isActivePrimary = (it: PrimaryItem) => {
    if (it.key === 'dashboard') return isMatch('/dashboard', true);
    if (it.key === 'seo') {
      return (isMatch(it.match) && !isMatch('/ai-visibility') && !isMatch('/keyword-research') && !isMatch('/topic-research'))
        || isMatch(`/${AUDIT_URL_PATH}`);
    }
    if (it.key === 'tools') return isMatch('/keyword-research') || isMatch('/topic-research');
    return isMatch(it.match);
  };

  return (
    <div className="sentry-nav-rail-wrap" onMouseLeave={handleRailMouseLeave}>
      <nav aria-label="Primary Navigation" className="sentry-nav">
        {/* Primary list */}
        <ul className="sentry-nav-list">
          {primaryItems.map((it) => {
            const active = isActivePrimary(it);
            return (
              <li key={it.key} className="sentry-nav-item" onMouseEnter={() => setHoverPreview(it.secondary ? it.key : null)}>
                <Link href={it.href} passHref prefetch={false}>
                  <a
                    className="sentry-nav-link"
                    aria-label={it.label}
                    aria-current={active ? 'location' : undefined}
                    data-active-group={active ? 'true' : undefined}
                  >
                    {it.icon}
                  </a>
                </Link>
              </li>
            );
          })}
        </ul>

        <SentryNavFooter />
      </nav>

      {/* Reserve layout width only while animating docked → collapsed */}
      {collapsing && rendered?.secondary && (
        <div className="sentry-secondary-spacer" aria-hidden="true" />
      )}

      {/* Secondary flyout (hover over primary groups, or when on one of their routes) */}
      {rendered?.secondary && (
        <div
          className={`sentry-secondary${isDocked && !collapsing ? ' sentry-secondary--docked' : ''}${collapsing ? ' sentry-secondary--collapsing' : ''}`}
          data-open={secondaryOpen ? 'true' : 'false'}
          onMouseEnter={() => setHoverPreview(rendered.key)}
        >
          <div className="sentry-secondary-header">
            <span className="sentry-secondary-title">{rendered.secondary.title}</span>
            <button
              type="button"
              className={`sentry-dock-toggle${isDocked ? '' : ' sentry-dock-toggle--expand'}`}
              aria-label={isDocked ? 'Collapse' : 'Expand'}
              aria-pressed={isDocked}
              onClick={toggleDock}
            >
              <svg role="img" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true" style={{ transform: isDocked ? 'rotate(-90deg)' : 'rotate(90deg)' }}>
                <path d="M8 8C8.21 8 8.4 8.09 8.54 8.24L12.79 12.74C13.08 13.04 13.07 13.51 12.76 13.79C12.46 14.08 11.99 14.07 11.7 13.76L8 9.84L4.29 13.76C4.01 14.07 3.54 14.08 3.23 13.79C2.93 13.51 2.92 13.04 3.2 12.74L7.45 8.24C7.6 8.09 7.79 8 8 8ZM8 2C8.21 2 8.4 2.09 8.54 2.24L12.79 6.74C13.08 7.04 13.07 7.51 12.76 7.79C12.46 8.08 11.99 8.07 11.7 7.76L8 3.84L4.29 7.76C4.01 8.07 3.54 8.08 3.23 7.79C2.93 7.51 2.92 7.04 3.2 6.74L7.45 2.24C7.6 2.09 7.79 2 8 2Z" />
              </svg>
            </button>
          </div>
          <div className="sentry-secondary-body">
            {rendered.secondary.sections.map((sec, si) => (
              <div key={si}>
                {sec.label && <div className="sentry-secondary-section-label">{sec.label}</div>}
                <ul className="sentry-secondary-list">
                  {sec.links.map((ln) => {
                    const active = isSecondaryActive(ln.match);
                    return (
                      <li key={ln.href}>
                        <Link href={ln.href} passHref prefetch={false}>
                          <a className="sentry-secondary-link" aria-current={active ? 'location' : undefined} data-active={active ? 'true' : undefined}>
                            <span className="sentry-secondary-link-label">{ln.label}</span>
                            {ln.match.endsWith('/recommendations') && recCount > 0 && (
                              <span className="sentry-secondary-flame">
                                <span className="sentry-secondary-flame-ico"><IconFire size={13} /></span>
                                <span className="sentry-secondary-flame-count">{recCount}</span>
                              </span>
                            )}
                          </a>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default SentryNav;
