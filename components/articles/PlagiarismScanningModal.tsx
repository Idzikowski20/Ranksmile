import React from 'react';
import { createPortal } from 'react-dom';

const F = 'var(--font-family-primary)';

const Bar = ({ w, light }: { w: string; light?: boolean }) => (
  <span style={{ display: 'block', height: 8, borderRadius: 999, width: w, background: light ? '#efe7fa' : '#d7b8ff' }} />
);

// Full-screen "scanning" overlay shown while the plagiarism check runs (Surfer-style):
// an animated magnifying glass sweeping over two document cards + an indeterminate bar.
const PlagiarismScanningModal = ({ onCancel }: { onCancel: () => void }) => createPortal(
  <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(9,9,11,0.72)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: 24, fontFamily: F }}>
    <style>{`
      @keyframes plagMag {
        0%   { transform: translate(110px, -40px) rotate(0deg); }
        22%  { transform: translate(-110px, 14px) rotate(90deg); }
        44%  { transform: translate(110px, 20px) rotate(0deg); }
        66%, 100% { transform: translate(110px, -34px) rotate(0deg); }
      }
      @keyframes plagBar { 0% { left: -35%; } 100% { left: 100%; } }
    `}</style>

    {/* Document cards + magnifier */}
    <div style={{ position: 'relative', width: 300, height: 168 }}>
      {/* top card (faded) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 74, background: '#d9c6f1', opacity: 0.66, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Bar w="92%" /><Bar w="78%" />
      </div>
      {/* bottom card */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 74, background: '#f7f3fc', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Bar w="80%" light /><Bar w="92%" light />
      </div>
      {/* magnifier */}
      <span style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -27, marginLeft: -27, width: 54, height: 54, animation: 'plagMag 2.3s cubic-bezier(0.25,1,0.25,1) infinite' }}>
        <svg viewBox="0 0 60 60" width={54} height={54}>
          <defs>
            <linearGradient id="plagGrad" x1="0" y1="0" x2="60" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF4087" /><stop offset="100%" stopColor="#FFC056" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="18" fill="none" stroke="url(#plagGrad)" strokeWidth="6" />
          <rect x="34" y="35.5" width="22" height="9" rx="4.5" transform="rotate(45 40 40)" fill="url(#plagGrad)" />
        </svg>
      </span>
    </div>

    <span style={{ color: '#fff', fontSize: 20, fontWeight: 500 }}>We are scanning your content right now…</span>

    {/* indeterminate progress bar */}
    <div style={{ position: 'relative', width: 450, maxWidth: 'calc(100vw - 48px)', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', top: 0, bottom: 0, width: '35%', borderRadius: 999, background: '#783afb', animation: 'plagBar 1.4s ease-in-out infinite' }} />
    </div>

    <button
      type="button"
      onClick={onCancel}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#18181b', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F, transition: 'background 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#783afb'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#18181b'; }}
    >
      <svg viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
      Cancel
    </button>
  </div>,
  document.body,
);

export default PlagiarismScanningModal;
