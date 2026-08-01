import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/router';
import OrganizationSwitcher from './OrganizationSwitcher';
import SentryNavFooter from './nav/SentryNavFooter';
import {
  IconChevron,
  IconCompass,
  IconDashboard,
  IconIssues,
  IconSettings,
  IconSiren,
  IconTools,
} from './nav/sentryIcons';
import { useWorkspaces } from '../../services/workspaces';
import { deriveActiveId, resolveActiveDomain, workspaceHref } from '../../lib/activeWorkspace';
import { AI_VISIBILITY_NAV, resolveSiteNav, SEO_NAV, TOOLS_NAV } from '../../lib/navigation';

type Props = {
  open: boolean;
  onClose: () => void;
  domains?: DomainType[];
};

type NavLink = { label: string; href: string; match: string; section?: string };
type NavGroup = {
  key: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  match?: string;
  links?: NavLink[];
};

const SETTINGS_LINKS: NavLink[] = [
  { section: 'Organization', label: 'General', href: '/settings/general', match: '/settings/general' },
  { section: 'Organization', label: 'People', href: '/settings/people', match: '/settings/people' },
  { section: 'Billing', label: 'Your subscription', href: '/settings/billing_subscription', match: '/settings/billing_subscription' },
  { section: 'Billing', label: 'Usage', href: '/settings/billing_usage', match: '/settings/billing_usage' },
  { section: 'Billing', label: 'Invoices', href: '/settings/billing_invoices', match: '/settings/billing_invoices' },
  { section: 'Billing', label: 'Billing details', href: '/settings/billing_details', match: '/settings/billing_details' },
  { section: 'Integrations', label: 'Search Console', href: '/settings/google_search_console', match: '/settings/google_search_console' },
  { section: 'Integrations', label: 'WordPress', href: '/settings/wordpress', match: '/settings/wordpress' },
  { section: 'Integrations', label: 'API', href: '/settings/api', match: '/settings/api' },
  { section: 'Workspace', label: 'General', href: '/settings/workspace_general', match: '/settings/workspace_general' },
  { section: 'Workspace', label: 'Members', href: '/settings/members', match: '/settings/members' },
  { section: 'Workspace', label: 'Brand Knowledge', href: '/settings/brand_knowledge', match: '/settings/brand_knowledge' },
  { section: 'Workspace', label: 'Custom Voices', href: '/settings/custom_voices', match: '/settings/custom_voices' },
  { section: 'Your account', label: 'Profile', href: '/settings/profile', match: '/settings/profile' },
  { section: 'Your account', label: 'Notifications', href: '/settings/notifications', match: '/settings/notifications' },
];

