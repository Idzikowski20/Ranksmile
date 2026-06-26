import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaces, useRenameWorkspace, useDeleteWorkspace, Workspace } from '../../services/workspaces';
import { SETUP_LOCATIONS } from '../../lib/setupLocations';

const font = 'var(--font-family-primary)';

type GscAccount = { email: string; picture: string };

const Separator = () => (
  <div role="separator" style={{ minHeight: 1, minWidth: 1, alignSelf: 'stretch', background: '#F4F4F5' }} />
);

const labelStyle: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: '#18181B', fontFamily: font };

/** Strip protocol, `sc-domain:` prefix and any path so we get a bare host like "idztech.pl". */
const cleanDomain = (raw: string): string => raw
  .replace(/^sc-domain:/i, '')
  .replace(/^https?:\/\//i, '')
  .replace(/\/.*$/, '')
  .trim()
  .toLowerCase();

/**
 * Derive a (country, language) label for a domain. The app stores the picked
 * language per page in `site_context.language`, not on the domain or workspace,
 * so there is no client-side endpoint that returns it. We degrade gracefully by
 * matching the domain's ccTLD (e.g. ".pl") against SETUP_LOCATIONS' `cc`, which
 * gives both a flag and a sensible country/language. Falls back to nothing when
 * the TLD isn't a recognised country code (e.g. ".com").
 */
const resolveLocation = (domain: string): { country: string; language: string; cc: string } | null => {
  const tld = cleanDomain(domain).split('.').pop() || '';
  if (!tld) return null;
  const match = SETUP_LOCATIONS.find((l) => l.cc === tld);
  return match ? { country: match.country, language: match.language, cc: match.cc } : null;
};

const WorkspaceGeneralSettings = () => {
  const { data: wsData } = useWorkspaces();
  const renameWorkspace = useRenameWorkspace();
  const deleteWorkspace = useDeleteWorkspace();

  const current: Workspace | null = useMemo(() => {
    const list = wsData?.workspaces || [];
    if (list.length === 0) return null;
    return list.find((w) => w.id === wsData?.activeId) || list[0];
  }, [wsData]);

  const [name, setName] = useState('');
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [gscAccount, setGscAccount] = useState<GscAccount | null>(null);
  const [faviconError, setFaviconError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (!current || seeded.current) return;
    seeded.current = true;
    setName(current.name || '');
  }, [current]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/gsc/accounts', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const first = data?.accounts?.[0];
        if (alive && first) setGscAccount({ email: first.email || '', picture: first.picture || '' });
      } catch {
        // no GSC account connected — leave null
      }
    })();
    return () => { alive = false; };
  }, []);

  const domain = current?.domain ? cleanDomain(current.domain) : '';
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : '';
  const location = current?.domain ? resolveLocation(current.domain) : null;
  const initial = (current?.name || '').charAt(0).toUpperCase() || '?';

  const handleSave = () => {
    if (!current) return;
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Enter a workspace name'); return; }
    setSaving(true);
    renameWorkspace.mutate(
      { id: current.id, name: trimmed },
      {
        onSuccess: () => { toast.success('Saved'); },
        onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to save'); },
        onSettled: () => { setSaving(false); },
      },
    );
  };

  const handleRemove = () => {
    if (!current) return;
    if (!window.confirm(`Remove the workspace "${current.name}"? This cannot be undone.`)) return;
    setRemoving(true);
    deleteWorkspace.mutate(current.id, {
      onSuccess: () => { if (typeof window !== 'undefined') window.location.href = '/'; },
      onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to remove workspace'); setRemoving(false); },
    });
  };

  return (
    <div className="flex w-full flex-col items-start gap-base">
      {/* Header */}
      <div className="gap-2xs flex flex-col">
        <span className="text-base font-semibold text-gray-140">Workspace</span>
        <span className="text-md font-normal text-gray-100">Manage your workspace settings</span>
      </div>

      <Separator />

      {/* Logo */}
      <div className="flex w-full flex-col gap-sm">
        <span style={labelStyle}>Logo</span>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              // purple fill only behind the initial fallback; a real logo/favicon fills the box
              background: pendingLogo || (faviconUrl && !faviconError) ? 'transparent' : 'rgba(120,58,251,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {pendingLogo ? (
              <img src={pendingLogo} alt="Workspace logo preview" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} />
            ) : faviconUrl && !faviconError ? (
              <img src={faviconUrl} alt="Workspace favicon" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} onError={() => setFaviconError(true)} />
            ) : (
              <span style={{ fontSize: 20, fontWeight: 600, color: '#783AFB', textTransform: 'uppercase', fontFamily: font, userSelect: 'none' }}>
                {initial}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: '#18181B',
                fontFamily: font,
                fontSize: 14,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#52525C'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#18181B'; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Upload
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#71717A', fontFamily: font }}>
                Drag an image or click &ldquo;Upload&rdquo; to browse
              </span>
              <button
                type="button"
                aria-label="Logo upload info"
                style={{ background: 'transparent', border: 'none', cursor: 'default', padding: 0, display: 'inline-flex', alignItems: 'center', color: '#A1A1AA' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 11v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="8" r="0.75" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Local preview only — persisting a workspace logo has no backend yet, so the
            chosen file is shown but not saved. */}
        <input
          ref={fileRef}
          type="file"
          accept=".png,.jpg,.jpeg,.gif,.webp"
          className="hidden"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setPendingLogo(typeof reader.result === 'string' ? reader.result : null);
            reader.readAsDataURL(file);
          }}
        />
      </div>

      <Separator />

      {/* Workspace name */}
      <div className="flex w-full flex-col gap-sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="workspace-name" style={labelStyle}>Workspace name</label>
          <input
            id="workspace-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My workspace"
            maxLength={60}
            style={{
              width: 256,
              height: 40,
              border: '1px solid #D4D4D8',
              borderRadius: 8,
              padding: '0 12px',
              fontSize: 14,
              color: '#18181B',
              background: '#FFFFFF',
              fontFamily: font,
              outline: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(120,58,251,0.1)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'; }}
          />
        </div>
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !current}
        style={{ opacity: saving || !current ? 0.6 : undefined, cursor: saving || !current ? 'default' : 'pointer' }}
        className="gap-sm focus-visible:outline-purple-40 relative inline-flex cursor-pointer items-center justify-center border-none font-sans font-semibold transition-[color,background-color,box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 [&:not(:focus-visible)]:outline-none text-md px-base py-xs rounded-md bg-gray-base text-white-base hover:bg-purple-base active:bg-purple-100"
      >
        {saving && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: 'spin 0.7s linear infinite' }}>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        <span>{saving ? 'Saving…' : 'Save'}</span>
      </button>

      <Separator />

      {/* Search Console */}
      <div className="flex w-full flex-col gap-sm">
        <span style={labelStyle}>Search Console</span>
        {domain ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B', fontFamily: font }}>{domain}</span>
            <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#71717A', fontFamily: font }}>
              Domain property
            </span>
            {gscAccount && (gscAccount.email || gscAccount.picture) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                {gscAccount.picture && !avatarError ? (
                  <img
                    src={gscAccount.picture}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    style={{ width: 28, height: 28, borderRadius: 9999, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <span style={{ width: 28, height: 28, borderRadius: 9999, background: 'rgba(120,58,251,0.12)', color: '#783AFB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0, fontFamily: font, textTransform: 'uppercase' }}>
                    {(gscAccount.email || '?').charAt(0)}
                  </span>
                )}
                <span style={{ fontSize: 14, color: '#52525C', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {gscAccount.email || 'Connected account'}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 13, color: '#71717A', fontFamily: font }}>No Search Console account connected.</span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: '#71717A', fontFamily: font }}>No domain linked to this workspace.</span>
        )}
      </div>

      <Separator />

      {/* Location and language */}
      <div className="flex w-full flex-col gap-sm">
        <span style={labelStyle}>Location and language</span>
        {location ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img
              src={`https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/${location.cc}.svg`}
              alt=""
              style={{ width: 20, height: 15, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }}
            />
            <span style={{ fontSize: 14, color: '#52525C', fontFamily: font }}>
              {location.country} / {location.language}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 13, color: '#71717A', fontFamily: font }}>Not set.</span>
        )}
      </div>

      <Separator />

      {/* Danger zone */}
      <div className="flex w-full flex-col gap-sm">
        <span style={labelStyle}>Danger zone</span>
        <div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing || !current}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              height: 40,
              padding: '0 16px',
              borderRadius: 8,
              background: 'transparent',
              color: '#FF6F77',
              border: '1px solid #FF6F77',
              fontFamily: font,
              fontSize: 14,
              fontWeight: 600,
              cursor: removing || !current ? 'default' : 'pointer',
              opacity: removing || !current ? 0.6 : 1,
              transition: 'background 150ms ease, color 150ms ease',
            }}
            onMouseEnter={(e) => { if (removing || !current) return; e.currentTarget.style.background = '#FF6F77'; e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#FF6F77'; }}
          >
            {removing && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: 'spin 0.7s linear infinite' }}>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            <span>{removing ? 'Removing…' : 'Remove Workspace'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceGeneralSettings;
