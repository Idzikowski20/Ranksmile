import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '../common/DashboardLayout';
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

/** Dark primary wizard button ("Next—…"). */
export const WizardNextButton = ({ label, sublabel, onClick, disabled }: {
  label: string; sublabel?: string; onClick: () => void; disabled?: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    style={{
      flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '10px 24px', borderRadius: 8, fontSize: 16, lineHeight: '24px', fontWeight: 600,
      border: 'none', fontFamily: 'var(--font-family-primary)',
      background: disabled ? '#9F9FA9' : '#18181B', color: '#fff',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'background 0.15s',
    }}
    onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#783AFB'; }}
    onMouseLeave={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#18181B'; }}
  >
    <span>{label}{sublabel && <span style={{ fontWeight: 400 }}>{sublabel}</span>}</span>
  </button>
);

/** Light "Back" wizard button. */
export const WizardBackButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 24px',
      borderRadius: 8, fontSize: 16, lineHeight: '24px', fontWeight: 600, border: 'none',
      background: '#F4F4F5', color: '#18181B', cursor: 'pointer', fontFamily: 'var(--font-family-primary)',
      transition: 'background 0.15s', flexShrink: 0,
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#E4E4E7'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
  >
    Back
  </button>
);

export default WizardShell;
