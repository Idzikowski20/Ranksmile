import React from 'react';
import { useMutateKeywordsVolume, useTestAdwordsIntegration } from '../../services/adwords';
import Icon from '../common/Icon';

type AdWordsSettingsProps = {
  settings: SettingsType,
  settingsError: null | {
    type: string,
    msg: string
  },
  updateSettings: Function,
  performUpdate: Function,
  closeSettings: Function
}

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  color: '#3F3F47',
  fontFamily: 'var(--font-family-primary)',
  display: 'block',
  paddingBottom: 6,
};

const fieldGroup: React.CSSProperties = {
  marginBottom: 20,
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  padding: '0 12px',
  border: '1px solid #D4D4D8',
  borderRadius: 8,
  fontSize: 14,
  lineHeight: '20px',
  color: '#2F2F34',
  background: '#fff',
  outline: 'none',
  fontFamily: 'var(--font-family-primary)',
  boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 600,
  color: '#2F2F34',
  fontFamily: 'var(--font-family-primary)',
};

const sectionDesc: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: 13,
  lineHeight: '16px',
  color: '#52525C',
  fontFamily: 'var(--font-family-primary)',
};

const oauthCard: React.CSSProperties = {
  padding: 20,
  marginBottom: 24,
  borderRadius: 8,
  border: '1px solid #E4E4E7',
  background: '#FAFAFA',
};

const AdWordsSettings = ({ settings, updateSettings, performUpdate, closeSettings }: AdWordsSettingsProps) => {
  const {
    adwords_client_id = '',
    adwords_client_secret = '',
    adwords_developer_token = '',
    adwords_account_id = '',
    adwords_refresh_token = '',
  } = settings || {};

  const { mutate: testAdWordsIntegration, isLoading: isTesting } = useTestAdwordsIntegration();
  const { mutate: getAllVolumeData, isLoading: isUpdatingVolume } = useMutateKeywordsVolume();

  const cloudProjectIntegrated = !!(adwords_client_id && adwords_client_secret && adwords_refresh_token);
  const hasAllCredentials = !!(cloudProjectIntegrated && adwords_developer_token && adwords_account_id);

  const handleOAuthConnect = () => {
    if (!adwords_client_id || !adwords_client_secret) return;
    const redirectUri = `${window.location.origin}/api/adwords`;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth/oauthchooseaccount?access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fadwords&response_type=code&client_id=${adwords_client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&service=lso&o2v=2&theme=glif&flowName=GeneralOAuthFlow`;
    window.open(authUrl, '_blank');
    if (performUpdate) {
      performUpdate();
      closeSettings();
    }
  };

  const testIntegration = () => {
    if (hasAllCredentials) {
      testAdWordsIntegration({ developer_token: adwords_developer_token, account_id: adwords_account_id });
    }
  };

  const updateVolumeData = () => {
    if (hasAllCredentials) {
      getAllVolumeData({ domain: 'all' });
    }
  };

  return (
    <div>
      {/* ─── Step 1: OAuth2 Connection ─── */}
      <div style={oauthCard}>
        <h4 style={sectionTitle}>Step 1: Connect with Google OAuth2</h4>
        <p style={sectionDesc}>
          Create a Google Cloud Project, configure the OAuth consent screen, and enter your client credentials below.
        </p>

        <div style={fieldGroup}>
          <label style={labelStyle}>Client ID</label>
          <input
            style={inputStyle}
            value={adwords_client_id}
            placeholder="3943006-231f65cjm.apps.googleusercontent.com"
            onChange={(e) => updateSettings('adwords_client_id', e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; }}
          />
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>Client Secret</label>
          <input
            style={inputStyle}
            value={adwords_client_secret}
            placeholder="GOCSPX-..."
            onChange={(e) => updateSettings('adwords_client_secret', e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; }}
          />
        </div>

        <button
          type="button"
          onClick={handleOAuthConnect}
          disabled={!adwords_client_id || !adwords_client_secret}
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
            cursor: (adwords_client_id && adwords_client_secret) ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-family-primary)',
            opacity: (adwords_client_id && adwords_client_secret) ? 1 : 0.5,
            transition: 'background 0.15s, box-shadow 0.15s',
            boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
          }}
          onMouseEnter={(e) => {
            if (adwords_client_id && adwords_client_secret) {
              (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#fff';
          }}
        >
          {/* Google G icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {adwords_refresh_token ? 'Reconnect Google Ads' : 'Connect Google Ads'}
        </button>

        {adwords_refresh_token && (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 12,
              lineHeight: '16px',
              color: '#16A34A',
              fontWeight: 500,
              fontFamily: 'var(--font-family-primary)',
            }}
          >
            Google Ads OAuth2 connected
          </p>
        )}

        {(!adwords_client_id || !adwords_client_secret) && (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 12,
              lineHeight: '16px',
              color: '#9F9FA9',
              fontFamily: 'var(--font-family-primary)',
            }}
          >
            Enter your Client ID and Client Secret to enable OAuth2 authentication.
          </p>
        )}
      </div>

      {/* ─── Step 2: Developer Token ─── */}
      <div style={{ ...oauthCard, opacity: cloudProjectIntegrated ? 1 : 0.6 }}>
        <h4 style={sectionTitle}>Step 2: Google Ads Credentials</h4>
        <p style={sectionDesc}>
          Enter your Developer Token and Account ID. These are available in your Google Ads account under Tools &amp; Settings → API Center.
        </p>

        <div style={fieldGroup}>
          <label style={labelStyle}>Developer Token</label>
          <input
            style={inputStyle}
            value={adwords_developer_token}
            placeholder="4xr6jY94kAxtXk4rfcgc4w"
            onChange={(e) => updateSettings('adwords_developer_token', e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; }}
            disabled={!cloudProjectIntegrated}
          />
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>Account ID</label>
          <input
            style={inputStyle}
            value={adwords_account_id}
            placeholder="590-948-9101"
            onChange={(e) => updateSettings('adwords_account_id', e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; }}
            disabled={!cloudProjectIntegrated}
          />
        </div>

        <button
          type="button"
          onClick={testIntegration}
          disabled={!hasAllCredentials}
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
            cursor: hasAllCredentials ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-family-primary)',
            opacity: hasAllCredentials ? 1 : 0.5,
            transition: 'background 0.15s, box-shadow 0.15s',
            boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
          }}
          onMouseEnter={(e) => {
            if (hasAllCredentials) {
              (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#fff';
          }}
        >
          {isTesting ? <Icon type="loading" size={16} /> : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />
            </svg>
          )}
          Test Connection
        </button>
      </div>

      {/* ─── Step 3: Volume Data ─── */}
      <div style={{ ...oauthCard, opacity: hasAllCredentials ? 1 : 0.6 }}>
        <h4 style={sectionTitle}>Step 3: Keyword Volume Data</h4>
        <p style={sectionDesc}>
          Fetch fresh search volume data for all your tracked keywords using the Google Ads API.
        </p>

        <button
          type="button"
          onClick={updateVolumeData}
          disabled={!hasAllCredentials}
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
            cursor: hasAllCredentials ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-family-primary)',
            opacity: hasAllCredentials ? 1 : 0.5,
            transition: 'background 0.15s, box-shadow 0.15s',
            boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
          }}
          onMouseEnter={(e) => {
            if (hasAllCredentials) {
              (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#fff';
          }}
        >
          {isUpdatingVolume ? <Icon type="loading" size={16} /> : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
          )}
          Update Keywords Volume Data
        </button>
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
