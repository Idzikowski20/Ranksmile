import React from 'react';
import { Alert, Input, Select } from '../koala/core';
import { KoalaSettingsSection, KoalaSettingsRow } from '../koala/layout';

type NotificationSettingsProps = {
  settings: SettingsType;
  settingsError: null | {
    type: string;
    msg: string;
  };
  updateSettings: Function;
};

const INTERVAL_OPTIONS = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Never', value: 'never' },
];

const NotificationSettings = ({ settings, settingsError, updateSettings }: NotificationSettingsProps) => {
  const showSmtp = settings.notification_interval !== 'never';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <KoalaSettingsSection title="Email notifications">
        <KoalaSettingsRow
          label="Notification frequency"
          description="How often rank-change alerts are sent to your team."
        >
          <Select
            options={INTERVAL_OPTIONS}
            value={settings.notification_interval}
            onChange={(value) => updateSettings('notification_interval', value)}
            width={220}
          />
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      {showSmtp && (
        <KoalaSettingsSection title="SMTP delivery">
          <KoalaSettingsRow label="Notification emails" description="Comma-separated list of recipients.">
            <Input
              type="text"
              value={settings?.notification_email || ''}
              placeholder="test@gmail.com, test2@test.com"
              onChange={(e) => updateSettings('notification_email', e.target.value)}
              aria-invalid={settingsError?.type === 'no_email'}
              style={{ width: '100%', maxWidth: 420 }}
            />
          </KoalaSettingsRow>

          <KoalaSettingsRow label="SMTP server">
            <Input
              type="text"
              value={settings?.smtp_server || ''}
              placeholder="smtp.example.com"
              onChange={(e) => updateSettings('smtp_server', e.target.value)}
              aria-invalid={settingsError?.type === 'no_smtp_server'}
              style={{ width: '100%', maxWidth: 420 }}
            />
          </KoalaSettingsRow>

          <KoalaSettingsRow label="SMTP port">
            <Input
              type="text"
              value={settings?.smtp_port || ''}
              placeholder="587"
              onChange={(e) => updateSettings('smtp_port', e.target.value)}
              aria-invalid={settingsError?.type === 'no_smtp_port'}
              style={{ width: '100%', maxWidth: 160 }}
            />
          </KoalaSettingsRow>

          <KoalaSettingsRow label="SMTP username">
            <Input
              type="text"
              value={settings?.smtp_username || ''}
              onChange={(e) => updateSettings('smtp_username', e.target.value)}
              style={{ width: '100%', maxWidth: 420 }}
            />
          </KoalaSettingsRow>

          <KoalaSettingsRow label="SMTP password">
            <Input
              type="password"
              value={settings?.smtp_password || ''}
              onChange={(e) => updateSettings('smtp_password', e.target.value)}
              autoComplete="new-password"
              style={{ width: '100%', maxWidth: 420 }}
            />
          </KoalaSettingsRow>

          <KoalaSettingsRow label="From email address">
            <Input
              type="email"
              value={settings?.notification_email_from || ''}
              placeholder="no-reply@mydomain.com"
              onChange={(e) => updateSettings('notification_email_from', e.target.value)}
              aria-invalid={settingsError?.type === 'no_smtp_from'}
              style={{ width: '100%', maxWidth: 420 }}
            />
          </KoalaSettingsRow>

          <KoalaSettingsRow label="Email from name">
            <Input
              type="text"
              value={settings?.notification_email_from_name || 'Ranksmile'}
              placeholder="Ranksmile"
              onChange={(e) => updateSettings('notification_email_from_name', e.target.value)}
              style={{ width: '100%', maxWidth: 420 }}
            />
          </KoalaSettingsRow>
        </KoalaSettingsSection>
      )}

      {settingsError?.msg && (
        <Alert variant="error">{settingsError.msg}</Alert>
      )}
    </div>
  );
};

export default NotificationSettings;
