import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import { authClient } from '../../../lib/auth/client';
import { useProfile } from '../../../services/profile';
import { useGscAccount } from '../../../services/gscAccount';
import { useWorkspaces } from '../../../services/workspaces';
import { useOnboardingChecklist, type OnboardingStep } from '../../../lib/useOnboardingChecklist';
import { deriveActiveId, resolveActiveDomain, workspaceHref } from '../../../lib/activeWorkspace';
import fetchJson from '../../../lib/fetchJson';
import { countActionableRecommendations } from '../../../lib/recommendations';
import { Avatar } from '../../core/avatar';
import {
  IconDashboard, IconIssues, IconCompass, IconSiren, IconSettings,
  IconBusiness, IconFire, IconBroadcast, IconEllipsis, IconChevron,
  IconQuestion, IconGroup, IconSentryLogo, IconDocs, IconSupport,
  IconBuilding, IconMegaphone, IconGlobe, IconOpen,
} from './sentryIcons';

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

/* ─── Progress ring (onboarding button) ──────────────────────────────────── */
const NavProgressRing = ({ pct }: { pct: number }) => {
  const r = 8;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <svg className="sentry-nav-ring" role="img" height="20" width="20" aria-hidden="true">
      <circle r={r} cx="10" cy="10" fill="none" strokeWidth="2" stroke="rgba(255,255,255,0.15)" />
      <circle
        r={r} cx="10" cy="10" fill="none" strokeWidth="2" strokeLinecap="round"
        stroke="#653DE9" strokeDasharray={c} strokeDashoffset={offset}
        transform="rotate(-90 10 10)"
      />
      <text x="10" y="10" textAnchor="middle" dominantBaseline="central">{Math.round(pct)}</text>
    </svg>
  );
};

/* ─── Popover: closes on outside click / Escape ──────────────────────────── */
const useDismiss = (onClose: () => void) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return ref;
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

/* ─── Footer dropdown popovers ───────────────────────────────────────────── */
type MenuLinkProps = {
  icon: React.ReactNode;
  label: React.ReactNode;
  href?: string;
  chevron?: boolean;
  trailing?: React.ReactNode;
  onClick?: () => void;
  expanded?: boolean;
};
const MenuLink = ({ icon, label, href, chevron, trailing, onClick, expanded }: MenuLinkProps) => {
  const body = (
    <>
      {icon}
      <span className="sentry-menu-item-label">{label}</span>
      {trailing}
      {chevron && <span className="sentry-menu-chevron"><IconChevron rotate={90} /></span>}
    </>
  );
  if (href) return <a className="sentry-menu-item" href={href} target="_blank" rel="noreferrer noopener" onClick={onClick}>{body}</a>;
  return <button type="button" className="sentry-menu-item" onClick={onClick} aria-expanded={expanded}>{body}</button>;
};

