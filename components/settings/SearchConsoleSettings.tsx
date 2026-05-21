import React, { useMemo } from 'react';

type SearchConsoleSettingsProps = {
  settings: SettingsType,
  settingsError: null | {
    type: string,
    msg: string
  },
  updateSettings: Function,
  domains?: DomainType[],
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

function getGscStatus(domain: DomainType): 'oauth' | 'service_account' | 'none' {
  try {
    const sc = domain.search_console ? JSON.parse(domain.search_console) : {};
    if (sc.auth_type === 'oauth' && sc.oauth_refresh_token) return 'oauth';
    if (sc.client_email && sc.private_key) return 'service_account';
  } catch { /* ignore parse errors */ }
  return 'none';
}

const SearchConsoleSettings = ({ settings, updateSettings, domains = [] }: SearchConsoleSettingsProps) => {
  const domainStatuses = useMemo(() => {
    return domains.map((d) => ({ domain: d.domain, slug: d.slug || d.domain.replace(/\./g, '-'), status: getGscStatus(d) }));
  }, [domains]);

  const oauthDomains = domainStatuses.filter((d) => d.status === 'oauth');
  const unconnectedDomains = domainStatuses.filter((d) => d.status !== 'oauth');

  const handleConnect = (domain: string) => {
    const params = new URLSearchParams({ domain, redirect: '/settings' });
    window.location.href = `/api/gsc/connect?${params.toString()}`;
  };

  return (
    <div>
      {/* ─── Per-domain OAuth2 status ─── */}
      <div
        style={{
          padding: 20,
          marginBottom: 24,
          borderRadius: 8,
          border: '1px solid #E4E4E7',
          background: '#FAFAFA',
        }}
      >
        <h4
          style={{
            margin: '0 0 4px',
            fontSize: 14,
            lineHeight: '20px',
            fontWeight: 600,
            color: '#2F2F34',
            fontFamily: 'var(--font-family-primary)',
          }}
        >
          Connect with Google OAuth2
        </h4>
        <p
          style={{
            margin: '0 0 16px',
            fontSize: 13,
            lineHeight: '16px',
            color: '#52525C',
            fontFamily: 'var(--font-family-primary)',
          }}
        >
          Authorize SerpBear to access your Google Search Console data per domain.
        </p>

        {domains.length === 0 && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: '16px',
              color: '#9F9FA9',
              fontFamily: 'var(--font-family-primary)',
            }}
          >
            Add a domain first to connect Search Console.
          </p>
        )}

        {/* Already connected domains */}
        {oauthDomains.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: unconnectedDomains.length > 0 ? 16 : 0 }}>
            {oauthDomains.map(({ domain, slug }) => (
              <div
                key={domain}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #BBF7D0',
                  background: '#F0FDF4',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                    <path fill="none" stroke="#16A34A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143" />
                  </svg>
                  <div>
                    <span
                      style={{
                        fontSize: 13,
                        lineHeight: '16px',
                        fontWeight: 600,
                        color: '#166534',
                        fontFamily: 'var(--font-family-primary)',
                      }}
                    >
                      {domain}
                    </span>
                  </div>
                </div>
                <a
                  href={`/domain/${slug}/console`}
                  style={{
                    fontSize: 12,
                    lineHeight: '16px',
                    color: '#783AFB',
                    fontWeight: 500,
                    fontFamily: 'var(--font-family-primary)',
                    textDecoration: 'none',
                  }}
                >
                  View data →
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Domains that need connecting */}
        {unconnectedDomains.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {oauthDomains.length > 0 && (
              <span
                style={{
                  fontSize: 12,
                  lineHeight: '16px',
                  fontWeight: 600,
                  color: '#9F9FA9',
                  fontFamily: 'var(--font-family-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  paddingTop: 4,
                  paddingBottom: 2,
                }}
              >
                Available to connect
              </span>
            )}
            {unconnectedDomains.map(({ domain, status }) => (
              <div
                key={domain}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #E4E4E7',
                  background: '#fff',
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: '16px',
                    fontWeight: 500,
                    color: '#2F2F34',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  {domain}
                  {status === 'service_account' && (
                    <span style={{ color: '#9F9FA9', marginLeft: 8, fontSize: 12 }}>(service account configured)</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleConnect(domain)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: '1px solid #D4D4D8',
                    background: '#fff',
                    fontSize: 13,
                    lineHeight: '16px',
                    fontWeight: 600,
                    color: '#2F2F34',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family-primary)',
                    transition: 'background 0.15s, box-shadow 0.15s',
                    boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0px 1px 2px 0px rgba(26,29,40,0.06), 0px 2px 8px rgba(0,0,0,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#fff';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0px 1px 2px 0px rgba(26,29,40,0.06)';
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Connect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ flex: 1, height: 1, background: '#E4E4E7' }} />
        <span
          style={{
            fontSize: 12,
            lineHeight: '16px',
            color: '#9F9FA9',
            fontWeight: 500,
            fontFamily: 'var(--font-family-primary)',
          }}
        >
          or use a service account
        </span>
        <div style={{ flex: 1, height: 1, background: '#E4E4E7' }} />
      </div>

      {/* ─── Service Account Section ─── */}
      <div style={fieldGroup}>
        <label style={labelStyle}>Search Console Client Email</label>
        <input
          style={{
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
            transition: 'border-color 0.2s',
          }}
          value={settings.search_console_client_email}
          placeholder="myapp@appspot.gserviceaccount.com"
          onChange={(e) => updateSettings('search_console_client_email', e.target.value)}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; }}
        />
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>Search Console Private Key</label>
        <textarea
          style={{
            width: '100%',
            height: 100,
            padding: '10px 12px',
            border: '1px solid #D4D4D8',
            borderRadius: 8,
            fontSize: 14,
            lineHeight: '20px',
            color: '#2F2F34',
            background: '#fff',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'var(--font-family-primary)',
            boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
            transition: 'border-color 0.2s',
          }}
          value={settings.search_console_private_key}
          placeholder="-----BEGIN PRIVATE KEY-----..."
          onChange={(e) => updateSettings('search_console_private_key', e.target.value)}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; }}
        />
      </div>
    </div>
  );
};

export default SearchConsoleSettings;
