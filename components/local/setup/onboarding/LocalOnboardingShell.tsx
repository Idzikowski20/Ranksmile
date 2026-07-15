import React from 'react';
import { ONBOARDING_PROGRESS } from '../../../../lib/local/onboardingConfig';
import type { LocalSetupStep } from '../../../../lib/local/types';

const FONT = 'var(--font-family-primary)';

type LocalOnboardingShellProps = {
  step: LocalSetupStep;
  showBack?: boolean;
  onBack?: () => void;
  children: React.ReactNode;
  narrow?: boolean;
};

export default function LocalOnboardingShell({
  step,
  showBack = false,
  onBack,
  children,
  narrow = false,
}: LocalOnboardingShellProps) {
  const progress = ONBOARDING_PROGRESS[step] ?? 0;

  return (
    <section
      className="local-setup-card-shell local-onboarding-shell"
      style={{ fontFamily: FONT }}
    >
      <div className="local-onboarding-header">
        {showBack && onBack && (
          <button type="button" className="local-onboarding-back" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.707 12.707a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 1.414L4.414 7H14a1 1 0 1 1 0 2H4.414l2.293 2.293a1 1 0 0 1 0 1.414Z"
                fill="currentColor"
              />
            </svg>
            Back
          </button>
        )}
        <div
          className="local-onboarding-progress"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="local-onboarding-progress-value" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className={`local-onboarding-body${narrow ? ' local-onboarding-body--narrow' : ''}`}>
        {children}
      </div>
    </section>
  );
}
