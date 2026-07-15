import React from 'react';
import { Button } from '../../core';
import type { BusinessPlace } from '../../../lib/local/types';
import { IconGoogle, IconPhone, IconPinOutline } from '../icons';

const FONT = 'var(--font-family-primary)';

type LocalConnectStepProps = {
  place: BusinessPlace;
  onSetupWithGoogle: () => void;
  onChangePlace: () => void;
};

export default function LocalConnectStep({ place, onSetupWithGoogle, onChangePlace }: LocalConnectStepProps) {
  return (
    <section className="local-setup-card-shell" style={{ fontFamily: FONT }}>
      <span className="local-setup-card-eyebrow">Local</span>
      <h1 className="local-setup-card-title">
        Add your location to Local.
        <br />
        Save hours with a quick setup
      </h1>
      <div className="local-setup-card-narrow">
        <div className="local-setup-business-card">
          <h2 className="local-setup-business-card-title">{place.name}</h2>
          <p className="local-setup-business-card-row">
            <IconPinOutline size={16} color="#52525C" />
            {place.address}
          </p>
          {place.phone && (
            <div className="local-setup-business-card-row">
              <IconPhone size={16} color="#52525C" />
              {place.phone}
            </div>
          )}
        </div>
        <button
          type="button"
          className="local-setup-change-place"
          onClick={onChangePlace}
        >
          Change business
        </button>
        <Button
          type="button"
          size="md"
          variant="primary"
          onClick={onSetupWithGoogle}
          style={{ width: '100%', marginTop: 20 }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconGoogle size={16} />
            Set up with Google
          </span>
        </Button>
      </div>
    </section>
  );
}
