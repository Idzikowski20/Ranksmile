import React from 'react';
import { useRouter } from 'next/router';
import SectionHeader from './SectionHeader';
import { useOnboardingChecklist } from '../../lib/useOnboardingChecklist';

const font = 'var(--font-family-primary)';

const GetStartedIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M3.33789 7C5.06694 4.01099 8.29866 2 12.0001 2C17.5229 2 22.0001 6.47715 22.0001 12C22.0001 17.5228 17.5229 22 12.0001 22C8.29866 22 5.06694 19.989 3.33789 17M12 16L16 12M16 12L12 8M16 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Chevron = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m8.25 4.5l7.5 7.5l-7.5 7.5" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0a9 9 0 0 1 18 0" />
  </svg>
);

const Ring = ({ pct }: { pct: number }) => {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <span style={{ position: 'relative', display: 'grid', placeItems: 'center', width: 44, height: 44, flexShrink: 0 }}>
      <svg viewBox="0 0 44 44" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="6" stroke="#E4E4E7" />
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="6" strokeLinecap="round" stroke="#1AB25E" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset 500ms' }} />
      </svg>
      <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1, color: '#09090B', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
    </span>
  );
};

/** Onboarding "Next step" card — driven by the real checklist; hidden once complete. */
const GetStartedCard = () => {
  const router = useRouter();
  const { pct, nextStep, loading } = useOnboardingChecklist();
  if (loading || !nextStep) return null; // wait for real state; hide when all done

  const href = nextStep.href || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader icon={<GetStartedIcon />} label="Get started" />

      <div
        className="dashboard-getstarted-card"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          padding: '16px 24px',
          borderRadius: 16,
          border: '1px solid #F4F4F5',
          background: 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
          <Ring pct={pct} />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 11, lineHeight: '14px', fontWeight: 600, textTransform: 'uppercase', color: '#52525C', fontFamily: font }}>Next step</span>
            <span style={{ marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 6, color: '#52525C' }}>
              <span style={{ fontSize: 16, lineHeight: '20px', fontWeight: 600, color: '#09090B', fontFamily: font }}>{nextStep.label}</span>
              <Chevron />
              {nextStep.time && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 13, color: '#71717B', fontFamily: font }}>
                  <ClockIcon />
                  {nextStep.time}
                </span>
              )}
            </span>
          </div>
        </div>

        {href && (
          <a
            href={href}
            onClick={(e) => { e.preventDefault(); router.push(href); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              alignSelf: 'flex-start',
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              background: '#18181B',
              textDecoration: 'none',
              fontFamily: font,
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#783AFB'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#18181B'; }}
          >
            {nextStep.cta || 'Continue'}
            <span style={{ order: 1, display: 'inline-flex' }}><Chevron /></span>
          </a>
        )}
      </div>
    </div>
  );
};

export default GetStartedCard;
