import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useWorkspaces, useRenameWorkspace, useDeleteWorkspace, Workspace } from '../../services/workspaces';
import { useWorkspaceSettings, useUpdateWorkspaceLogo } from '../../services/workspaceSettings';
import ConfirmModal from '../common/ConfirmModal';
import { Button, Input } from '../core';
import { SentrySettingsSection, SentrySettingsRow } from '../sentry-pages';
import { faviconUrl } from '../../lib/faviconUrl';

const font = 'var(--font-family-primary)';

type GscAccount = { email: string; picture: string };

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

/** Strip protocol, `sc-domain:` prefix and any path so we get a bare host like "idztech.pl". */
const cleanDomain = (raw: string): string => raw
  .replace(/^sc-domain:/i, '')
  .replace(/^https?:\/\//i, '')
  .replace(/\/.*$/, '')
  .trim()
  .toLowerCase();

const WorkspaceGeneralSettings = () => {
  const { data: wsData } = useWorkspaces();
  const { data: settings } = useWorkspaceSettings();
  const renameWorkspace = useRenameWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const updateLogo = useUpdateWorkspaceLogo();

  const current: Workspace | null = useMemo(() => {
    const list = wsData?.workspaces || [];
    if (list.length === 0) return null;
    return list.find((w) => w.id === wsData?.activeId) || list[0];
  }, [wsData]);

  const [name, setName] = useState('');
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
  const workspaceFaviconSrc = domain ? faviconUrl(domain, 64) : '';
  const storedLogo = settings?.logoUrl || null;
  const displayLogo = pendingLogo || storedLogo;
  const country = settings?.country || null;
  const language = settings?.language || null;
  const locationCc = settings?.cc || null;
  const initial = (current?.name || '').charAt(0).toUpperCase() || '?';

  const handleSave = async () => {
    if (!current) return;
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Enter a workspace name'); return; }
    setSaving(true);
    try {
      await renameWorkspace.mutateAsync({ id: current.id, name: trimmed });
      if (pendingLogo) {
        await updateLogo.mutateAsync(pendingLogo);
        setPendingLogo(null);
      }
      toast.success('Saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const doRemove = () => {
    if (!current) return;
    setRemoving(true);
    deleteWorkspace.mutate(current.id, {
      onSuccess: () => { if (typeof window !== 'undefined') window.location.href = '/'; },
      onError: (e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to remove workspace');
        setRemoving(false);
        setConfirmOpen(false);
      },
    });
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".png,.jpg,.jpeg,.gif,.webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => setPendingLogo(typeof reader.result === 'string' ? reader.result : null);
          reader.readAsDataURL(file);
        }}
      />

      <SentrySettingsSection title="Logo">
        <SentrySettingsRow
          label="Workspace logo"
          description="Drag an image or click Upload. Falls back to your domain favicon when unset."
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 8,
                background: displayLogo || (workspaceFaviconSrc && !faviconError) ? 'transparent' : 'rgba(242,153,100,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {displayLogo ? (
                <Image
                  src={displayLogo}
                  alt="Workspace logo"
                  width={64}
                  height={64}
                  unoptimized
                  style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }}
                />
              ) : workspaceFaviconSrc && !faviconError ? (
                <img src={workspaceFaviconSrc} alt="Workspace favicon" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} onError={() => setFaviconError(true)} />
              ) : (
                <span style={{ fontSize: 20, fontWeight: 600, color: '#F29964', textTransform: 'uppercase', fontFamily: font, userSelect: 'none' }}>
                  {initial}
                </span>
              )}
            </div>
            <Button type="button" size="sm" variant="secondary" icon={<UploadIcon />} onClick={() => fileRef.current?.click()}>
              Upload
            </Button>
          </div>
        </SentrySettingsRow>
      </SentrySettingsSection>

      <SentrySettingsSection title="Workspace details">
        <SentrySettingsRow label="Workspace name" description="The display name for this workspace.">
          <Input
            id="workspace-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My workspace"
            maxLength={60}
            style={{ width: '100%', maxWidth: 320 }}
          />
        </SentrySettingsRow>
      </SentrySettingsSection>

      <div>
        <Button type="button" variant="primary" onClick={handleSave} disabled={saving || !current}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      <SentrySettingsSection title="Search Console">
        <SentrySettingsRow
          label="Connected property"
          description="The Google Search Console domain linked to this workspace."
        >
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
                    <span style={{ width: 28, height: 28, borderRadius: 9999, background: 'rgba(242,153,100,0.12)', color: '#F29964', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0, fontFamily: font, textTransform: 'uppercase' }}>
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
        </SentrySettingsRow>
      </SentrySettingsSection>

      <SentrySettingsSection title="Location and language">
        <SentrySettingsRow label="Target market" description="Country and language configured for this workspace.">
          {country || language ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {locationCc && (
                <img
                  src={`https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/${locationCc}.svg`}
                  alt=""
                  style={{ width: 20, height: 15, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <span style={{ fontSize: 14, color: '#52525C', fontFamily: font }}>
                {[country, language].filter(Boolean).join(' / ')}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: '#71717A', fontFamily: font }}>Not set.</span>
          )}
        </SentrySettingsRow>
      </SentrySettingsSection>

      <SentrySettingsSection title="Danger zone">
        <SentrySettingsRow
          label="Remove workspace"
          description="Permanently delete this workspace and all of its content. This action cannot be undone."
        >
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmOpen(true)}
            disabled={removing || !current}
            style={{ color: '#FF6F77', borderColor: '#FF6F77' }}
          >
            {removing ? 'Removing…' : 'Remove workspace'}
          </Button>
        </SentrySettingsRow>
      </SentrySettingsSection>

      <ConfirmModal
        open={confirmOpen}
        destructive
        title="Remove Workspace?"
        message={current ? (
          <>
            This action cannot be undone. All content in this workspace will be removed. To proceed, enter the workspace name
            {' '}
            <strong style={{ color: '#18181B', fontWeight: 600 }}>{current.name}</strong>
            {' '}
            below to confirm deletion.
          </>
        ) : 'This action cannot be undone. All content in this workspace will be removed.'}
        confirmText={current?.name || ''}
        confirmFieldLabel="Workspace name"
        confirmHint="Case sensitive"
        confirmLabel="Remove Workspace"
        loading={removing}
        onConfirm={doRemove}
        onClose={() => { if (!removing) setConfirmOpen(false); }}
      />
    </>
  );
};

export default WorkspaceGeneralSettings;
