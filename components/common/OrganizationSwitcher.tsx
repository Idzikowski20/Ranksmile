import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import MenuListItem from '../core/menuListItem';
import { deriveActiveId, resolveActiveDomain } from '../../lib/activeWorkspace';
import { useOrganization } from '../../services/organization';
import { useFetchDomains } from '../../services/domains';
import {
  useWorkspaces,
  useSetActiveWorkspace,
  useCreateSetupWorkspace,
} from '../../services/workspaces';
import DomainFaviconAvatar from './DomainFaviconAvatar';

const MENU_AVATAR = 20;

const ChevronRight = () => (
  <svg
    role="img"
    viewBox="0 0 16 16"
    aria-hidden="true"
    fill="currentColor"
    width="12"
    height="12"
    style={{ transform: 'rotate(90deg)', color: 'rgba(255,255,255,0.5)' }}
  >
    <path d="M8 5C8.21 5 8.4 5.09 8.54 5.24L12.79 9.74C13.08 10.04 13.07 10.51 12.76 10.79C12.46 11.08 11.99 11.07 11.7 10.76L8 6.84L4.29 10.76C4.01 11.07 3.54 11.08 3.24 10.79C2.93 10.51 2.92 10.04 3.2 9.74L7.45 5.24C7.6 5.09 7.79 5 8 5Z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 12.5l4.5 4.5L19 7"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function parseSiteSlug(asPath: string): string | null {
  const m = /^\/sites\/([^/]+)/.exec((asPath.split('?')[0] || '').split('#')[0]);
  return m ? decodeURIComponent(m[1]) : null;
}

function friendly(_code?: string): string {
  return 'Something went wrong.';
}

const OrganizationSwitcher = () => {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [switchSubOpen, setSwitchSubOpen] = useState(false);

  const { data: org } = useOrganization();
  const { data: domainsData } = useFetchDomains(router, false);
  const { data: wsData } = useWorkspaces();
  const workspaces = wsData?.workspaces ?? [];
  const domains = domainsData?.domains ?? [];
  const activeId = deriveActiveId(mounted, router.asPath, wsData?.activeId ?? null);
  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null;
  const setActive = useSetActiveWorkspace();
  const createSetup = useCreateSetupWorkspace();

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeDomain = useMemo(() => {
    if (!mounted) return null;
    const routeSlug = parseSiteSlug(router.asPath);
    if (routeSlug) {
      const byRoute = domains.find((d) => d.slug === routeSlug);
      if (byRoute) return byRoute;
    }
    return resolveActiveDomain(domains, activeId, activeWorkspace?.domain ?? null);
  }, [mounted, router.asPath, domains, activeId, activeWorkspace?.domain]);

  const avatarDomain = activeDomain?.domain ?? activeWorkspace?.domain ?? null;
  const orgName = org?.name?.trim() || activeWorkspace?.name || 'Organization';
  const projectLabel = `${workspaces.length} ${workspaces.length === 1 ? 'Project' : 'Projects'}`;

  useEffect(() => {
    if (!open) {
      setSwitchSubOpen(false);
      return undefined;
    }
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const close = () => setOpen(false);

  const nav = (href: string) => {
    close();
    void router.push(href);
  };

  return (
    <div ref={ref} className="sentry-org-switcher">
      <div className="sentry-nav-btnbar">
        <button
          type="button"
          className="sentry-nav-utilbtn sentry-nav-avatarbtn"
          aria-label="Toggle organization menu"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <DomainFaviconAvatar domain={avatarDomain} className="sentry-nav-avatar" />
        </button>
      </div>

      {open && (
        <div className="sentry-org-dropdown motion-scale-in" role="menu">
          <div className="sentry-org-dropdown-header">
            <DomainFaviconAvatar domain={avatarDomain} className="sentry-nav-avatar" />
            <div className="sentry-org-dropdown-meta-wrap">
              <span className="sentry-org-dropdown-name">{orgName}</span>
              <span className="sentry-org-dropdown-meta">{projectLabel}</span>
            </div>
          </div>

          <ul className="sentry-org-dropdown-list">
            <li>
              <MenuListItem
                as="a"
                href="/settings/general"
                label="Organization Settings"
                onClick={(e) => {
                  e.preventDefault();
                  nav('/settings/general');
                }}
              />
            </li>
            <li>
              <MenuListItem label="Projects" onClick={() => nav('/')} />
            </li>
            <li>
              <MenuListItem
                as="a"
                href="/settings/people"
                label="Members"
                onClick={(e) => {
                  e.preventDefault();
                  nav('/settings/people');
                }}
              />
            </li>
            <li>
              <MenuListItem
                as="a"
                href="/settings/members"
                label="Teams"
                onClick={(e) => {
                  e.preventDefault();
                  nav('/settings/members');
                }}
              />
            </li>
            <li>
              <MenuListItem
                as="a"
                href="/settings/billing_subscription"
                label="Usage & Billing"
                onClick={(e) => {
                  e.preventDefault();
                  nav('/settings/billing_subscription');
                }}
              />
            </li>
            <li className="sentry-org-dropdown-subwrap">
              <div
                className="sentry-org-dropdown-subzone"
                onMouseEnter={() => setSwitchSubOpen(true)}
                onMouseLeave={() => setSwitchSubOpen(false)}
              >
                <MenuListItem
                  label="Switch Organization"
                  trailingItems={<ChevronRight />}
                  onClick={() => setSwitchSubOpen((v) => !v)}
                />
                {switchSubOpen && (
                  <div className="sentry-org-dropdown-flyout motion-scale-in" role="menu">
                    <ul className="sentry-org-dropdown-list">
                      {workspaces.map((w) => {
                        const isActive = w.id === activeId;
                        return (
                          <li key={w.id}>
                            <MenuListItem
                              label={w.name}
                              leadingItems={<DomainFaviconAvatar domain={w.domain} size={MENU_AVATAR} plain />}
                              trailingItems={isActive ? <CheckIcon /> : undefined}
                              onClick={() => {
                                if (w.id !== activeId) setActive.mutate(w.id);
                                close();
                              }}
                            />
                          </li>
                        );
                      })}
                      <li>
                        <MenuListItem
                          label="+ Create a new organization"
                          priority="primary"
                          disabled={createSetup.isLoading}
                          onClick={() => {
                            createSetup.mutate(undefined, {
                              onSuccess: (id) => {
                                close();
                                if (id && typeof window !== 'undefined') {
                                  window.location.href = `/workspace/${id}/setup`;
                                }
                              },
                              onError: (err: unknown) => {
                                toast.error(friendly((err as { message?: string })?.message));
                              },
                            });
                          }}
                        />
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default OrganizationSwitcher;
