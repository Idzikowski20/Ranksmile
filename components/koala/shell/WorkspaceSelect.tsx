import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { Icon } from '../icons/Icon';
import MenuListItem from '../core/menuListItem';
import { MenuList } from '../core/menuList';
import SearchBar from '../core/searchBar';
import { deriveActiveId, resolveActiveDomain } from '../../../lib/activeWorkspace';
import { useOrganization } from '../../../services/organization';
import { useFetchDomains } from '../../../services/domains';
import {
  useWorkspaces,
  useSetActiveWorkspace,
  useCreateSetupWorkspace,
} from '../../../services/workspaces';
import { CreateTeamDialog } from '../product/CreateTeamDialog';
import DomainFaviconAvatar from '../../common/DomainFaviconAvatar';

/**
 * Koala workspace / org select — Figma Product Sidebar header (`4903:6905`).
 */
export default function WorkspaceSelect({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [teamOpen, setTeamOpen] = useState(false);

  const { data: org } = useOrganization();
  const { data: domainsData } = useFetchDomains(router, false);
  const { data: wsData } = useWorkspaces();
  const workspaces = wsData?.workspaces ?? [];
  const domains = domainsData?.domains ?? [];
  const activeId = deriveActiveId(mounted, router.asPath, wsData?.activeId ?? null);
  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null;
  const setActive = useSetActiveWorkspace();
  const createSetup = useCreateSetupWorkspace();

  useEffect(() => { setMounted(true); }, []);

  const activeDomain = useMemo(() => {
    if (!mounted) return null;
    return resolveActiveDomain(domains, activeId, activeWorkspace?.domain ?? null);
  }, [mounted, domains, activeId, activeWorkspace?.domain]);

  const avatarDomain = activeDomain?.domain ?? activeWorkspace?.domain ?? null;
  const label = activeWorkspace?.name || org?.name?.trim() || 'Workspace';
  const meta = `${workspaces.length} ${workspaces.length === 1 ? 'project' : 'projects'}`;

  const filteredWorkspaces = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(q) || (w.domain ?? '').toLowerCase().includes(q));
  }, [workspaces, search]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const close = () => setOpen(false);
  const nav = (href: string) => { close(); void router.push(href); };

  const addWorkspace = () => {
    createSetup.mutate(undefined, {
      onSuccess: (id) => {
        close();
        if (id && typeof window !== 'undefined') {
          window.location.href = `/workspace/${id}/setup`;
        }
      },
      onError: (err: unknown) => {
        toast.error((err as { message?: string })?.message || 'Something went wrong.');
      },
    });
  };

  return (
    <>
      <div ref={ref} className={`koala-ws-select${compact ? ' koala-ws-select--compact' : ''}`}>
        <button
          type="button"
          className={`koala-ws-select__trigger${open ? ' koala-ws-select__trigger--open' : ''}`}
          aria-label="Switch workspace"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="koala-ws-select__avatar-wrap">
            <DomainFaviconAvatar domain={avatarDomain} size={compact ? 24 : 28} className="koala-ws-select__avatar" />
            <span className="koala-ws-select__status" aria-hidden="true" />
          </span>
          <span className="koala-ws-select__text">
            <span className="koala-ws-select__name">{label}</span>
          </span>
          <Icon name="CaretDown" size={16} weight="bold" className="koala-ws-select__caret" />
        </button>

        {open ? (
          <div className="koala-ws-select__menu">
            <MenuList
              header={(
                <div className="koala-ws-select__menu-head" style={{ border: 'none', padding: 0 }}>
                  <DomainFaviconAvatar domain={avatarDomain} size={28} />
                  <div className="koala-ws-select__menu-meta">
                    <span className="koala-ws-select__menu-name">{org?.name?.trim() || label}</span>
                    <span className="koala-ws-select__menu-sub">{meta}</span>
                  </div>
                </div>
              )}
              search={<SearchBar value={search} onChange={setSearch} placeholder="Search workspaces" width="100%" />}
              footer={(
                <>
                  <MenuListItem
                    label="Add Workspace"
                    priority="primary"
                    disabled={createSetup.isLoading}
                    onClick={addWorkspace}
                  />
                  <MenuListItem
                    label="Create team"
                    onClick={() => { close(); setTeamOpen(true); }}
                  />
                </>
              )}
            >
              <MenuListItem as="a" href="/settings/general" label="Organization Settings" onClick={(e) => { e.preventDefault(); nav('/settings/general'); }} />
              <MenuListItem label="Projects" onClick={() => nav('/')} />
              <MenuListItem as="a" href="/settings/people" label="Members" onClick={(e) => { e.preventDefault(); nav('/settings/people'); }} />
              <MenuListItem as="a" href="/settings/billing_subscription" label="Usage & Billing" onClick={(e) => { e.preventDefault(); nav('/settings/billing_subscription'); }} />
              <div className="koala-ws-select__divider" role="separator" />
              {filteredWorkspaces.map((w) => {
                const isActive = w.id === activeId;
                return (
                  <MenuListItem
                    key={w.id}
                    label={w.name}
                    leadingItems={<DomainFaviconAvatar domain={w.domain} size={20} plain />}
                    trailingItems={isActive ? <Icon name="Check" size={16} color="#F84416" /> : undefined}
                    onClick={() => {
                      if (w.id !== activeId) setActive.mutate(w.id);
                      close();
                    }}
                  />
                );
              })}
              {filteredWorkspaces.length === 0 ? (
                <p style={{ margin: 0, padding: '8px 10px', fontSize: 13, color: 'var(--koala-text-secondary)' }}>
                  No workspaces match your search.
                </p>
              ) : null}
            </MenuList>
          </div>
        ) : null}
      </div>

      <CreateTeamDialog open={teamOpen} onClose={() => setTeamOpen(false)} />
    </>
  );
}
