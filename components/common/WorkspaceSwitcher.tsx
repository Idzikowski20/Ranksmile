import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaces, useSetActiveWorkspace, useCreateSetupWorkspace, useRenameWorkspace, useDeleteWorkspace } from '../../services/workspaces';

const font = 'var(--font-family-primary)';

const HeartAvatar = ({ size = 24 }: { size?: number }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: 6,
      background: '#783AFB',
      flexShrink: 0,
    }}
  >
    <svg width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  </span>
);

/** Strips protocol, path and the GSC `sc-domain:` prefix to a bare hostname. */
function cleanDomain(domain?: string | null): string {
  return (domain || '')
    .replace(/^sc-domain:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim();
}

/** Workspace icon: the domain's favicon, falling back to the heart glyph. */
const WorkspaceAvatar = ({ domain, size = 24 }: { domain?: string | null; size?: number }) => {
  const [err, setErr] = useState(false);
  const host = cleanDomain(domain);
  if (!host || err) return <HeartAvatar size={size} />;
  return (
    <img
      alt=""
      width={size}
      height={size}
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
      onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: 6, flexShrink: 0, objectFit: 'cover', background: '#fff' }}
    />
  );
};

const ChevronUpDown = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: '#9F9FA9' }}>
    <path d="M7 15L12 20L17 15M7 9L12 4L17 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M5 12.5l4.5 4.5L19 7" stroke="#18181B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: '#3F3F47' }}>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M15.232 5.232l3.536 3.536M9 11l6.768-6.768a2 2 0 012.828 2.828L11.828 13.828A4 4 0 019.172 15H8v-1.172A4 4 0 019 11z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function friendly(code: string | undefined): string {
  if (code === 'WORKSPACE_NOT_EMPTY') return 'Workspace still has domains — move or remove them first.';
  if (code === 'WORKSPACE_LAST') return 'You must keep at least one workspace.';
  return 'Something went wrong.';
}

const WorkspaceSwitcher = () => {
  const [open, setOpen] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useWorkspaces();
  const workspaces = data?.workspaces || [];
  const activeId = data?.activeId ?? null;
  const setActive = useSetActiveWorkspace();
  const createSetup = useCreateSetupWorkspace();
  const renameWs = useRenameWorkspace();
  const deleteWs = useDeleteWorkspace();
  const current = workspaces.find((w) => w.id === activeId) || workspaces[0];

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
        className="workspace-switcher-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: 224,
          maxWidth: '100%',
          padding: '8px',
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
          background: btnHover || open ? '#2F2F34' : 'transparent',
          transition: 'background 150ms ease',
          fontFamily: font,
        }}
      >
        <WorkspaceAvatar domain={current?.domain} />
        <span className="workspace-switcher-name" style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {current?.name ?? 'Workspace'}
        </span>
        <ChevronUpDown />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 200,
            width: 256,
            background: '#fff',
            border: '1px solid #E4E4E7',
            borderRadius: 12,
            boxShadow: '0px 16px 40px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            animation: 'growOut 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            transformOrigin: 'top left',
            fontFamily: font,
          }}
        >
          <div style={{ padding: '12px 16px 4px' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#52525C' }}>Workspaces</span>
          </div>

          <div style={{ padding: '4px 8px 8px' }}>
            {workspaces.map((w) => {
              const isSel = w.id === activeId;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="menuitem"
                  onClick={() => { if (w.id !== activeId) setActive.mutate(w.id); setOpen(false); }}
                  className="workspace-switcher-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px',
                    border: 'none',
                    borderRadius: 8,
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: font,
                    textAlign: 'left',
                  }}
                >
                  <WorkspaceAvatar domain={w.domain} size={24} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: '#18181B', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {w.name}
                  </span>
                  <button
                    type="button"
                    aria-label="Rename workspace"
                    onClick={(e) => { e.stopPropagation(); const name = window.prompt('Rename workspace', w.name); if (name && name.trim()) renameWs.mutate({ id: w.id, name: name.trim() }, { onError: (err: any) => { toast.error(friendly(err?.message)); } }); }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: '#9F9FA9', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete workspace"
                    onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this workspace?')) deleteWs.mutate(w.id, { onError: (err: any) => { toast.error(friendly(err?.message)); } }); }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: '#9F9FA9', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <TrashIcon />
                  </button>
                  {isSel && <CheckIcon />}
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, background: '#F4F4F5' }} />

          <div style={{ padding: 8 }}>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                createSetup.mutate(undefined, {
                  onSuccess: (id) => { if (id && typeof window !== 'undefined') window.location.href = `/workspace/${id}/setup`; },
                  onError: (err: any) => { toast.error(friendly(err?.message)); },
                });
              }}
              className="workspace-switcher-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px',
                border: 'none',
                borderRadius: 8,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: font,
                textAlign: 'left',
              }}
            >
              <span style={{ width: 24, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}><PlusIcon /></span>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B' }}>Add new workspace</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