type SubItem = { icon: React.ReactNode; label: string; href?: string };
const HELP_SUBMENUS: Record<string, SubItem[]> = {
  Resources: [
    { icon: <IconSentryLogo />, label: 'Welcome Page', href: 'https://surferseo.com/' },
    { icon: <IconDocs />, label: 'Documentation', href: 'https://docs.surferseo.com/' },
    { icon: <IconDocs />, label: 'API Docs', href: 'https://docs.surferseo.com/en/articles/api' },
    { icon: <IconQuestion />, label: 'Help Center', href: 'https://help.surferseo.com/' },
    { icon: <IconSupport />, label: 'Contact Support', href: 'https://help.surferseo.com/en/' },
  ],
  Community: [
    { icon: <IconGroup />, label: 'Surfer Community', href: 'https://community.surferseo.com/' },
    { icon: <IconGlobe />, label: 'Facebook Group', href: 'https://www.facebook.com/groups/surferseo/' },
  ],
  Legal: [
    { icon: <IconBuilding />, label: 'Terms of Service', href: 'https://surferseo.com/terms-of-service/' },
    { icon: <IconBuilding />, label: 'Privacy Policy', href: 'https://surferseo.com/privacy-policy/' },
  ],
};
const HelpMenu = ({ anchor, onClose }: { anchor: DOMRect; onClose: () => void }) => {
  const ref = useDismiss(onClose);
  const [sub, setSub] = useState<string | null>(null);
  return (
    <div ref={ref} className="sentry-nav-popover" style={{ left: anchor.right + 8, bottom: 12, top: 'auto' }} onMouseLeave={() => setSub(null)}>
      <ul className="sentry-menu-list">
        {(['Resources', 'Community', 'Legal'] as const).map((key) => (
          <li key={key} className="sentry-menu-subwrap" onMouseEnter={() => setSub(key)}>
            <MenuLink
              icon={key === 'Resources' ? <IconQuestion /> : key === 'Community' ? <IconGroup /> : <IconBuilding />}
              label={key}
              chevron
              expanded={sub === key}
            />
            {sub === key && (
              <div className="sentry-nav-popover sentry-menu-flyout">
                <ul className="sentry-menu-list">
                  {HELP_SUBMENUS[key].map((it) => (
                    <li key={it.label}><MenuLink icon={it.icon} label={it.label} href={it.href} /></li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
      <hr className="sentry-menu-sep" />
      <ul className="sentry-menu-list">
        <li><MenuLink icon={<IconMegaphone />} label="Give feedback" href="https://help.surferseo.com/en/" /></li>
        <li><MenuLink icon={<IconGlobe />} label="Tour the new navigation" href="https://docs.surferseo.com/" /></li>
      </ul>
    </div>
  );
};

type ChangelogEntry = { title: string; body: string; href: string; image?: string };
const CHANGELOG: ChangelogEntry[] = [
  {
    title: 'Redesigned navigation',
    body: 'A new sidebar with dockable secondary panels, workspace switcher, and quicker access to SEO and AI Visibility tools.',
    href: 'https://docs.surferseo.com/',
  },
  {
    title: 'AI Visibility tracking',
    body: 'Monitor how AI search engines mention your brand, track competitors, and discover new content opportunities.',
    href: 'https://docs.surferseo.com/',
  },
  {
    title: 'Content recommendations',
    body: 'Automated content audits surface pages that need optimization and ideas for new content to create.',
    href: 'https://docs.surferseo.com/',
  },
];
const WhatsNewMenu = ({ anchor, onClose }: { anchor: DOMRect; onClose: () => void }) => {
  const ref = useDismiss(onClose);
  return (
    <div ref={ref} className="sentry-nav-popover sentry-nav-popover--wide" style={{ left: anchor.right + 8, bottom: 12, top: 'auto' }}>
      <ul className="sentry-whatsnew-list">
        {CHANGELOG.map((c) => (
          <li key={c.href} className="sentry-whatsnew-item">
            <div className="sentry-whatsnew-head">
              <a className="sentry-whatsnew-title" href={c.href} target="_blank" rel="noreferrer noopener">{c.title}</a>
              <span className="sentry-whatsnew-tag">New Feature</span>
            </div>
            <p className="sentry-whatsnew-body">
              {c.body}
              <a className="sentry-whatsnew-readmore" href={c.href} target="_blank" rel="noreferrer noopener">Read more</a>
            </p>
            {c.image && <img className="sentry-whatsnew-img" loading="lazy" alt={c.title} src={c.image} />}
          </li>
        ))}
      </ul>
    </div>
  );
};

type StatusUpdate = { status: 'Operational' | 'Monitoring'; time: string; msg: string };
const STATUS_UPDATES: StatusUpdate[] = [
  { status: 'Operational', time: 'Now', msg: 'All Surfer SEO services are running normally.' },
];
const ServiceStatusMenu = ({ anchor, onClose }: { anchor: DOMRect; onClose: () => void }) => {
  const ref = useDismiss(onClose);
  return (
    <div ref={ref} className="sentry-nav-popover sentry-nav-popover--wide" style={{ left: anchor.right + 8, bottom: 12, top: 'auto' }}>
      <div className="sentry-status-title">All systems operational</div>
      <a className="sentry-status-link" href="https://status.surferseo.com/" target="_blank" rel="noreferrer noopener">
        <IconOpen size={12} /> view status page
      </a>
      <ul className="sentry-status-list">
        {STATUS_UPDATES.map((u, i) => (
          <li key={i} className="sentry-status-update">
            <span className={`sentry-status-dot ${u.status === 'Operational' ? 'sentry-status-dot--green' : 'sentry-status-dot--yellow'}`} />
            <span className={`sentry-status-label ${u.status === 'Operational' ? 'sentry-status-label--yellow' : 'sentry-status-label--yellow'}`}>{u.status}</span>
            <span className="sentry-status-time">({u.time})</span>
            <p className="sentry-status-msg">{u.msg}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

const OnboardingMenu = ({ anchor, onClose, steps, beyondSteps, done, pct }: {
  anchor: DOMRect;
  onClose: () => void;
  steps: OnboardingStep[];
  beyondSteps: OnboardingStep[];
  done: number;
  pct: number;
}) => {
  const ref = useDismiss(onClose);
  const [beyondOpen, setBeyondOpen] = useState(false);
  const [skipped, setSkipped] = useLocalStorage<string[]>('serpbear-onb-skipped', []);

  const skipStep = (key: string) => setSkipped((prev) => [...new Set([...prev, key])]);

  const renderStep = (s: OnboardingStep, skippable: boolean) => (
    <li key={s.key}>
      <div className="sentry-menu-item sentry-menu-item--static">
        <span className={`sentry-onb-check ${s.done ? 'sentry-onb-check--done' : 'sentry-onb-check--pending'}`}>
          {s.done && (
            <svg viewBox="0 0 16 16" width="10" height="10" fill="#fff"><path d="M13.72 3.22C14.01 2.93 14.49 2.93 14.78 3.22C15.07 3.51 15.07 3.99 14.78 4.28L6.53 12.53C6.24 12.82 5.76 12.82 5.47 12.53L1.22 8.28C0.93 7.99 0.93 7.51 1.22 7.22C1.51 6.93 1.99 6.93 2.28 7.22L6 10.94L13.72 3.22Z" /></svg>
          )}
        </span>
        <span className={`sentry-menu-item-label sentry-onb-label ${s.done ? 'sentry-onb-label--done' : ''}`}>{s.label}</span>
        {skippable && !s.done && !skipped.includes(s.key) && (
          <button type="button" className="sentry-onb-skip" aria-label={`Skip ${s.label}`} onClick={() => skipStep(s.key)}>Skip</button>
        )}
      </div>
    </li>
  );

  const visibleBeyond = beyondSteps.filter((s) => !skipped.includes(s.key));

  return (
    <div ref={ref} className="sentry-nav-popover sentry-nav-popover--wide" style={{ left: anchor.right + 8, bottom: 12, top: 'auto' }}>
      <div className="sentry-menu-title">Getting Started</div>
      <div className="sentry-menu-sub">{done} out of {steps.length} tasks completed · {Math.round(pct)}%</div>
      <ul className="sentry-menu-list sentry-onb-list">
        {steps.map((s) => renderStep(s, false))}
      </ul>
      {visibleBeyond.length > 0 && (
        <>
          <button type="button" className="sentry-onb-section-toggle" onClick={() => setBeyondOpen((p) => !p)} aria-expanded={beyondOpen}>
            Beyond the Basics
            <IconChevron rotate={beyondOpen ? 180 : 90} size={10} />
          </button>
          {beyondOpen && (
            <ul className="sentry-menu-list sentry-onb-list">
              {visibleBeyond.map((s) => renderStep(s, true))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

const UserMenu = ({ anchor, onClose, name, email, pic, initial }: { anchor: DOMRect; onClose: () => void; name: string; email: string; pic: string; initial: string }) => {
  const ref = useDismiss(onClose);
  return (
    <div ref={ref} className="sentry-user-menu" style={{ left: anchor.right + 8, bottom: 12, top: 'auto' }}>
      <div className="sentry-user-head">
        <span className="sentry-user-avatar">
          {pic ? <img alt="" src={pic} referrerPolicy="no-referrer" /> : <span>{initial}</span>}
        </span>
        <div className="sentry-user-meta">
          {name && <span className="sentry-user-name">{name}</span>}
          <span className="sentry-user-email">{email}</span>
        </div>
      </div>
      <Link href="/settings/profile" passHref>
        <a className="sentry-user-item">User Settings</a>
      </Link>
      <button
        type="button"
        className="sentry-user-item"
        onClick={async () => { await authClient.signOut(); window.location.href = '/auth/sign-in'; }}
      >
        Sign Out
      </button>
    </div>
  );
};


/* ─── Main component ─────────────────────────────────────────────────────── */
const SentryNav = ({ domains = [] }: Props) => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [docked, setDocked, dockedReady] = useLocalStorage('serpbear-nav-docked', true);
  const [pinnedKey, setPinnedKey, pinnedReady] = useLocalStorage<string | null>('serpbear-nav-pinned-key', null);
  const navReady = dockedReady && pinnedReady;
  const isDocked = navReady && docked;

  const { data: wsData } = useWorkspaces();
  const { data: profile } = useProfile();
  const { data: gscAccount } = useGscAccount();
  const session = authClient.useSession?.();
  const { steps: onboardingSteps, beyondSteps: onboardingBeyond, done: onboardingDone, pct: onboardingPct } = useOnboardingChecklist();

  const activeId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const activeWorkspace = (wsData?.workspaces || []).find((w) => w.id === activeId) ?? null;
  const activeSlug = useMemo(() => {
    const resolved = resolveActiveDomain(domains, activeId, activeWorkspace?.domain);
    return resolved?.slug ?? domains[0]?.slug ?? null;
  }, [activeId, activeWorkspace, domains]);

  // Recommendations count (flame badge) — shares the dashboard's query key.
  const { data: domainRecsData } = useQuery(
    ['domainRecs', activeSlug],
    () => fetchJson(`/api/domains/${activeSlug}/recommendations`, { recommendations: [] as Array<{ type?: string | null; score?: number | null }> }),
    { enabled: !!activeSlug, staleTime: 30 * 1000, retry: false },
  );
  const recCount = useMemo(
    () => countActionableRecommendations(domainRecsData?.recommendations ?? []),
    [domainRecsData],
  );

  const userPic = (profile?.avatarUrl || gscAccount?.picture) || '';
  const userName = profile?.name || session?.data?.user?.name || '';
  const userEmail = session?.data?.user?.email || '';
  const userInitial = (profile?.name || session?.data?.user?.email || '?').charAt(0).toUpperCase();

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
      items.push({
        key: 'seo',
        label: 'SEO',
        icon: <IconCompass />,
        href: workspaceHref(activeId, `/sites/${activeSlug}`),
        match: `/sites/${activeSlug}`,
        secondary: {
          title: 'SEO',
          sections: [{
            links: [
              { label: 'Performance', href: workspaceHref(activeId, `/sites/${activeSlug}`), match: `/sites/${activeSlug}` },
              { label: 'Recommendations', href: workspaceHref(activeId, `/sites/${activeSlug}/recommendations`), match: `/sites/${activeSlug}/recommendations` },
              { label: 'Content Audit', href: workspaceHref(activeId, `/sites/${activeSlug}/content-audit`), match: `/sites/${activeSlug}/content-audit` },
              { label: 'Topical Map', href: workspaceHref(activeId, `/sites/${activeSlug}/topical-map`), match: `/sites/${activeSlug}/topical-map` },
              { label: 'Activity Log', href: workspaceHref(activeId, `/sites/${activeSlug}/activity-log`), match: `/sites/${activeSlug}/activity-log` },
            ],
          }],
        },
      });
      items.push({
        key: 'aivis',
        label: 'AI Vis',
        icon: <IconSiren />,
        href: workspaceHref(activeId, `/sites/${activeSlug}/ai-visibility/overview`),
        match: `/sites/${activeSlug}/ai-visibility`,
        secondary: {
          title: 'AI Visibility',
          sections: [{
            links: [
              { label: 'Overview', href: workspaceHref(activeId, `/sites/${activeSlug}/ai-visibility/overview`), match: '/ai-visibility/overview' },
              { label: 'Sources', href: workspaceHref(activeId, `/sites/${activeSlug}/ai-visibility/sources`), match: '/ai-visibility/sources' },
              { label: 'Competitors', href: workspaceHref(activeId, `/sites/${activeSlug}/ai-visibility/competitors`), match: '/ai-visibility/competitors' },
              { label: 'Prompts', href: workspaceHref(activeId, `/sites/${activeSlug}/ai-visibility/prompts`), match: '/ai-visibility/prompts' },
              { label: 'Fanout Queries', href: workspaceHref(activeId, `/sites/${activeSlug}/ai-visibility/fanout-queries`), match: '/ai-visibility/fanout-queries' },
            ],
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

  // Footer popovers
  type PopKind = 'help' | 'whatsnew' | 'status' | 'onboarding' | 'user';
  const [popover, setPopover] = useState<{ kind: PopKind; rect: DOMRect } | null>(null);
  const openPopover = (kind: PopKind) => (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover((cur) => (cur?.kind === kind ? null : { kind, rect }));
  };
  const closePopover = () => setPopover(null);

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
    if (it.key === 'seo') return isMatch(it.match) && !isMatch('/ai-visibility');
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
                <Link href={it.href} passHref>
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

        {/* Footer utility bar */}
        <div className="sentry-nav-footer">
          <div className="sentry-nav-btnbar">
            <button type="button" aria-label="Onboarding" className="sentry-nav-utilbtn" aria-expanded={popover?.kind === 'onboarding'} onClick={openPopover('onboarding')}>
              <NavProgressRing pct={onboardingPct} />
            </button>
            <button type="button" aria-label="Try Business" className="sentry-nav-utilbtn" onClick={() => router.push('/settings/billing_subscription')}>
              <IconBusiness />
            </button>
            <button type="button" aria-label="Service status" className="sentry-nav-utilbtn" aria-expanded={popover?.kind === 'status'} onClick={openPopover('status')}>
              <IconFire />
              <span className="sentry-nav-unread" aria-hidden="true" />
            </button>
            <button type="button" aria-label="What's New" className="sentry-nav-utilbtn" aria-expanded={popover?.kind === 'whatsnew'} onClick={openPopover('whatsnew')}>
              <IconBroadcast />
            </button>
            <button type="button" aria-label="Help" className="sentry-nav-utilbtn" aria-expanded={popover?.kind === 'help'} onClick={openPopover('help')}>
              <IconEllipsis />
            </button>
            <button type="button" aria-label={session?.data?.user?.email || 'Account'} className="sentry-nav-utilbtn sentry-nav-avatarbtn" aria-expanded={popover?.kind === 'user'} onClick={openPopover('user')}>
              <Avatar src={userPic || undefined} initials={userInitial} size={28} className="sentry-nav-avatar" />
            </button>
          </div>
        </div>
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
                        <Link href={ln.href} passHref>
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

      {/* Footer dropdown popovers */}
      {popover?.kind === 'help' && <HelpMenu anchor={popover.rect} onClose={closePopover} />}
      {popover?.kind === 'whatsnew' && <WhatsNewMenu anchor={popover.rect} onClose={closePopover} />}
      {popover?.kind === 'status' && <ServiceStatusMenu anchor={popover.rect} onClose={closePopover} />}
      {popover?.kind === 'onboarding' && (
        <OnboardingMenu
          anchor={popover.rect}
          onClose={closePopover}
          steps={onboardingSteps}
          beyondSteps={onboardingBeyond}
          done={onboardingDone}
          pct={onboardingPct}
        />
      )}
      {popover?.kind === 'user' && <UserMenu anchor={popover.rect} onClose={closePopover} name={userName} email={userEmail} pic={userPic} initial={userInitial} />}
    </div>
  );
};

export default SentryNav;
