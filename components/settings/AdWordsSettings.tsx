import React, { useEffect, useState } from 'react';

type AdWordsSettingsProps = {
  settings?: SettingsType;
  settingsError?: null | { type: string; msg: string };
  updateSettings?: Function;
};

const AdWordsSettings = ({ settings }: AdWordsSettingsProps) => {
  const {
    adwords_client_id = '',
    adwords_client_secret = '',
    adwords_developer_token = '',
    adwords_account_id = '',
    adwords_refresh_token = '',
  } = settings || {};

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isUpdatingVolume, setIsUpdatingVolume] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; msg: string }>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const envVarsReady = !!(adwords_client_id && adwords_client_secret);
  const hasAllCredentials = !!(envVarsReady && adwords_developer_token && adwords_account_id);
  const isConnected = hasAllCredentials && adwords_refresh_token === '(connected)';

  // Track when the connection was made (in-session approximation)
  const [connectedAt, setConnectedAt] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isConnected && !connectedAt) {
      setConnectedAt(new Date().toISOString());
    }
    if (!isConnected) {
      setConnectedAt(null);
    }
  }, [isConnected]);

  const formatTimeAgo = (dateStr: string) => {
    const then = new Date(dateStr).getTime();
    if (!then) return '';
    const diffDays = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Connected today';
    if (diffDays === 1) return 'Connected 1 day ago';
    return `Connected ${diffDays} days ago`;
  };

  const handleConnect = async () => {
    if (!envVarsReady) return;
    setIsConnecting(true);
    try {
      const resp = await fetch('/api/adwords?get_url=1');
      const data = await resp.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error('[AdWords] Failed to get OAuth URL', e);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const resp = await fetch('/api/adwords', { method: 'DELETE' });
      if (resp.ok) {
        // Force reload to refresh settings
        window.location.reload();
      }
    } catch (e) {
      console.error('[AdWords] Failed to disconnect', e);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch('/api/adwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developer_token: '', account_id: '' }),
      });
      const data = await resp.json();
      if (resp.ok && data.valid) {
        setTestResult({ ok: true, msg: 'Google Ads API connection verified successfully.' });
      } else {
        setTestResult({ ok: false, msg: data.error || 'Connection test failed.' });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e?.message || 'Connection test failed.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleUpdateVolume = async () => {
    setIsUpdatingVolume(true);
    try {
      const resp = await fetch('/api/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'all' }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err?.error || 'Failed to update keyword volume data.');
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to update keyword volume data.');
    } finally {
      setIsUpdatingVolume(false);
    }
  };

  // ── Styles ──
  const separatorStyle: React.CSSProperties = {
    minHeight: 1,
    minWidth: 1,
    alignSelf: 'stretch',
    background: '#F4F4F5',
    margin: '24px 0',
  };

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    border: '1px solid #F4F4F5',
    background: '#FFFFFF',
    gap: 16,
  };

  const primaryBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    background: '#2F2F34',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 600,
    lineHeight: '20px',
    fontFamily: 'var(--font-family-primary)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  };

  const secondaryBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 6,
    border: '1px solid #D4D4D8',
    background: '#FFFFFF',
    color: '#2F2F34',
    fontSize: 14,
    fontWeight: 600,
    lineHeight: '20px',
    fontFamily: 'var(--font-family-primary)',
    cursor: 'pointer',
    transition: 'background 0.15s, box-shadow 0.15s',
    boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
  };

  const ghostDangerBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: '#3F3F47',
    fontSize: 14,
    fontWeight: 600,
    lineHeight: '20px',
    fontFamily: 'var(--font-family-primary)',
    cursor: 'pointer',
    transition: 'color 0.15s',
  };

  const hasAnyCredentials = !!(adwords_client_id || adwords_client_secret || adwords_developer_token || adwords_account_id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'flex-start' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
          Connect Google Ads
        </span>
        <span style={{ fontSize: 14, fontWeight: 400, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
          Connect your Google Ads account to enrich keywords with search volume, CPC, and competition data from Keyword Planner.
        </span>
      </div>

      <div role="separator" style={separatorStyle} />

      {/* Not configured state */}
      {!hasAllCredentials && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 10,
            background: '#fffbeb',
            border: '1px solid #fde68a',
            fontSize: 13,
            color: '#92400e',
            lineHeight: 1.6,
            fontFamily: 'var(--font-family-primary)',
            marginBottom: hasAnyCredentials ? 24 : 0,
          }}
        >
          {!hasAnyCredentials ? (
            <>
              Google Ads credentials must be configured in your{' '}
              <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, background: '#fef3c7', padding: '1px 4px', borderRadius: 4 }}>.env</code>{' '}
              file before connecting. See the{' '}
              <a
                target="_blank"
                rel="noreferrer"
                href="https://docs.serpbear.com/miscellaneous/integrate-google-ads"
                style={{ color: '#783AFB', textDecoration: 'underline', fontWeight: 500 }}
              >
                integration guide
              </a>{' '}
              for step-by-step instructions.
            </>
          ) : (
            <>
              Some credentials are missing. Set all four{' '}
              <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>ADWORDS_*</code> variables in{' '}
              <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>.env</code> and restart the server.
            </>
          )}
        </div>
      )}

      {/* Connected account card */}
      {isConnected && (
        <>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: '#F4F4F5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {/* Google Ads icon */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M4 22H20C20.5304 22 21.0391 21.7893 21.4142 21.4142C21.7893 21.0391 22 20.5304 22 20V8L16 2H4C3.46957 2 2.96086 2.21071 2.58579 2.58579C2.21071 2.96086 2 3.46957 2 4V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22Z" fill="#4285F4" />
                  <path d="M16 2V8H22" fill="#34A853" />
                  <path d="M8.5 13L10.5 15.5L15.5 10.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
                  Account {adwords_account_id === '(set)' ? 'Connected' : adwords_account_id}
                </div>
                <span style={{ fontSize: 13, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }} suppressHydrationWarning>
                  {mounted && connectedAt ? formatTimeAgo(connectedAt) : ''}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              style={{
                ...ghostDangerBtnStyle,
                opacity: isDisconnecting ? 0.5 : 1,
                cursor: isDisconnecting ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => { if (!isDisconnecting) (e.currentTarget as HTMLButtonElement).style.color = '#18181B'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#3F3F47'; }}
            >
              <svg viewBox="0 0 20 20" width="18" height="18" style={{ flexShrink: 0 }}>
                <path fill="currentColor" d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94z" />
              </svg>
              <span>{isDisconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
            </button>
          </div>

          <div role="separator" style={separatorStyle} />
        </>
      )}

      {/* Connect / Reconnect button */}
      <div style={{ display: 'flex', width: '100%', paddingTop: isConnected ? 0 : 0 }}>
        <button
          type="button"
          onClick={handleConnect}
          disabled={!envVarsReady || isConnecting}
          style={{
            ...primaryBtnStyle,
            opacity: (!envVarsReady || isConnecting) ? 0.6 : 1,
            cursor: (!envVarsReady || isConnecting) ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => { if (envVarsReady && !isConnecting) (e.currentTarget as HTMLButtonElement).style.background = '#783AFB'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#2F2F34'; }}
        >
          {isConnecting ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Connecting...
            </>
          ) : (
            <>
              {/* Google G icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {isConnected ? 'Reconnect Google Ads' : 'Connect Google Ads'}
            </>
          )}
        </button>
      </div>

      {/* Actions section */}
      {isConnected && (
        <>
          <div role="separator" style={separatorStyle} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#2F2F34', fontFamily: 'var(--font-family-primary)' }}>
              Actions
            </span>
            <span style={{ fontSize: 13, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
              Test your integration or refresh keyword volume data for all tracked keywords.
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleTest}
              disabled={!isConnected || isTesting}
              style={{
                ...secondaryBtnStyle,
                opacity: (!isConnected || isTesting) ? 0.5 : 1,
                cursor: (!isConnected || isTesting) ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => { if (isConnected && !isTesting) (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; }}
            >
              {isTesting ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Testing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />
                  </svg>
                  Test Connection
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleUpdateVolume}
              disabled={!isConnected || isUpdatingVolume}
              style={{
                ...secondaryBtnStyle,
                opacity: (!isConnected || isUpdatingVolume) ? 0.5 : 1,
                cursor: (!isConnected || isUpdatingVolume) ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => { if (isConnected && !isUpdatingVolume) (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; }}
            >
              {isUpdatingVolume ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Updating...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                  </svg>
                  Update Keywords Volume Data
                </>
              )}
            </button>

            {testResult && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: testResult.ok ? '#15803D' : '#B91C1C',
                  fontFamily: 'var(--font-family-primary)',
                }}
              >
                {testResult.ok ? '✓' : '✗'} {testResult.msg}
              </span>
            )}
          </div>
        </>
      )}

      {/* Advanced: env vars */}
      <div role="separator" style={separatorStyle} />

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: '#52525C',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'var(--font-family-primary)',
          cursor: 'pointer',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#2F2F34'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#52525C'; }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
          }}
        >
          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Environment Variables
      </button>

      {showAdvanced && (
        <div style={{ marginTop: 12, width: '100%' }}>
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              border: '1px solid #F4F4F5',
              background: '#FFFFFF',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9F9FA9', paddingBottom: 8, borderBottom: '1px solid #E4E4E7', fontFamily: 'var(--font-family-primary)' }}>Variable</th>
                  <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9F9FA9', paddingBottom: 8, borderBottom: '1px solid #E4E4E7', fontFamily: 'var(--font-family-primary)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'ADWORDS_CLIENT_ID', value: adwords_client_id },
                  { key: 'ADWORDS_CLIENT_SECRET', value: adwords_client_secret },
                  { key: 'ADWORDS_DEVELOPER_TOKEN', value: adwords_developer_token },
                  { key: 'ADWORDS_ACCOUNT_ID', value: adwords_account_id },
                  { key: 'ADWORDS_REFRESH_TOKEN', value: adwords_refresh_token },
                ].map((row) => (
                  <tr key={row.key} style={{ borderBottom: '1px solid #F4F4F5' }}>
                    <td style={{ padding: '10px 0', fontSize: 12, fontFamily: 'ui-monospace, monospace', color: '#3F3F47', paddingRight: 24 }}>
                      {row.key}
                    </td>
                    <td style={{ padding: '10px 0' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '1px 8px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          background: row.value ? '#F0FDF4' : '#F4F4F5',
                          color: row.value ? '#15803D' : '#9F9FA9',
                          border: `1px solid ${row.value ? '#BBF7D0' : '#E4E4E7'}`,
                          fontWeight: 500,
                        }}
                      >
                        {row.value || 'not set'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documentation link */}
      <p style={{ margin: '24px 0 0', fontSize: 13, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
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

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AdWordsSettings;
