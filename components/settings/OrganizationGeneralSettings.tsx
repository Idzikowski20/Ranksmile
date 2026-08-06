import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import ORG_NAME_MAX_LENGTH from '../../lib/organizationLimits';
import { useOrganization, useUpdateOrganization } from '../../services/organization';
import { usePeople } from '../../services/people';
import { Button, Input } from '../koala/core';
import { FileUpload } from '../koala/forms';
import { KoalaSettingsSection, KoalaSettingsRow } from '../koala/layout';

const OrganizationGeneralSettings = () => {
  const [orgName, setOrgName] = useState('');

  const { data: org } = useOrganization();
  const { data: people } = usePeople();
  const updateOrg = useUpdateOrganization();
  // The name and logo belong to the whole org, so PUT /api/organization is owner/admin
  // only. Members still see them — the controls are just read-only.
  const canManage = people?.role === 'owner' || people?.role === 'admin';
  const seeded = useRef(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  // Remove only clears local state; without this the save would omit the logo key
  // entirely and the server would keep the old one.
  const [logoCleared, setLogoCleared] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!org || seeded.current) return;
    seeded.current = true;
    setOrgName(org.name || '');
    setLogoUrl(org.logoUrl);
  }, [org]);

  const handleSave = async () => {
    const name = orgName.trim();
    if (!name) {
      toast.error('Enter an organization name');
      return;
    }
    setSaving(true);
    try {
      const patch: { name?: string; logoDataUrl?: string | null } = { name };
      if (pendingLogo) patch.logoDataUrl = pendingLogo;
      else if (logoCleared) patch.logoDataUrl = null;
      const updated = await updateOrg.mutateAsync(patch);
      if (updated?.logoUrl !== undefined) setLogoUrl(updated.logoUrl);
      setOrgName(name);
      setPendingLogo(null);
      setLogoCleared(false);
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const displayLogo = pendingLogo || logoUrl;

  return (
    <>
      <KoalaSettingsSection title="Logo">
        <KoalaSettingsRow layout="stack" label="Organization logo" description="PNG, JPG, GIF or WEBP.">
          <FileUpload
            className="koala-settings-file-upload"
            accept="image/png,image/jpeg,image/gif,image/webp"
            maxSize={5 * 1024 * 1024}
            preview
            disabled={!canManage}
            valueUrl={displayLogo}
            label="Upload logo"
            description="Drag and drop or browse"
            onUpload={(files) => {
              const file = files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setPendingLogo(typeof reader.result === 'string' ? reader.result : null);
              reader.readAsDataURL(file);
              setLogoCleared(false);
            }}
            onRemove={() => {
              setPendingLogo(null);
              setLogoUrl(null);
              setLogoCleared(true);
            }}
          />
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      <KoalaSettingsSection title="Organization details">
        <KoalaSettingsRow layout="stack" label="Organization name" description="The name shown across your organization.">
          <Input
            id="org-name"
            type="text"
            value={orgName}
            disabled={!canManage}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="e.g. My organization"
            maxLength={ORG_NAME_MAX_LENGTH}
            style={{ width: '100%', maxWidth: 320 }}
          />
        </KoalaSettingsRow>
        {canManage ? (
          <div className="koala-account-actions" style={{ marginTop: 4 }}>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => { handleSave().catch(() => undefined); }}
              busy={saving}
              disabled={saving}
            >
              Save changes
            </Button>
          </div>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>
            Only owners and admins can change the organization name and logo.
          </span>
        )}
      </KoalaSettingsSection>
    </>
  );
};

export default OrganizationGeneralSettings;
