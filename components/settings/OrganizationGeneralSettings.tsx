import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useOrganization, useUpdateOrganization } from '../../services/organization';
import { Button, Input } from '../koala/core';
import { FileUpload } from '../koala/forms';
import { KoalaSettingsSection, KoalaSettingsRow } from '../koala/layout';

const OrganizationGeneralSettings = () => {
  const [orgName, setOrgName] = useState('');

  const { data: org } = useOrganization();
  const updateOrg = useUpdateOrganization();
  const seeded = useRef(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!org || seeded.current) return;
    seeded.current = true;
    setOrgName(org.name || '');
    setLogoUrl(org.logoUrl);
  }, [org]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: { name?: string; logoDataUrl?: string } = { name: orgName };
      if (pendingLogo) patch.logoDataUrl = pendingLogo;
      const updated = await updateOrg.mutateAsync(patch);
      if (updated?.logoUrl !== undefined) setLogoUrl(updated.logoUrl);
      setPendingLogo(null);
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
            onRemove={() => {
              setPendingLogo(null);
              setLogoUrl(null);
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
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="e.g. My organization"
            maxLength={40}
            style={{ width: '100%', maxWidth: 320 }}
          />
        </KoalaSettingsRow>
        <div className="koala-account-actions" style={{ marginTop: 4 }}>
          <Button type="button" variant="primary" size="sm" onClick={() => { void handleSave(); }} busy={saving} disabled={saving}>
            Save changes
          </Button>
        </div>
      </KoalaSettingsSection>
    </>
  );
};

export default OrganizationGeneralSettings;
