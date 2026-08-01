import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaces, useRenameWorkspace, useDeleteWorkspace, Workspace } from '../../services/workspaces';
import { useWorkspaceSettings, useUpdateWorkspaceLogo } from '../../services/workspaceSettings';
import ConfirmModal from '../common/ConfirmModal';
import { Button, Input } from '../koala/core';
import { FileUpload } from '../koala/forms';
import { KoalaSettingsSection, KoalaSettingsRow } from '../koala/layout';

const font = 'var(--font-family-primary)';

type GscAccount = { email: string; picture: string };

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
  const [avatarError, setAvatarError] = useState(false);
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
  const storedLogo = settings?.logoUrl || null;
  const displayLogo = pendingLogo || storedLogo;
  const country = settings?.country || null;
  const language = settings?.language || null;
  const locationCc = settings?.cc || null;

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
      <KoalaSettingsSection title="Logo">
        <KoalaSettingsRow
          layout="stack"
          label="Workspace logo"
          description="PNG, JPG, GIF or WEBP."
        >
          <FileUpload
            className="koala-settings-file-upload"
            accept="image/png,image/jpeg,image/gif,image/webp"
            maxSize={5 * 1024 * 1024}
            preview
            valueUrl={displayLogo}
            label="Upload logo"
            description="Drag and drop or browse"
            onUpload={(files) => {
              const file = files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setPendingLogo(typeof reader.result === 'string' ? reader.result : null);
              reader.readAsDataURL(file);
            }}
            onRemove={() => setPendingLogo(null)}
          />
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      <KoalaSettingsSection title="Workspace details">
        <KoalaSettingsRow layout="stack" label="Workspace name" description="The display name for this workspace.">
          <Input
            id="workspace-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My workspace"
            maxLength={60}
            style={{ width: '100%', maxWidth: 320 }}
          />
        </KoalaSettingsRow>
        <div className="koala-account-actions">
          <Button type="button" variant="primary" onClick={handleSave} disabled={saving || !current}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </KoalaSettingsSection>

      <KoalaSettingsSection title="Search Console">
        <KoalaSettingsRow
          layout="stack"
          label="Connected property"
          description="The Google Search Console domain linked to this workspace."
        >
          {domain ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--koala-text-primary)', fontFamily: font }}>{domain}</span>
              <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--koala-text-tertiary)', fontFamily: font }}>
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
                    <span style={{ width: 28, height: 28, borderRadius: 9999, background: 'color-mix(in srgb, var(--koala-brand) 12%, transparent)', color: 'var(--koala-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0, fontFamily: font, textTransform: 'uppercase' }}>
                      {(gscAccount.email || '?').charAt(0)}
                    </span>
                  )}
                  <span style={{ fontSize: 14, color: 'var(--koala-text-secondary)', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {gscAccount.email || 'Connected account'}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--koala-text-tertiary)', fontFamily: font }}>No Search Console account connected.</span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--koala-text-tertiary)', fontFamily: font }}>No domain linked to this workspace.</span>
          )}
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      <KoalaSettingsSection title="Location and language">
        <KoalaSettingsRow layout="stack" label="Target market" description="Country and language configured for this workspace.">
          {country || language ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {locationCc && (
                <img
                  src={`https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/${locationCc}.svg`}
                  alt=""
                  style={{ width: 20, height: 15, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <span style={{ fontSize: 14, color: 'var(--koala-text-secondary)', fontFamily: font }}>
                {[country, language].filter(Boolean).join(' / ')}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--koala-text-tertiary)', fontFamily: font }}>Not set.</span>
          )}
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      <KoalaSettingsSection title="Danger zone">
        <KoalaSettingsRow
          layout="stack"
          label="Remove workspace"
          description="Permanently delete this workspace and all of its content. This action cannot be undone."
        >
          <div className="koala-account-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={removing || !current}
              style={{ color: 'var(--koala-status-danger)', borderColor: 'var(--koala-status-danger)' }}
            >
              {removing ? 'Removing…' : 'Remove workspace'}
            </Button>
          </div>
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      <ConfirmModal
        open={confirmOpen}
        destructive
        title="Remove Workspace?"
        message={current ? (
          <>
            This action cannot be undone. All content in this workspace will be removed. To proceed, enter the workspace name
            {' '}
            <strong style={{ color: 'var(--koala-text-primary)', fontWeight: 600 }}>{current.name}</strong>
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
