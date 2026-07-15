import React from 'react';

const STEPS = [
  { key: 'type', label: 'Content type' },
  { key: 'context', label: 'Context' },
  { key: 'research', label: 'Research' },
  { key: 'write', label: 'Write' },
] as const;

type WizardStepKey = (typeof STEPS)[number]['key'];

/** Compact step indicator for new-content / deep-analysis wizard pages. */
export function WizardStepper({ current }: { current: WizardStepKey }) {
  const currentIdx = STEPS.findIndex((step) => step.key === current);

  return (
    <nav
      aria-label="Wizard progress"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        margin: '0 0 24px',
        fontFamily: 'var(--font-family-primary)',
      }}
    >
      {STEPS.map((step, idx) => {
        const active = idx === currentIdx;
        const done = idx < currentIdx;
        return (
          <React.Fragment key={step.key}>
            {idx > 0 && (
              <span
                aria-hidden="true"
                style={{
                  width: 16,
                  height: 1,
                  background: done || active ? '#783AFB' : '#E4E4E7',
                }}
              />
            )}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? '#18181B' : done ? '#783AFB' : '#A1A1AA',
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 9999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  background: active || done ? '#783AFB' : '#F4F4F5',
                  color: active || done ? '#FFFFFF' : '#71717A',
                }}
              >
                {idx + 1}
              </span>
              {step.label}
            </span>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
