import React from 'react';
import { Button } from '../../../core';
import { USER_ROLE_OPTIONS } from '../../../../lib/local/onboardingConfig';
import type { LocalUserRole } from '../../../../lib/local/types';
import LocalOnboardingShell from './LocalOnboardingShell';
import { RoleIconBriefcase, RoleIconLaptop, RoleIconMegaphone, RoleIconPin, RoleIconUser } from '../../icons';

type UserRoleStepProps = {
  selected: LocalUserRole | null;
  onSelect: (role: LocalUserRole) => void;
  onSkip: () => void;
};

function RoleIcon({ icon }: { icon: string | null }) {
  if (!icon) return null;
  if (icon === 'briefcase') return <RoleIconBriefcase />;
  if (icon === 'laptop') return <RoleIconLaptop />;
  if (icon === 'megaphone') return <RoleIconMegaphone />;
  if (icon === 'pin') return <RoleIconPin />;
  if (icon === 'user') return <RoleIconUser />;
  return null;
}

export default function UserRoleStep({ selected, onSelect, onSkip }: UserRoleStepProps) {
  return (
    <LocalOnboardingShell step="user-role">
      <h1 className="local-onboarding-title">Which best describes you?</h1>
      <p className="local-onboarding-subtitle">We will use this to personalize your experience.</p>

      <div className="local-onboarding-role-list">
        {USER_ROLE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`local-onboarding-role-card${selected === opt.id ? ' local-onboarding-role-card--selected' : ''}`}
            onClick={() => onSelect(opt.id)}
            aria-pressed={selected === opt.id}
          >
            <span className="local-onboarding-role-icon">
              <RoleIcon icon={opt.icon} />
            </span>
            <span className="local-onboarding-role-label">{opt.label}</span>
          </button>
        ))}
      </div>

      <div className="local-onboarding-actions">
        <Button type="button" size="md" variant="transparent" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </LocalOnboardingShell>
  );
}
