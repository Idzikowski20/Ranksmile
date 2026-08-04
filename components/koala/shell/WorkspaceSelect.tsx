import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { Icon } from '../icons/Icon';
import MenuListItem from '../core/menuListItem';
import { MenuList } from '../core/menuList';
import { ShellPortal } from '../overlay/ShellPortal';
import { zIndex } from '../tokens/zIndex';
import { deriveActiveId, resolveActiveDomain } from '../../../lib/activeWorkspace';
import { useOrganization } from '../../../services/organization';
import { useFetchDomains } from '../../../services/domains';
import {
  useWorkspaces,
  useSetActiveWorkspace,
  useCreateSetupWorkspace,
} from '../../../services/workspaces';
import DomainFaviconAvatar from '../../common/DomainFaviconAvatar';
import { Flag } from '../icons/Flag';

/**
 * Koala workspace / org select — Figma Product Sidebar header (`4903:6905`).
 * Menu portals to body as a single MenuList surface (no nested Popover panel —
 * that caused gray square corners behind the rounded card).
 */
export default function WorkspaceSelect({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

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
  const meta = `${workspaces.length} ${workspaces.length === 1 ? 'workspace' : 'workspaces'}`;

  const close = useCallback(() => setOpen(false), []);

  const syncPos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: Math.min(r.bottom + 4, window.innerHeight - 16),
      left: Math.min(Math.max(8, r.left), window.innerWidth - 288),
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    syncPos();
    const onScrollOrResize = () => syncPos();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, syncPos]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let { top, left } = pos ?? { top: 8, left: 8 };
    if (rect.bottom > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - 8 - rect.height);
    }
    if (rect.right > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - 8 - rect.width);
    }
    menuRef.current.style.top = `${Math.round(top)}px`;
    menuRef.current.style.left = `${Math.round(left)}px`;
  }, [open, pos, workspaces.length]);

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
    <div className={`koala-ws-select${compact ? ' koala-ws-select--compact' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`koala-ws-select__trigger${open ? ' koala-ws-select__trigger--open' : ''}`}
        aria-label="Switch workspace"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          syncPos();
          setOpen(true);
        }}
      >
        <span className="koala-ws-select__avatar-wrap">
          <DomainFaviconAvatar domain={avatarDomain} size={compact ? 24 : 28} className="koala-ws-select__avatar" />
          <span className="koala-ws-select__badge koala-ws-select__badge--flag" aria-hidden="true">
            <Flag code="US" size={compact ? 10 : 12} />
          </span>
        </span>
        <span className="koala-ws-select__text">
          <span className="koala-ws-select__name">{label}</span>
        </span>
        <Icon name="CaretDown" size={16} weight="bold" className="koala-ws-select__caret" />
      </button>

      {open && pos ? (
        <ShellPortal>
          <div
            ref={menuRef}
            className="koala-ws-select__menu"
            role="dialog"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              zIndex: zIndex.popover,
            }}
          >
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
              footer={(
                <MenuListItem
                  label="Add Workspace"
                  priority="primary"
                  leadingItems={<Icon name="Plus" size={16} weight="bold" />}
                  disabled={createSetup.isLoading}
                  onClick={addWorkspace}
                />
              )}
            >
              <MenuListItem as="a" href="/settings/general" label="Organization Settings" onClick={(e) => { e.preventDefault(); nav('/settings/general'); }} />
              <MenuListItem as="a" href="/settings/people" label="Members" onClick={(e) => { e.preventDefault(); nav('/settings/people'); }} />
              <MenuListItem as="a" href="/settings/billing_subscription" label="Usage & Billing" onClick={(e) => { e.preventDefault(); nav('/settings/billing_subscription'); }} />
              <div className="koala-ws-select__divider" role="separator" />
              {workspaces.map((w) => {
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
              {workspaces.length === 0 ? (
                <p style={{ margin: 0, padding: '8px 10px', fontSize: 13, color: 'var(--koala-text-secondary)' }}>
                  No workspaces yet.
                </p>
              ) : null}
            </MenuList>
          </div>
        </ShellPortal>
      ) : null}
    </div>
  );
}
