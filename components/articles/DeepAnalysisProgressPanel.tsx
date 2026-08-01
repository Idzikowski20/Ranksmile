import React from 'react';
import type { DeepAnalysisUiState, DeepAnalysisUiStep } from '../../lib/deepAnalysisProgress';
import DomainFavicon from '../common/DomainFavicon';
import AnalysisCircuitBoard from '../ranksmile/AnalysisCircuitBoard';

const Spinner = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: 'spin 0.8s linear infinite' }}>
    <circle cx={12} cy={12} r={9} fill="none" stroke="#E4E4E7" strokeWidth={2} />
    <path d="M12 3a9 9 0 0 1 8.5 5.5" fill="none" stroke="#52525C" strokeWidth={2} strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 12.5l3.5 3.5L18 8" stroke="#9F9FA9" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StepRow = ({ step }: { step: DeepAnalysisUiStep }) => {
  const isRunning = step.status === 'running';
  const isDone = step.status === 'done';
  const textColor = isRunning ? '#18181B' : isDone ? '#9F9FA9' : '#A1A1AA';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, lineHeight: '20px', fontFamily: 'var(--font-family-primary)' }}>
        <div style={{ width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isRunning ? <Spinner /> : isDone ? <CheckIcon /> : null}
        </div>
        <span
          style={{
            color: textColor,
            fontWeight: isRunning ? 500 : 400,
            background: isRunning
              ? 'linear-gradient(90deg, #52525C 0%, #18181B 50%, #52525C 100%)'
              : undefined,
            backgroundSize: isRunning ? '200% 100%' : undefined,
            WebkitBackgroundClip: isRunning ? 'text' : undefined,
            WebkitTextFillColor: isRunning ? 'transparent' : undefined,
            animation: isRunning ? 'loadingGradient 2s ease-in-out infinite' : undefined,
          }}
        >
          {step.label}
        </span>
      </div>
      {step.detail && isRunning && (
        <div
          style={{
            marginLeft: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#52525C',
            fontFamily: 'var(--font-family-primary)',
            overflow: 'hidden',
          }}
        >
          <DomainFavicon domain={step.detail.split(' ')[0]} size={14} style={{ borderRadius: 2 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.detail}</span>
        </div>
      )}
    </div>
  );
};

