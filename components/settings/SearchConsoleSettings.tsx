import React, { useEffect, useState } from 'react';
import { Button } from '../koala/core';
import { KoalaSettingsSection, KoalaSettingsRow, KoalaPanel, KoalaPanelBody } from '../koala/layout';

type SearchConsoleSettingsProps = {
  settings?: SettingsType;
  settingsError?: null | {
    type: string;
    msg: string;
  };
  updateSettings?: Function;
};

type GscAccount = {
  id: number;
  userId: string;
  googleSub: string;
  email: string;
  picture: string;
  connectedAt: string;
  scopes: string;
  status?: 'connected' | 'expired';
};

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M15.6823 8.18368C15.6823 7.63986 15.6382 7.0931 15.5442 6.55811H7.99829V9.63876H12.3194C12.1401 10.6323 11.564 11.5113 10.7203 12.0698V14.0687H13.2983C14.8122 12.6753 15.6823 10.6176 15.6823 8.18368Z" fill="#4285F4" />
    <path d="M7.99812 16C10.1558 16 11.9753 15.2915 13.3011 14.0687L10.7231 12.0698C10.0058 12.5578 9.07988 12.8341 8.00106 12.8341C5.91398 12.8341 4.14436 11.426 3.50942 9.53296H0.849121V11.5936C2.2072 14.295 4.97332 16 7.99812 16Z" fill="#34A853" />
    <path d="M3.50665 9.53295C3.17154 8.53938 3.17154 7.4635 3.50665 6.46993V4.4093H0.849292C-0.285376 6.66982 -0.285376 9.33306 0.849292 11.5936L3.50665 9.53295Z" fill="#FBBC04" />
    <path d="M7.99812 3.16589C9.13867 3.14825 10.241 3.57743 11.067 4.36523L13.3511 2.0812C11.9048 0.723121 9.98526 -0.0235266 7.99812 -1.02057e-05C4.97332 -1.02057e-05 2.2072 1.70493 0.849121 4.40932L3.50648 6.46995C4.13848 4.57394 5.91104 3.16589 7.99812 3.16589Z" fill="#EA4335" />
  </svg>
);

const SearchConsoleSettings = (_props: SearchConsoleSettingsProps) => {
  const [accounts, setAccounts] = useState<GscAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const formatTimeAgo = (dateStr: string) => {
    const then = new Date(dateStr).getTime();
    if (!then) return '';
    const diffDays = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Integrated today';
    if (diffDays === 1) return 'Integrated 1 day ago';
    return `Integrated ${diffDays} days ago`;
  };

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/gsc/accounts');
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch {
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleConnect = () => {
    window.location.href = '/api/gsc/connect?redirect=/settings/google_search_console';
  };

  const handleDisconnect = async (accountId: number) => {
    setDisconnectingId(accountId);
    try {
      await fetch(`/api/gsc/accounts?id=${accountId}`, { method: 'DELETE' });
      await loadAccounts();
    } finally {
      setDisconnectingId(null);
    }
  };

  const addAccountLabel = accounts.length > 0 ? 'Add another Google Account' : 'Add Google Account';

  return (
    <KoalaSettingsSection title="Connected accounts">
      <KoalaSettingsRow
        label="Google Search Console"
        description="Connect your Google Search Console with Ranksmile to get accurate data about your domains."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          {isLoading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 14, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>
              Loading accounts…
            </div>
          ) : (
            <KoalaPanel noPadding>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {accounts.length === 0 ? (
                  <div style={{ padding: '24px 16px', fontSize: 14, color: 'var(--koala-text-tertiary)', fontFamily: 'var(--font-family-primary)' }}>
                    No Google accounts connected yet.
                  </div>
                ) : (
                  accounts.map((account) => (
                    <div
                      key={account.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: '16px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9999, overflow: 'hidden', background: 'var(--koala-bg-secondary)', flexShrink: 0 }}>
                          <img
                            alt=""
                            src={account.picture || 'https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png'}
                            referrerPolicy="no-referrer"
                            onError={(event) => {
                              const fallback = 'https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png';
                              if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
                            }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {account.email || account.googleSub || 'Google Account'}
                            </span>
                            {account.status === 'expired' && (
                              <span style={{ flexShrink: 0, borderRadius: 9999, background: 'var(--koala-status-danger-bg)', padding: '2px 8px', fontSize: 11, fontWeight: 600, color: 'var(--koala-status-danger)' }}>
                                Reconnect needed
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 13, color: 'var(--koala-text-tertiary)', fontFamily: 'var(--font-family-primary)' }} suppressHydrationWarning>
                            {mounted
                              ? (account.status === 'expired'
                                ? 'Connection expired — reconnect to restore Search Console data'
                                : formatTimeAgo(account.connectedAt))
                              : ''}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        {account.status === 'expired' && (
                          <Button type="button" variant="transparent" size="sm" onClick={handleConnect}>
                            Reconnect
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="transparent"
                          size="sm"
                          onClick={() => handleDisconnect(account.id)}
                          disabled={disconnectingId === account.id}
                        >
                          {disconnectingId === account.id ? 'Disconnecting…' : 'Disconnect'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </KoalaPanel>
          )}
          <div>
            <Button type="button" variant="primary" icon={<GoogleIcon />} onClick={handleConnect}>
              {addAccountLabel}
            </Button>
          </div>
        </div>
      </KoalaSettingsRow>
    </KoalaSettingsSection>
  );
};

export default SearchConsoleSettings;
