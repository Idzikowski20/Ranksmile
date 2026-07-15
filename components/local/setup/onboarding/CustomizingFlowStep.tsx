import React, { useEffect } from 'react';
import LocalOnboardingShell from './LocalOnboardingShell';

type CustomizingFlowStepProps = {
  onComplete: () => void;
};

export default function CustomizingFlowStep({ onComplete }: CustomizingFlowStepProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onComplete, 1800);
    return () => window.clearTimeout(timeout);
  }, [onComplete]);

  return (
    <LocalOnboardingShell step="customizing-flow">
      <div className="local-onboarding-loading-center">
        <div className="local-onboarding-pin-spinner" aria-hidden="true">
          <svg className="local-onboarding-pin-spinner-arc" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#E4E4E7" strokeWidth="3" />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="#1AB25E"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="40 86"
            />
          </svg>
          <svg className="local-onboarding-pin-spinner-icon" width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M8 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
              fill="#1AB25E"
            />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M8 0a7.115 7.115 0 0 0-4.94 1.978A6.68 6.68 0 0 0 1 6.784c0 2.763 1.572 4.945 3.038 6.388a15.85 15.85 0 0 0 3.081 2.35l.022.012a.286.286 0 0 1 .005.003h.002l.015.01L8 16l.837-.453.015-.01.007-.003.022-.013a9.021 9.021 0 0 0 .296-.176 15.851 15.851 0 0 0 2.785-2.174C13.428 11.73 15 9.548 15 6.785a6.68 6.68 0 0 0-2.06-4.806A7.116 7.116 0 0 0 8 0Z"
              fill="#1AB25E"
            />
          </svg>
        </div>
        <p className="local-onboarding-customizing-text">Customizing your flow…</p>
      </div>
    </LocalOnboardingShell>
  );
}