const EngineIcons = () => (
  <div style={{ display: 'flex', flexDirection: 'row' }}>
    {[
      <path key="g" d="M9.00005 16.1739C9.00005 15.1815 8.80875 14.2489 8.42614 13.3761C8.05548 12.5033 7.54734 11.744 6.90169 11.0984C6.25604 10.4527 5.49682 9.94457 4.62399 9.5739C3.75116 9.1913 2.81856 8.99999 1.82617 8.99999C2.81856 8.99999 3.75116 8.81466 4.62399 8.44402C5.49682 8.06142 6.25604 7.54727 6.90169 6.90162C7.54734 6.25598 8.05548 5.49673 8.42614 4.62392C8.80875 3.7511 9.00005 2.8185 9.00005 1.82611C9.00005 2.8185 9.18539 3.7511 9.55602 4.62392C9.93863 5.49673 10.4528 6.25598 11.0984 6.90162C11.7441 7.54727 12.5033 8.06142 13.3761 8.44402C14.2489 8.81466 15.1816 8.99999 16.1739 8.99999C15.1816 8.99999 14.2489 9.1913 13.3761 9.5739C12.5033 9.94457 11.7441 10.4527 11.0984 11.0984C10.4528 11.744 9.93863 12.5033 9.55602 13.3761C9.18539 14.2489 9.00005 15.1815 9.00005 16.1739Z" fill="#3179ED" />,
    ].map((icon, i) => (
      <div
        key={i}
        style={{
          marginRight: -4,
          width: 24,
          height: 24,
          borderRadius: 9999,
          border: '1px solid #E4E4E7',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width={14} height={14} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          {icon}
        </svg>
      </div>
    ))}
    <div style={{ marginRight: -4, width: 24, height: 24, borderRadius: 9999, border: '1px solid #E4E4E7', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.6823 8.18368C15.6823 7.63986 15.6382 7.0931 15.5442 6.55811H7.99829V9.63876H12.3194C12.1401 10.6323 11.564 11.5113 10.7203 12.0698V14.0687H13.2983C14.8122 12.6753 15.6823 10.6176 15.6823 8.18368Z" fill="#4285F4" />
        <path d="M7.99812 16C10.1558 16 11.9753 15.2915 13.3011 14.0687L10.7231 12.0698C10.0058 12.5578 9.07988 12.8341 8.00106 12.8341C5.91398 12.8341 4.14436 11.426 3.50942 9.53296H0.849121V11.5936C2.2072 14.295 4.97332 16 7.99812 16Z" fill="#34A853" />
        <path d="M3.50665 9.53295C3.17154 8.53938 3.17154 7.4635 3.50665 6.46993V4.4093H0.849292C-0.285376 6.66982 -0.285376 9.33306 0.849292 11.5936L3.50665 9.53295Z" fill="#FBBC04" />
        <path d="M7.99812 3.16589C9.13867 3.14825 10.241 3.57743 11.067 4.36523L13.3511 2.0812C11.9048 0.723121 9.98526 -0.0235266 7.99812 -1.02057e-05C4.97332 -1.02057e-05 2.2072 1.70493 0.849121 4.40932L3.50648 6.46995C4.13848 4.57394 5.91104 3.16589 7.99812 3.16589Z" fill="#EA4335" />
      </svg>
    </div>
    <div style={{ marginRight: -4, width: 24, height: 24, borderRadius: 9999, border: '1px solid #E4E4E7', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={14} height={14} viewBox="0 0 18 18" fill="none">
        <path d="M14.1461 8.6792C13.1338 8.24322 12.2484 7.64599 11.4884 6.88676C10.7292 6.12753 10.1312 5.24138 9.696 4.22907C9.52952 3.84162 9.3944 3.44222 9.29138 3.03311C9.25778 2.89948 9.13834 2.80542 9.00023 2.80542C8.86211 2.80542 8.74267 2.89948 8.70907 3.03311C8.60605 3.44222 8.47167 3.84013 8.30445 4.22907C7.86847 5.24138 7.27124 6.12753 6.512 6.88676C5.75277 7.64525 4.86663 8.24322 3.85432 8.6792C3.46686 8.84568 3.06746 8.98081 2.65836 9.08383C2.52473 9.11742 2.43066 9.23687 2.43066 9.37498C2.43066 9.51309 2.52473 9.63254 2.65836 9.66613C3.06746 9.76915 3.46537 9.90353 3.85432 10.0708C4.86663 10.5067 5.75202 11.104 6.512 11.8632C7.27124 12.6224 7.86922 13.5086 8.30445 14.5209C8.47167 14.9091 8.60605 15.3077 8.70907 15.7168C8.72535 15.7818 8.76283 15.8394 8.81556 15.8807C8.8683 15.9219 8.93328 15.9444 9.00023 15.9445C9.13834 15.9445 9.25778 15.8505 9.29138 15.7168C9.3944 15.3077 9.52878 14.9098 9.696 14.5209C10.132 13.5086 10.7292 12.6232 11.4884 11.8632C12.2477 11.104 13.1338 10.506 14.1461 10.0708C14.5343 9.90353 14.933 9.76915 15.3421 9.66613C15.407 9.64985 15.4647 9.61238 15.5059 9.55964C15.5472 9.50691 15.5696 9.44193 15.5698 9.37498C15.5698 9.23687 15.4757 9.11742 15.3421 9.08383C14.933 8.98081 14.5351 8.84643 14.1461 8.6792Z" fill="#F84416" />
      </svg>
    </div>
  </div>
);

function runningStatus(state: DeepAnalysisUiState): string {
  const all = [...state.aiSearch, ...state.googleSearch];
  const running = all.find((s) => s.status === 'running');
  if (running) return running.label;
  if (state.error) return state.error;
  return 'Analyzing content…';
}

function progressFromState(state: DeepAnalysisUiState): number {
  const all = [...state.aiSearch, ...state.googleSearch];
  if (!all.length) return 0;
  const done = all.filter((s) => s.status === 'done').length;
  const running = all.some((s) => s.status === 'running') ? 0.5 : 0;
  return Math.min(100, Math.round(((done + running) / all.length) * 100));
}

interface Props {
  state: DeepAnalysisUiState;
}

const DeepAnalysisProgressPanel = ({ state }: Props) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      justifyContent: 'flex-start',
      minHeight: 280,
      fontFamily: 'var(--font-family-primary)',
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AnalysisCircuitBoard variant="deep-analysis" state={state} width={280} height={168} />
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#181225', lineHeight: '22px' }}>Deep analysis</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6A6772', lineHeight: '18px' }} aria-live="polite">
          {runningStatus(state)}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressFromState(state)}
          style={{ marginTop: 10, height: 4, borderRadius: 999, background: '#E6E6E9', overflow: 'hidden' }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressFromState(state)}%`,
              background: '#F84416',
              borderRadius: 999,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6A6772' }}>{progressFromState(state)}%</p>
      </div>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#18181B' }}>AI Search</span>
        <EngineIcons />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {state.aiSearch.map((step) => (
          <StepRow key={step.key} step={step} />
        ))}
      </div>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#18181B' }}>Google Search results</span>
        <div style={{ border: '1px solid #E4E4E7', background: '#FFFFFF', borderRadius: 9999, padding: 4, display: 'flex' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15.6823 8.18368C15.6823 7.63986 15.6382 7.0931 15.5442 6.55811H7.99829V9.63876H12.3194C12.1401 10.6323 11.564 11.5113 10.7203 12.0698V14.0687H13.2983C14.8122 12.6753 15.6823 10.6176 15.6823 8.18368Z" fill="#4285F4" />
            <path d="M7.99812 16C10.1558 16 11.9753 15.2915 13.3011 14.0687L10.7231 12.0698C10.0058 12.5578 9.07988 12.8341 8.00106 12.8341C5.91398 12.8341 4.14436 11.426 3.50942 9.53296H0.849121V11.5936C2.2072 14.295 4.97332 16 7.99812 16Z" fill="#34A853" />
            <path d="M3.50665 9.53295C3.17154 8.53938 3.17154 7.4635 3.50665 6.46993V4.4093H0.849292C-0.285376 6.66982 -0.285376 9.33306 0.849292 11.5936L3.50665 9.53295Z" fill="#FBBC04" />
            <path d="M7.99812 3.16589C9.13867 3.14825 10.241 3.57743 11.067 4.36523L13.3511 2.0812C11.9048 0.723121 9.98526 -0.0235266 7.99812 -1.02057e-05C4.97332 -1.02057e-05 2.2072 1.70493 0.849121 4.40932L3.50648 6.46995C4.13848 4.57394 5.91104 3.16589 7.99812 3.16589Z" fill="#EA4335" />
          </svg>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {state.googleSearch.map((step) => (
          <StepRow key={step.key} step={step} />
        ))}
      </div>
    </div>

    {state.error && (
      <p style={{ margin: 0, fontSize: 13, color: '#FF6F77' }}>{state.error}</p>
    )}
  </div>
);

export default DeepAnalysisProgressPanel;