const MobileSidebar = ({ open, onClose, domains = [] }: Props) => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: wsData } = useWorkspaces();
  const activeId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const activeWorkspace = (wsData?.workspaces || []).find((w) => w.id === activeId) ?? null;
  const activeSlug = useMemo(() => {
    const resolved = resolveActiveDomain(domains, activeId, activeWorkspace?.domain);
    return resolved?.slug ?? domains[0]?.slug ?? null;
  }, [activeId, activeWorkspace, domains]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => onClose();
    router.events.on('routeChangeStart', close);
    return () => router.events.off('routeChangeStart', close);
  }, [open, onClose, router.events]);

  const path = mounted ? router.asPath.split('?')[0].split('#')[0].replace(/\/$/, '') : '';
  const isMatch = (suffix: string) => mounted && path.includes(suffix);

  const groups: NavGroup[] = useMemo(() => {
    const items: NavGroup[] = [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <IconDashboard size={18} />,
        href: workspaceHref(activeId, '/dashboard'),
        match: '/dashboard',
      },
      {
        key: 'articles',
        label: 'Articles',
        icon: <IconIssues size={18} />,
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
        icon: <IconCompass size={18} />,
        links: seoLinks.map(({ label, href, match }) => ({ label, href, match })),
      });
      items.push({
        key: 'aivis',
        label: 'AI Visibility',
        icon: <IconSiren size={18} />,
        links: aiLinks.map(({ label, href, match }) => ({ label, href, match })),
      });
      items.push({
        key: 'tools',
        label: 'Tools',
        icon: <IconTools size={18} />,
        links: toolsLinks.map(({ label, href, match }) => ({ label, href, match })),
      });
    }

    items.push({
      key: 'settings',
      label: 'Settings',
      icon: <IconSettings size={18} />,
      links: SETTINGS_LINKS,
    });

    return items;
  }, [activeId, activeSlug]);

  useEffect(() => {
    if (!open || !mounted) return;
    const next: Record<string, boolean> = {};
    for (const g of groups) {
      if (g.links?.some((ln) => path.includes(ln.match))) next[g.key] = true;
    }
    if (Object.keys(next).length) setExpanded((prev) => ({ ...prev, ...next }));
  }, [open, mounted, path, groups]);

  if (!open || typeof document === 'undefined') return null;

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navigate = () => onClose();

  return createPortal(
    <div className="mobile-sidebar-root" role="presentation">
      <button
        type="button"
        className="mobile-sidebar-backdrop"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside
        className="mobile-sidebar-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <header className="mobile-sidebar-header">
          <OrganizationSwitcher />
          <button
            type="button"
            className="mobile-sidebar-close"
            aria-label="Close menu"
            onClick={onClose}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <nav className="mobile-sidebar-scroll styled-scrollbar-dark" aria-label="Primary">
          <p className="mobile-sidebar-section-label">Platform</p>
          <ul className="mobile-sidebar-list">
            {groups.map((g) => {
              if (!g.links) {
                const active = g.match ? isMatch(g.match) : false;
                return (
                  <li key={g.key}>
                    <Link href={g.href || '#'} passHref>
                      <a
                        className={`mobile-sidebar-item${active ? ' mobile-sidebar-item--active' : ''}`}
                        onClick={navigate}
                      >
                        <span className="mobile-sidebar-item-icon">{g.icon}</span>
                        <span className="mobile-sidebar-item-label">{g.label}</span>
                      </a>
                    </Link>
                  </li>
                );
              }

              const openGroup = !!expanded[g.key];
              const groupActive = g.links.some((ln) => isMatch(ln.match));
              return (
                <li key={g.key} className="mobile-sidebar-group">
                  <button
                    type="button"
                    className={`mobile-sidebar-item mobile-sidebar-item--trigger${groupActive ? ' mobile-sidebar-item--active' : ''}`}
                    aria-expanded={openGroup}
                    onClick={() => toggle(g.key)}
                  >
                    <span className="mobile-sidebar-item-icon">{g.icon}</span>
                    <span className="mobile-sidebar-item-label">{g.label}</span>
                    <span className={`mobile-sidebar-chevron${openGroup ? ' mobile-sidebar-chevron--open' : ''}`}>
                      <IconChevron size={12} rotate={openGroup ? 180 : 90} />
                    </span>
                  </button>
                  {openGroup && (
                    <ul className="mobile-sidebar-sublist">
                      {g.links.map((ln, i) => {
                        const prevSection = g.links![i - 1]?.section;
                        const showSection = ln.section && ln.section !== prevSection;
                        return (
                          <React.Fragment key={ln.href}>
                            {showSection && (
                              <li className="mobile-sidebar-subsection" aria-hidden="true">{ln.section}</li>
                            )}
                            <li>
                              <Link href={ln.href} passHref>
                                <a
                                  className={`mobile-sidebar-subitem${isMatch(ln.match) ? ' mobile-sidebar-subitem--active' : ''}`}
                                  onClick={navigate}
                                >
                                  {ln.label}
                                </a>
                              </Link>
                            </li>
                          </React.Fragment>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mobile-sidebar-footer">
          <SentryNavFooter orientation="horizontal" placement="mobile" />
        </div>
      </aside>
    </div>,
    document.body,
  );
};

export default MobileSidebar;
