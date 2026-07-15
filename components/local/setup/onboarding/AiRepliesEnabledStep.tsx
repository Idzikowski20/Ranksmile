import React from 'react';
import { Button } from '../../../core';
import LocalOnboardingShell from './LocalOnboardingShell';
import { AiRepliesEnabledIllustration, IconCheck } from '../../icons';

type AiRepliesEnabledStepProps = {
  businessName: string;
  onContinue: () => void;
};

export default function AiRepliesEnabledStep({ businessName, onContinue }: AiRepliesEnabledStepProps) {
  return (
    <LocalOnboardingShell step="ai-replies-enabled">
      <h1 className="local-onboarding-title">AI Replies enabled</h1>

      <div className="local-onboarding-illustration-wrap">
        <AiRepliesEnabledIllustration />
      </div>

      <ul className="local-onboarding-feature-list">
        <li>
          <span className="local-onboarding-feature-icon local-onboarding-feature-icon--mint">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6.414L4.707 13.707A1 1 0 0 1 3 13V3Z"
                fill="currentColor"
              />
            </svg>
          </span>
          AI will auto-reply to up to 1000 reviews per month for {businessName}.
        </li>
        <li>
          <span className="local-onboarding-feature-icon local-onboarding-feature-icon--mint">
            <IconCheck />
          </span>
          You will get a summary email once AI starts replying to reviews.
        </li>
      </ul>

      <Button type="button" size="md" variant="primary" onClick={onContinue} style={{ width: '100%', maxWidth: 440 }}>
        Continue
      </Button>
    </LocalOnboardingShell>
  );
}
