import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '../common/DashboardLayout';
import { Button } from '../core';
import { useFetchDomains } from '../../services/domains';

/**
 * Shared layout for the New-Content wizard steps (content type → context →
 * writing mode → generating). White card, centred 576px column, optional sticky
 * footer action bar.
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
      <Head><title>{`${title} — SerpBear`}</title></Head>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f8f9ff' }}>
        <div style={{ padding: 4, display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ border: '1px solid #E4E4E7', background: '#fff', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '48px 24px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto', width: '100%' }} className="styled-scrollbar">
              <div style={{ width: '100%', maxWidth: 576, display: 'flex', flexDirection: 'column', gap: 32 }}>
                {children}
              </div>
            </div>
            {footer && (
              <div style={{ padding: 12, display: 'flex', justifyContent: 'center', width: '100%', borderTop: '1px solid #E4E4E7' }}>
                <div style={{ width: '100%', maxWidth: 576, display: 'flex', gap: 12 }}>
                  {footer}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

/** Sentry chonk primary CTA for wizard steps. */
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
