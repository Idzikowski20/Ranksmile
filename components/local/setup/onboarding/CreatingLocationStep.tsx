import React, { useEffect, useState } from 'react';
import LocalOnboardingShell from './LocalOnboardingShell';

const DIRECTORY_ICONS = [
  { label: 'G', color: '#4285F4' },
  { label: 'f', color: '#1877F2' },
  { label: 'Y', color: '#D32323' },
  { label: 'A', color: '#000000' },
  { label: 'I', color: '#E4405F' },
  { label: 'B', color: '#008373' },
  { label: 'T', color: '#00AF87' },
  { label: 'W', color: '#33CCFF' },
];

type CreatingLocationStepProps = {
  onComplete: () => void;
};

export default function CreatingLocationStep({ onComplete }: CreatingLocationStepProps) {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((p) => Math.min(p + 6, 92));
    }, 180);
    const timeout = window.setTimeout(onComplete, 2800);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <LocalOnboardingShell step="creating-location">
      <div className="local-onboarding-loading-center">
        <div className="local-onboarding-orbit" aria-hidden="true">
          <div className="local-onboarding-orbit-ring local-onboarding-orbit-ring--outer" />
          <div className="local-onboarding-orbit-ring local-onboarding-orbit-ring--inner" />
          <div className="local-onboarding-orbit-core">
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
              <circle cx="14" cy="14" r="12" fill="#2F2F34" />
              <path d="M14 8l2 4h4l-3.2 2.5 1.2 4.5L14 17l-4 2 1.2-4.5L8 12h4l2-4z" fill="#fff" />
            </svg>
          </div>
          {DIRECTORY_ICONS.map((icon, i) => {
            const angle = (i / DIRECTORY_ICONS.length) * 360;
            const radius = i % 2 === 0 ? 88 : 62;
            return (
              <div
                key={icon.label}
                className="local-onboarding-orbit-node"
                style={{
                  transform: `rotate(${angle}deg) translate(${radius}px) rotate(-${angle}deg)`,
                }}
              >
                <span style={{ background: icon.color }}>{icon.label}</span>
              </div>
            );
          })}
        </div>
        <h1 className="local-onboarding-title local-onboarding-title--teal">Creating location…</h1>
        <p className="local-onboarding-subtitle">
          Once finished, the creation of listings will begin.
        </p>
        <div className="local-onboarding-inline-progress">
          <div className="local-onboarding-inline-progress-value" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </LocalOnboardingShell>
  );
}
