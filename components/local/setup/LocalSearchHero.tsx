import React, { useCallback, useEffect, useState } from 'react';
import type { GbpProfile } from '../../../lib/local/types';
import { IconCheck, IconGoogleColor, IconPin } from '../icons';

const FONT = 'var(--font-family-primary)';

type LoadErrorCode = 'no_account' | 'needs_reconnect' | 'forbidden' | 'rate_limit' | 'upstream' | 'unknown';

type LocalSearchHeroProps = {
  googleEmail?: string | null;
  connectHref: string;
  isConfigured: (gbpId: string) => boolean;
  onSelectProfile: (profile: GbpProfile) => void | Promise<void>;
  onChangeAccount?: () => void;
};

export default function LocalSearchHero({
  googleEmail,
  connectHref,
  isConfigured,
  onSelectProfile,
  onChangeAccount,
}: LocalSearchHeroProps) {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<GbpProfile[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<LoadErrorCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/local/gbp-locations');
      const data = (await res.json()) as {
        locations?: GbpProfile[];
        error?: string;
        code?: LoadErrorCode;
        detail?: string;
      };
      if (!res.ok) {
        const code = data.code
          || (res.status === 429 ? 'rate_limit' : res.status === 401 ? 'needs_reconnect' : 'upstream');
        setErrorCode(code);
        const baseMsg = code === 'rate_limit'
          ? (data.error || 'Google API quota exceeded. Wait about a minute, then retry.')
          : (data.error || 'Failed to load Google Business profiles');
        setErrorMessage(
          data.detail && data.detail !== baseMsg
            ? `${baseMsg}\n\nGoogle: ${data.detail}`
            : baseMsg,
        );
        setProfiles([]);
        return;
      }
      setProfiles(data.locations || []);
    } catch (err) {
      setErrorCode('unknown');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load profiles');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
    // Load once on mount — remounts/Strict Mode are deduped server-side.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional single load
  }, []);

  const handleSelect = async (profile: GbpProfile) => {
    if (importingId) return;
    setImportingId(profile.id);
    try {
      await onSelectProfile(profile);
    } finally {
      setImportingId(null);
    }
  };

  const needsConnect = errorCode === 'no_account' || errorCode === 'needs_reconnect';
  const isRateLimited = errorCode === 'rate_limit';

  return (
    <section className="local-setup-hero" style={{ fontFamily: FONT }}>
      <div className="local-setup-hero-content local-setup-hero-content--profiles">
        <span className="local-setup-hero-eyebrow">Local Dashboard</span>
        <h1 className="local-setup-hero-title">Automate your local growth</h1>
        <p className="local-setup-hero-subtitle">
          From Google to AI search—show up everywhere local customers search, with optimized
          Google Business Profile, listings, reviews, and rankings.
        </p>

        <div className="local-setup-profiles-panel">
          <div className="local-setup-profiles-account">
            <IconGoogleColor size={22} />
            <span>{googleEmail || 'Google Business profiles'}</span>
            {onChangeAccount && (
              <button type="button" className="local-setup-profiles-change" onClick={onChangeAccount}>
                Change account
              </button>
            )}
          </div>

          <h2 className="local-setup-profiles-heading">Your Google Business Profiles</h2>

          {loading ? (
            <div className="local-setup-profiles-loading" role="status">
              Loading profiles from Google…
            </div>
          ) : needsConnect ? (
            <div className="local-setup-profiles-empty">
              <p>
                Connect Google to load your Business Profiles and manage review replies.
                This also enables Search Console access.
              </p>
              <a href={connectHref} className="local-reviews-gate-link">
                Connect Google
              </a>
            </div>
          ) : errorCode ? (
            <div className="local-setup-profiles-empty">
              <p style={{ whiteSpace: 'pre-wrap' }}>{errorMessage || 'Could not load profiles from Google.'}</p>
              {isRateLimited ? (
                <p style={{ marginTop: 8, fontSize: 13, color: '#6A6772', lineHeight: 1.45 }}>
                  Check Cloud Console quotas for Account Management / Business Information.
                  {' '}
                  <a
                    href="https://developers.google.com/my-business/content/prereqs"
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ color: '#E07D42' }}
                  >
                    GBP API access prerequisites
                  </a>
                  {' · '}
                  <a
                    href="https://developers.google.com/my-business/content/limits"
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ color: '#E07D42' }}
                  >
                    Usage limits
                  </a>
                </p>
              ) : null}
              <button type="button" className="local-reviews-gate-link" onClick={() => { void loadProfiles(); }}>
                {isRateLimited ? 'Retry in a minute' : 'Retry'}
              </button>
            </div>
          ) : profiles.length === 0 ? (
            <div className="local-setup-profiles-empty">
              <p>No Google Business Profiles found for this account.</p>
              <a href={connectHref} className="local-reviews-gate-link">
                Reconnect Google
              </a>
            </div>
          ) : (
            <ul className="local-setup-profiles-list">
              {profiles.map((profile) => {
                const configured = isConfigured(profile.id);
                const importing = importingId === profile.id;
                return (
                  <li key={profile.id}>
                    <button
                      type="button"
                      className="local-setup-profile-card"
                      disabled={Boolean(importingId)}
                      onClick={() => { void handleSelect(profile); }}
                    >
                      <span className="local-setup-profile-card-main">
                        <span className="local-setup-profile-card-name">{profile.name}</span>
                        <span className="local-setup-profile-card-meta">
                          <IconPin size={14} color="#A1A1AA" />
                          {profile.address || 'Address unavailable'}
                        </span>
                        {importing && (
                          <span className="local-setup-profile-card-meta">
                            Importing photos & details from Google…
                          </span>
                        )}
                      </span>
                      <span
                        className={`local-setup-profile-badge${configured ? ' local-setup-profile-badge--ready' : ''}`}
                      >
                        {importing ? (
                          'Importing…'
                        ) : configured ? (
                          <>
                            <IconCheck size={14} color="#1AB25E" />
                            Configured
                          </>
                        ) : (
                          'Setup needed'
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
