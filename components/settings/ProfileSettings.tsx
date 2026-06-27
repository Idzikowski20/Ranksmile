import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { authClient } from '../../lib/auth/client';
import { useGscAccount } from '../../services/gscAccount';
import { useProfile, useUpdateProfile } from '../../services/profile';

const font = 'var(--font-family-primary)';
const labelStyle: React.CSSProperties = { fontFamily: font, fontSize: 14, fontWeight: 500, color: '#3F3F47' };

// ─── Icons ────────────────────────────────────────────────────────────────────

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ flexShrink: 0, color: '#9F9FA9' }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" />
  </svg>
);

// ─── Atoms ────────────────────────────────────────────────────────────────────

const Separator = () => (
  <div role="separator" style={{ minHeight: 1, alignSelf: 'stretch', background: '#F4F4F5', margin: '16px 0' }} />
);

const inputBase: React.CSSProperties = {
  width: 256,
  maxWidth: '100%',
  boxSizing: 'border-box',
  height: 40,
  padding: '0 12px',
  fontFamily: font,
  fontSize: 14,
  color: '#18181B',
  borderRadius: 8,
  boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
  outline: 'none',
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

// ─── Main component ───────────────────────────────────────────────────────────

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
  const [preview, setPreview] = useState<string | null>(null); // pending avatar data URL
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadHover, setUploadHover] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [saveHover, setSaveHover] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Prefill the name once the saved profile loads.
  useEffect(() => { if (profile?.name != null) setName(profile.name); }, [profile?.name]);

  // Avatar shown: pending upload → saved custom → Google (default) → initials.
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, width: '100%', fontFamily: font }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => { ingestFile(e.target.files?.[0]); e.target.value = ''; }}
      />

      {/* Profile Picture */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, width: '100%' }}>
        <label style={labelStyle}>Profile Picture</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{ display: 'flex', alignItems: 'flex-start', gap: 24, borderRadius: 12, padding: dragOver ? 8 : 0, margin: dragOver ? -8 : 0, outline: dragOver ? '2px dashed #AA93FD' : 'none', transition: 'outline 120ms ease' }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); ingestFile(e.dataTransfer.files?.[0]); }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 9999,
                background: avatarSrc ? 'transparent' : '#F4F4F5',
                color: '#09090B',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 500,
                textTransform: 'uppercase',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {avatarSrc ? <img alt="" src={avatarSrc} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onMouseEnter={() => setUploadHover(true)}
              onMouseLeave={() => setUploadHover(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontFamily: font,
                fontSize: 14,
                fontWeight: 600,
                color: uploadHover ? '#2F2F34' : '#3F3F47',
                transition: 'color 150ms ease',
              }}
            >
              <UploadIcon />
              Upload
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: font, fontSize: 13, color: '#52525C' }}>Drag an image or click &quot;Upload&quot; to browse</span>
            <button
              type="button"
              onClick={() => toast('PNG, JPG, GIF or WEBP — up to 5MB')}
              style={{ display: 'inline-flex', alignItems: 'center', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <InfoIcon />
            </button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Full name */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <label style={{ ...labelStyle, paddingBottom: 6 }}>Full name</label>
        <input
          type="text"
          maxLength={80}
          value={name}
          placeholder={email || 'Your name'}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
          style={{
            ...inputBase,
            background: '#fff',
            border: `1px solid ${nameFocused ? '#AA93FD' : '#E4E4E7'}`,
            boxShadow: nameFocused ? '0 0 0 3px rgba(120,58,251,0.1)' : inputBase.boxShadow,
          }}
        />
      </div>

      {/* Email (disabled) */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <label style={{ ...labelStyle, paddingBottom: 6 }}>Email</label>
        <input
          type="text"
          disabled
          value={email}
          readOnly
          style={{
            ...inputBase,
            background: '#F8F8F9',
            border: '1px solid #E4E4E7',
            opacity: 0.8,
            cursor: 'not-allowed',
          }}
        />
      </div>

      <button
        type="button"
        onClick={save}
        disabled={updateProfile.isLoading}
        onMouseEnter={() => setSaveHover(true)}
        onMouseLeave={() => setSaveHover(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 16px',
          borderRadius: 6,
          border: 'none',
          cursor: updateProfile.isLoading ? 'not-allowed' : 'pointer',
          fontFamily: font,
          fontSize: 14,
          fontWeight: 600,
          color: '#fff',
          background: saveHover && !updateProfile.isLoading ? '#783AFB' : '#18181B',
          opacity: updateProfile.isLoading ? 0.7 : 1,
          transition: 'background 150ms ease',
        }}
      >
        {updateProfile.isLoading ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
};

export default ProfileSettings;
