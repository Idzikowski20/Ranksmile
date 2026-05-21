import React from 'react';
import { useMutateKeywordsVolume, useTestAdwordsIntegration } from '../../services/adwords';
import Icon from '../common/Icon';

type AdWordsSettingsProps = {
  settings: SettingsType,
  settingsError?: null | { type: string, msg: string },
  updateSettings?: Function,
  performUpdate?: Function,
  closeSettings?: Function,
}

const EnvBadge = ({ value }: { value: string }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '1px 8px',
      borderRadius: 6,
      fontSize: 12,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      background: value ? '#f0fdf4' : '#f4f4f5',
      color: value ? '#15803d' : '#9f9fa9',
      border: `1px solid ${value ? '#bbf7d0' : '#e4e4e7'}`,
      fontWeight: 500,
    }}
  >
    {value || 'not set'}
  </span>
);

const ActionButton = ({
  onClick, disabled, loading, children,
}: { onClick: () => void; disabled: boolean; loading?: boolean; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 20px',
      borderRadius: 8,
      border: '1px solid #D4D4D8',
      background: '#fff',
      fontSize: 14,
      lineHeight: '20px',
      fontWeight: 600,
      color: '#2F2F34',
      cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
      fontFamily: 'var(--font-family-primary)',
      opacity: (disabled || loading) ? 0.5 : 1,
      transition: 'background 0.15s, box-shadow 0.15s',
      boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
    }}
    onMouseEnter={(e) => { if (!disabled && !loading) (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
  >
    {loading ? <Icon type="loading" size={16} /> : children}
  </button>
);

const AdWordsSettings = ({ settings }: AdWordsSettingsProps) => {
  const {
    adwords_client_id = '',
    adwords_client_secret = '',
    adwords_developer_token = '',
    adwords_account_id = '',
    adwords_refresh_token = '',
  } = settings || {};

  const { mutate: testAdWordsIntegration, isLoading: isTesting } = useTestAdwordsIntegration();
  const { mutate: getAllVolumeData, isLoading: isUpdatingVolume } = useMutateKeywordsVolume();

  // The API returns '(set)' for configured env vars and '(connected)' for a live refresh token.
  const clientReady = !!(adwords_client_id && adwords_client_secret);
  const hasAllCredentials = !!(clientReady && adwords_developer_token && adwords_account_id && adwords_refresh_token);

  const envRows = [
    { key: 'ADWORDS_CLIENT_ID', label: 'Client ID', value: adwords_client_id },
    { key: 'ADWORDS_CLIENT_SECRET', label: 'Client Secret', value: adwords_client_secret },
    { key: 'ADWORDS_DEVELOPER_TOKEN', label: 'Developer Token', value: adwords_developer_token },
    { key: 'ADWORDS_ACCOUNT_ID', label: 'Account ID', value: adwords_account_id },
    { key: 'ADWORDS_REFRESH_TOKEN', label: 'OAuth Refresh Token', value: adwords_refresh_token },
  ];

  const handleOAuthConnect = async () => {
    if (!clientReady) return;
    try {
      const resp = await fetch(`${window.location.origin}/api/adwords?get_url=1`);
      const data = await resp.json();
      if (data.url) window.open(data.url, '_blank');
    } catch (e) {
      console.error('[AdWords] Failed to get OAuth URL', e);
    }
  };

  const testIntegration = () => {
    if (hasAllCredentials) {
      // POST body params are ignored by the server — credentials come from .env
      testAdWordsIntegration({ developer_token: '', account_id: '' });
    }
  };

  const updateVolumeData = () => {
    if (hasAllCredentials) {
      getAllVolumeData({ domain: 'all' });
    }
  };

  const oauthCard: React.CSSProperties = {
    padding: 20,
    marginBottom: 24,
    borderRadius: 8,
    border: '1px solid #E4E4E7',
    background: '#FAFAFA',
  };

  return (
    <div>
      {/* Info banner */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: 10,
          background: '#fffbeb',
          border: '1px solid #fde68a',
          fontSize: 13,
          color: '#92400e',
          lineHeight: 1.5,
          marginBottom: 24,
        }}
      >
        Google Ads credentials are configured via environment variables in your{' '}
        <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>.env</code> file.
        Set{' '}
        <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>ADWORDS_CLIENT_ID</code>,{' '}
        <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>ADWORDS_CLIENT_SECRET</code>,{' '}
        <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>ADWORDS_DEVELOPER_TOKEN</code>, and{' '}
        <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>ADWORDS_ACCOUNT_ID</code>,
        then restart the server and run the OAuth flow below.
      </div>

      {/* Env status table */}
      <div style={oauthCard}>
        <h4 style={{ margin: '0 0 4px', fontSize: 14, lineHeight: '20px', fontWeight: 600, color: '#2F2F34', fontFamily: 'var(--font-family-primary)' }}>
          Environment Variables
        </h4>
        <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: '16px', color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
          Current status of your Google Ads configuration.
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9f9fa9', paddingBottom: 8, borderBottom: '1px solid #e4e4e7' }}>Variable</th>
              <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9f9fa9', paddingBottom: 8, borderBottom: '1px solid #e4e4e7' }}>Description</th>
              <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9f9fa9', paddingBottom: 8, borderBottom: '1px solid #e4e4e7' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {envRows.map((row) => (
              <tr key={row.key} style={{ borderBottom: '1px solid #f4f4f5' }}>
                <td style={{ padding: '10px 0', fontSize: 12, fontFamily: 'ui-monospace, monospace', color: '#3f3f47', verticalAlign: 'middle', paddingRight: 16 }}>
                  {row.key}
                </td>
                <td style={{ padding: '10px 0', fontSize: 13, color: '#71717a', verticalAlign: 'middle', paddingRight: 16 }}>
                  {row.label}
                </td>
                <td style={{ padding: '10px 0', verticalAlign: 'middle' }}>
                  <EnvBadge value={row.value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* OAuth connect */}
      <div style={{ ...oauthCard, opacity: clientReady ? 1 : 0.6 }}>
        <h4 style={{ margin: '0 0 4px', fontSize: 14, lineHeight: '20px', fontWeight: 600, color: '#2F2F34', fontFamily: 'var(--font-family-primary)' }}>
          OAuth2 Connection
        </h4>
        <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: '16px', color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
          Authorize access to your Google Ads account. Requires{' '}
          <code style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>ADWORDS_CLIENT_ID</code> and{' '}
          <code style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>ADWORDS_CLIENT_SECRET</code> to be set.
        </p>

        <ActionButton onClick={handleOAuthConnect} disabled={!clientReady}>
          {/* Google G icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {adwords_refresh_token ? 'Reconnect Google Ads' : 'Connect Google Ads'}
        </ActionButton>

        {adwords_refresh_token && (
          <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: '16px', color: '#16A34A', fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>
            ✓ Google Ads OAuth2 connected
          </p>
        )}
      </div>

      {/* Test + Volume */}
      <div style={{ ...oauthCard, opacity: hasAllCredentials ? 1 : 0.6 }}>
        <h4 style={{ margin: '0 0 4px', fontSize: 14, lineHeight: '20px', fontWeight: 600, color: '#2F2F34', fontFamily: 'var(--font-family-primary)' }}>
          Actions
        </h4>
        <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: '16px', color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
          Test your integration or refresh keyword volume data for all tracked keywords.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ActionButton onClick={testIntegration} disabled={!hasAllCredentials} loading={isTesting}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />
            </svg>
            Test Connection
          </ActionButton>

          <ActionButton onClick={updateVolumeData} disabled={!hasAllCredentials} loading={isUpdatingVolume}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
            Update Keywords Volume Data
          </ActionButton>
        </div>
      </div>

      <p style={{ margin: '16px 0 0', fontSize: 12, lineHeight: '16px', color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
        Documentation:{' '}
        <a
          target="_blank"
          rel="noreferrer"
          href="https://docs.serpbear.com/miscellaneous/integrate-google-ads"
          style={{ color: '#783AFB', textDecoration: 'underline' }}
        >
          Integrate Google Ads
        </a>
      </p>
    </div>
  );
};

export default AdWordsSettings;
