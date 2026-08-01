import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { changePassword } from '../../lib/auth/fetchAuth';
import { authClient } from '../../lib/auth/client';
import { useGscAccount } from '../../services/gscAccount';
import { useProfile, useUpdateProfile } from '../../services/profile';
import { useDeleteAccount } from '../../services/accountSecurity';
import { Button, Input } from '../koala/core';
import {
  Field,
  FieldGroup,
  FormActions,
  FormSection,
  PasswordStrength,
  evaluatePasswordRules,
  passwordRulesComplete,
  FileUpload,
  DangerCard,
  DangerAction,
  DangerDialog,
} from '../koala/forms';
import { ThemeSwitcher } from '../koala/theme';
import { Enable2FADialog } from '../koala/product/Enable2FADialog';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Account / Profile — Koala Settings (Figma Account incl. Password `7906:208746`).
 */
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
  const deleteAccount = useDeleteAccount();

  const [name, setName] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => { if (profile?.name != null) setName(profile.name); }, [profile?.name]);

  const avatarSrc = preview || profile?.avatarUrl || googlePicture || '';

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

  const clearAvatar = () => {
    setPreview(null);
    toast('Remove avatar from your account settings when available.', { icon: 'ℹ️' });
  };

  const updatePassword = async () => {
    if (!currentPassword) {
      toast.error('Enter your current password');
      return;
    }
    const rules = evaluatePasswordRules(newPassword);
    if (!passwordRulesComplete(rules)) {
      toast.error('New password must meet all rules');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (!result.ok) {
        toast.error(result.error.message || 'Could not update password');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated');
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <>
      <FormSection title="Profile" className="koala-account-section">
        <FileUpload
          accept="image/png,image/jpeg,image/gif,image/webp"
          maxSize={MAX_AVATAR_BYTES}
          maxFiles={1}
          preview
          valueUrl={avatarSrc || null}
          label="Profile photo"
          description="PNG, JPG, GIF or WEBP"
          onUpload={(files) => ingestFile(files[0])}
          onRemove={clearAvatar}
        />

        <FieldGroup className="koala-account-form-grid">
          <Field label="Full Name" required>
            <Input
              type="text"
              maxLength={80}
              value={name}
              placeholder={email || 'Your name'}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Email Address" required>
            <Input type="text" disabled value={email} readOnly style={{ opacity: 0.85 }} />
          </Field>
        </FieldGroup>

        <FormActions className="koala-account-actions">
          <Button type="button" variant="primary" onClick={save} disabled={updateProfile.isLoading}>
            {updateProfile.isLoading ? 'Saving…' : 'Save changes'}
          </Button>
        </FormActions>
      </FormSection>

      <FormSection title="Appearance" className="koala-account-section">
        <p className="koala-account-section__desc">
          Koala themes: Light, Dark, Cream, and Moonlight. Preference is saved on this device.
        </p>
        <ThemeSwitcher />
      </FormSection>

      <FormSection title="Password" className="koala-account-section">
        <p className="koala-account-section__desc">Set a password that is unique.</p>

        <div className="koala-password-stack">
          <div className="koala-password-field">
            <Field label="Current password" required>
              <Input
                type="password"
                revealable
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="•••••••••••••••••"
              />
            </Field>
          </div>

          <div className="koala-password-row">
            <div className="koala-password-field">
              <Field label="New password" required>
                <Input
                  type="password"
                  revealable
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </Field>
              <div className="koala-password-strength">
                <PasswordStrength value={newPassword} />
              </div>
            </div>

            <div className="koala-password-field">
              <Field label="Confirm new password" required>
                <Input
                  type="password"
                  revealable
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </Field>
            </div>
          </div>

          <div className="koala-account-actions">
            <Button
              type="button"
              size="md"
              variant="primary"
              className="koala-password-update"
              busy={passwordBusy}
              disabled={passwordBusy}
              onClick={() => { void updatePassword(); }}
            >
              Update password
            </Button>
          </div>
        </div>
      </FormSection>

      <FormSection title="Two-Factor Authentication" className="koala-account-section">
        <p className="koala-account-section__desc">
          Add an extra layer of security to your account. It is highly recommended.
        </p>
        <div className="koala-account-actions">
          <Button type="button" variant="secondary" size="sm" onClick={() => setMfaOpen(true)}>
            Set up authentication
          </Button>
        </div>
      </FormSection>

      <DangerCard className="koala-account-section">
        <DangerAction
          title="Delete your account"
          description="Permanently remove your Ranksmile account and associated personal data. This cannot be undone."
          actionLabel="Delete account"
          onAction={() => setDeleteOpen(true)}
        />
      </DangerCard>

      <Enable2FADialog open={mfaOpen} onClose={() => setMfaOpen(false)} />
      <DangerDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        description="Are you sure you want to delete your account? All of your personal data will be permanently removed. This action cannot be undone."
        confirmLabel="Delete"
        busy={deleteAccount.isLoading}
        onConfirm={() => {
          deleteAccount.mutate(undefined, {
            onSettled: () => setDeleteOpen(false),
          });
        }}
      />
    </>
  );
};

export default ProfileSettings;
