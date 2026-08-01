import React, { useState } from 'react';
import { useProfile, useUpdateProfile } from '../../services/profile';
import { Switch } from '../koala/core';
import { KoalaSettingsSection, KoalaSettingsRow } from '../koala/layout';

/** Your account → Notifications: a single per-user product-updates opt-in (Ranksmile parity). */
const AccountNotificationSettings = () => {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [pending, setPending] = useState<boolean | null>(null);
  const checked = pending !== null ? pending : !!profile?.productUpdates;

  const toggle = (next: boolean) => {
    setPending(next);
    updateProfile.mutate({ productUpdates: next }, { onSettled: () => setPending(null) });
  };

  return (
    <KoalaSettingsSection title="Product updates">
      <KoalaSettingsRow
        label="Email notifications"
        description="Get product updates, educational resources, and live event info."
      >
        <Switch
          checked={checked}
          onChange={toggle}
          aria-label="Get product updates, educational resources, and live event info"
        />
      </KoalaSettingsRow>
    </KoalaSettingsSection>
  );
};

export default AccountNotificationSettings;
