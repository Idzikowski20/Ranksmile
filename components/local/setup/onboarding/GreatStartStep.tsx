import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../core';
import { formatMrtEta, mrtRemainingMs, resolveMrtStatus } from '../../../../lib/local/localSetupJobs';
import type { BusinessDetails, LocalSetupJobs } from '../../../../lib/local/types';
import LocalOnboardingShell from './LocalOnboardingShell';
import { IconCheck, RoleIconPin } from '../../icons';

type GreatStartStepProps = {
  details: BusinessDetails;
  jobs: LocalSetupJobs;
  onJobsChange: (jobs: LocalSetupJobs) => void;
  onContinue: () => void;
};

function Spinner() {
  return (
    <svg className="local-onboarding-spin" viewBox="0 0 24 24" role="img" aria-label="Loading…">
      <path d="M16.98 20.6256C17.5433 21.6013 18.8054 21.9477 19.6718 21.2274C21.567 19.6517 22.9447 17.5183 23.5911 15.1058C24.4148 12.0317 23.9836 8.75621 22.3923 6C20.801 3.24379 18.18 1.23261 15.1058 0.408891C12.6934 -0.237529 10.1569 -0.111098 7.84473 0.742337C6.78777 1.13246 6.45667 2.39867 7.02 3.37439V3.37439C7.58333 4.3501 8.83088 4.65471 9.91792 4.35856C11.2588 3.99325 12.6844 3.984 14.0498 4.34987C16.0788 4.89352 17.8087 6.2209 18.8589 8.04C19.9092 9.8591 20.1938 12.0209 19.6501 14.0498C19.2843 15.4153 18.5634 16.6453 17.5766 17.6239C16.7766 18.4172 16.4167 19.6499 16.98 20.6256V20.6256Z" />
    </svg>
  );
}

export default function GreatStartStep({
  details,
  jobs,
  onJobsChange,
  onContinue,
}: GreatStartStepProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((t) => t + 1), 2000);
    return () => window.clearInterval(interval);
  }, []);

  const resolvedJobs = useMemo(() => resolveMrtStatus(jobs), [jobs, tick]);

  useEffect(() => {
    if (resolvedJobs.mrtStatus !== jobs.mrtStatus) {
      onJobsChange(resolvedJobs);
    }
  }, [resolvedJobs, jobs.mrtStatus, onJobsChange]);

  const mrtRemaining = mrtRemainingMs(resolvedJobs);
  const mrtLabel =
    resolvedJobs.mrtStatus === 'skipped'
      ? null
      : resolvedJobs.mrtStatus === 'done'
        ? 'Campaign ready'
        : mrtRemaining !== null
          ? `Creating campaign (${formatMrtEta(mrtRemaining)})`
          : 'Creating campaign (2-5 mins)';

  return (
    <LocalOnboardingShell step="great-start">
      <h1 className="local-onboarding-title">Great start!</h1>
      <p className="local-onboarding-subtitle local-onboarding-subtitle--left">
        Your location is being set up.
      </p>

      <div className="local-onboarding-great-start">
        <div className="local-onboarding-location-card">
          <div className="local-onboarding-location-info">
            <RoleIconPin />
            <div>
              <strong>{details.name}</strong>
              <span>{details.address}</span>
            </div>
          </div>
          <span className="local-onboarding-badge local-onboarding-badge--success">
            <IconCheck />
            Location connected
          </span>
        </div>

        <div className="local-onboarding-tools-grid">
          <article className="local-onboarding-tool-card">
            <h3>Listings</h3>
            <ol>
              <li>
                <Spinner />
                1. Setting up (a few hours)
              </li>
              <li><span>2.</span> Submitting to all directories</li>
            </ol>
            <div className="local-onboarding-tool-preview local-onboarding-tool-preview--listings">
              <img src="/images/local-great-start-listings.webp" alt="" loading="lazy" decoding="async" />
            </div>
          </article>

          <article className="local-onboarding-tool-card">
            <h3>Map Rank Tracker</h3>
            {resolvedJobs.mrtStatus === 'skipped' ? (
              <p className="local-onboarding-tool-muted">Skipped during setup</p>
            ) : resolvedJobs.mrtStatus === 'done' ? (
              <p className="local-onboarding-tool-enabled">
                <IconCheck />
                Campaign created
              </p>
            ) : (
              <p>
                <Spinner />
                {mrtLabel}
              </p>
            )}
            <div className="local-onboarding-tool-preview local-onboarding-tool-preview--mrt">
              <img src="/images/local-mini-map.webp" alt="" />
            </div>
          </article>

          <article className="local-onboarding-tool-card">
            <h3>Reviews</h3>
            {resolvedJobs.reviewsStatus === 'enabled' ? (
              <p className="local-onboarding-tool-enabled">
                <IconCheck />
                The AI will reply to new reviews as soon as they appear
              </p>
            ) : (
              <p className="local-onboarding-tool-muted">AI replies not enabled</p>
            )}
            <div className="local-onboarding-tool-preview local-onboarding-tool-preview--reviews">
              <img src="/images/local-great-start-reviews.webp" alt="" loading="lazy" decoding="async" />
            </div>
          </article>
        </div>
      </div>

      <Button
        type="button"
        size="md"
        variant="primary"
        onClick={onContinue}
        style={{ width: '100%', maxWidth: 440 }}
      >
        Continue
      </Button>
    </LocalOnboardingShell>
  );
}
