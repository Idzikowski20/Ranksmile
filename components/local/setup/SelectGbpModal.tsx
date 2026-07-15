import React, { useMemo, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, Radio, SearchBar } from '../../core';
import type { BusinessPlace, GbpProfile } from '../../../lib/local/types';
import { MOCK_GBP_PROFILES } from '../../../lib/local/mockPlaces';
import { IconArrowRight, IconClose, IconGoogleColor, IconPlus } from '../icons';

const FONT = 'var(--font-family-primary)';

type SelectGbpModalProps = {
  open: boolean;
  place: BusinessPlace;
  googleEmail: string;
  onClose: () => void;
  onContinue: (profileId: string) => void;
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
  const [selectedId, setSelectedId] = useState<string>(MOCK_GBP_PROFILES[0]?.id ?? '');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_GBP_PROFILES;
    return MOCK_GBP_PROFILES.filter(
      (p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q),
    );
  }, [search]);

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
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          size="md"
          variant="primary"
          disabled={!selectedId}
          onClick={() => onContinue(selectedId)}
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
