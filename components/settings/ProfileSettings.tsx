import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { authClient } from '../../lib/auth/client';
import { useGscAccount } from '../../services/gscAccount';
import { useProfile, useUpdateProfile } from '../../services/profile';
import { Avatar } from '../core/avatar';
import { Button, Input } from '../core';
import { SentrySettingsSection, SentrySettingsRow } from '../sentry-pages';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const ProfileSettings = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const session = authClient.useSession?.();
  const email = mounted ? (session?.data?.user?.email ?? '') : '';
  const sessionName = mounted ? (session?.data?.user?.name ?? '') : '';
  const { data: gscAccount } = useGscAccount();
  const googlePicture = gscAccount?.picture || '';

  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { if (profile?.name != null) setName(profile.name); }, [profile?.name]);

  const avatarSrc = preview || profile?.avatarUrl || googlePicture || '';
  const initial = (name || sessionName || email || '?').charAt(0).toUpperCase();

  const ingestFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (file.size > MAX_AVATAR_BYTES) { toast.error('Image is too large (max 5MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const save = () => {
    const patch: { name?: string; avatarDataUrl?: string } = { name: name.trim() };
    if (preview) patch.avatarDataUrl = preview;
    updateProfile.mutate(patch, {
      onSuccess: () => {
        setPreview(null);
        toast.success(patch.name ? `Name changed to ${patch.name}` : 'Profile saved');
      },
      onError: () => { toast.error('Could not save your profile'); },
    });
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => { ingestFile(e.target.files?.[0]); e.target.value = ''; }}
      />

      <SentrySettingsSection title="Avatar">
        <SentrySettingsRow
          label="Profile picture"
          description="Drag an image or click Upload. PNG, JPG, GIF or WEBP — up to 5MB."
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 16, borderRadius: 8, outline: dragOver ? '2px dashed #F5A978' : 'none', padding: dragOver ? 8 : 0 }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); ingestFile(e.dataTransfer.files?.[0]); }}
          >
            <Avatar src={avatarSrc || undefined} initials={initial} size={64} variant="secondary" style={{ borderRadius: 9999 }} />
            <Button type="button" size="sm" variant="secondary" icon={<UploadIcon />} onClick={() => fileRef.current?.click()}>
              Upload
            </Button>
          </div>
        </SentrySettingsRow>
      </SentrySettingsSection>

      <SentrySettingsSection title="Account details">
        <SentrySettingsRow label="Full name" description="Your display name across the workspace.">
          <Input
            type="text"
            maxLength={80}
            value={name}
            placeholder={email || 'Your name'}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', maxWidth: 320 }}
          />
        </SentrySettingsRow>
        <SentrySettingsRow
          label="Email"
          description="The unique identifier for your account. It cannot be modified."
        >
          <Input
            type="text"
            disabled
            value={email}
            readOnly
            style={{ width: '100%', maxWidth: 320, opacity: 0.8 }}
          />
        </SentrySettingsRow>
      </SentrySettingsSection>

      <div>
        <Button type="button" variant="primary" onClick={save} disabled={updateProfile.isLoading}>
          {updateProfile.isLoading ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </>
  );
};

export default ProfileSettings;
