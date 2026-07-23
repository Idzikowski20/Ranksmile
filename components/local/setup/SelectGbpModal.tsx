import React, { useEffect, useMemo, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, Radio, SearchBar } from '../../core';
import type { BusinessPlace, GbpProfile } from '../../../lib/local/types';
import { IconArrowRight, IconClose, IconGoogleColor, IconPlus } from '../icons';

const FONT = 'var(--font-family-primary)';

type SelectGbpModalProps = {
  open: boolean;
  place: BusinessPlace;
  googleEmail: string;
  onClose: () => void;
  onContinue: (profile: GbpProfile) => void;
  onChangeAccount: () => void;
};

export default function SelectGbpModal({
  open,
  place,
  googleEmail,
  onClose,
  onContinue,
  onChangeAccount,
}: SelectGbpModalProps) {
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<GbpProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const res = await fetch('/api/local/gbp-locations');
        const data = (await res.json()) as { locations?: GbpProfile[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.error || 'Failed to load profiles');
          setProfiles([]);
          return;
        }
        const list = data.locations || [];
        setProfiles(list);
        setSelectedId((prev) => prev || list[0]?.id || '');
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load profiles');
          setProfiles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q),
    );
  }, [profiles, search]);

  const selected = profiles.find((p) => p.id === selectedId) || null;

  if (!open) return null;

  return (
    <Modal title="" onClose={onClose} width={640} closeOnOverlayClick={false}>
      <ModalBody>
        <div style={{ fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 20, minHeight: 420 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                border: '1px solid #DAD9DE',
                borderRadius: 6,
                background: '#FFFFFF',
                padding: 6,
                cursor: 'pointer',
                color: '#6A6772',
              }}
            >
              <IconClose size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconGoogleColor size={24} />
            <span style={{ fontWeight: 600, color: '#181225', fontSize: 14 }}>{googleEmail || 'Google account'}</span>
            <button
              type="button"
              onClick={onChangeAccount}
              style={{
                border: 'none',
                background: 'none',
                color: '#E07D42',
                cursor: 'pointer',
                fontSize: 14,
                fontFamily: FONT,
                padding: 0,
              }}
            >
              Change account
            </button>
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#181225' }}>
            Select Google Business Profile
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: '#6A6772', lineHeight: 1.5 }}>
            Recently viewed: {place.name} ({place.address})
          </p>
          <SearchBar value={search} onChange={setSearch} placeholder="Search" width="100%" />
          <button
            type="button"
            className="local-setup-create-gbp"
            onClick={() => window.open('https://business.google.com/create', '_blank', 'noopener,noreferrer')}
          >
            <IconPlus size={16} />
            Create Google Business Profile
          </button>
          {loading ? (
            <p style={{ margin: 0, fontSize: 14, color: '#6A6772' }}>Loading profiles from Google…</p>
          ) : loadError ? (
            <p style={{ margin: 0, fontSize: 14, color: '#6A6772' }}>{loadError}</p>
          ) : (
            <div className="local-setup-gbp-list" role="radiogroup" aria-label="Google Business Profiles">
              {filtered.map((profile) => (
                <GbpRadioCard
                  key={profile.id}
                  profile={profile}
                  checked={selectedId === profile.id}
                  onSelect={() => setSelectedId(profile.id)}
                />
              ))}
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          size="md"
          variant="primary"
          disabled={!selected}
          onClick={() => {
            if (selected) onContinue(selected);
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Continue
            <IconArrowRight size={16} />
          </span>
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function GbpRadioCard({
  profile,
  checked,
  onSelect,
}: {
  profile: GbpProfile;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={`local-setup-gbp-item${checked ? ' local-setup-gbp-item--selected' : ''}`}>
      <Radio checked={checked} onChange={onSelect} name="gbp-profile" value={profile.id} />
      <span className="local-setup-gbp-item-body">
        <span className="local-setup-gbp-item-name">{profile.name}</span>
        <span className="local-setup-gbp-item-meta">
          {profile.address}
          {'  '}
          {profile.phone}
        </span>
      </span>
    </label>
  );
}
