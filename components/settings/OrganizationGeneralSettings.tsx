import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useOrganization, useUpdateOrganization } from '../../services/organization';
import { Button, Input } from '../core';
import { SentrySettingsSection, SentrySettingsRow } from '../sentry-pages';

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const OrganizationGeneralSettings = () => {
  const [orgName, setOrgName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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
  const initial = (orgName || 'P').charAt(0).toUpperCase();

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
          label="Organization logo"
          description="Drag an image or click Upload. PNG, JPG, GIF or WEBP."
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 8,
                background: displayLogo ? 'transparent' : 'rgba(120,58,251,0.10)',
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
                  alt="Organization logo"
                  width={64}
                  height={64}
                  unoptimized
                  style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 20, fontWeight: 600, color: '#783AFB', textTransform: 'uppercase', fontFamily: 'var(--font-family-primary)', userSelect: 'none' }}>
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

      <SentrySettingsSection title="Organization details">
        <SentrySettingsRow label="Organization name" description="The name shown across your organization.">
          <Input
            id="org-name"
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="e.g. My organization"
            maxLength={40}
            style={{ width: '100%', maxWidth: 320 }}
          />
        </SentrySettingsRow>
      </SentrySettingsSection>

      <div>
        <Button type="button" variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </>
  );
};

export default OrganizationGeneralSettings;
