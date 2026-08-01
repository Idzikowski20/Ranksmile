import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '../common/DashboardLayout';
import { Button } from '../koala/core';
import { useFetchDomains } from '../../services/domains';

/**
 * Shared layout for New-Content / Import wizard steps.
 * Flat koala surface — no inset card (padding/radius frame).
 */
const WizardShell = ({ title, children, footer }: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) => {
  const router = useRouter();
  const { data } = useFetchDomains(router);
  const domains: DomainType[] = data?.domains || [];

  return (
    <DashboardLayout domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head><title>{`${title} — Ranksmile`}</title></Head>
      <div className="koala-wizard-shell">
        <div className="koala-wizard-shell__body styled-scrollbar">
          <div className="koala-wizard-shell__column">
            {children}
          </div>
        </div>
        {footer ? (
          <div className="koala-wizard-shell__footer">
            <div className="koala-wizard-shell__footer-inner">
              {footer}
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

/** Flat Koala primary CTA for wizard steps. */
export const WizardNextButton = ({ label, sublabel, onClick, disabled }: {
  label: string; sublabel?: string; onClick: () => void; disabled?: boolean;
}) => (
  <Button
    type="button"
    variant="primary"
    size="md"
    disabled={disabled}
    onClick={onClick}
    style={{ flex: 1, width: '100%', minHeight: 40, height: 40, fontWeight: 600 }}
  >
    {label}
    {sublabel && <span style={{ fontWeight: 400 }}>{sublabel}</span>}
  </Button>
);

/** Light "Back" wizard button. */
export const WizardBackButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    type="button"
    variant="secondary"
    size="md"
    onClick={onClick}
    style={{ flexShrink: 0, fontWeight: 600, minHeight: 40, height: 40, padding: '10px 24px' }}
  >
    Back
  </Button>
);

export default WizardShell;
