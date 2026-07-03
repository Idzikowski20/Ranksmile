import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useOnboardingChecklist } from '../../lib/useOnboardingChecklist';

const font = 'var(--font-family-primary)';
const GREEN = '#1AB25E';

interface ChecklistItem {
  label: string;
  done: boolean;
  time?: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M20.7071 5.29289C21.0976 5.68342 21.0976 6.31658 20.7071 6.70711L9.70711 17.7071C9.31658 18.0976 8.68342 18.0976 8.29289 17.7071L3.29289 12.7071C2.90237 12.3166 2.90237 11.6834 3.29289 11.2929C3.68342 10.9024 4.31658 10.9024 4.70711 11.2929L9 15.5858L19.2929 5.29289C19.6834 4.90237 20.3166 4.90237 20.7071 5.29289Z" fill="currentColor" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0a9 9 0 0 1 18 0" />
  </svg>
);

// ─── Progress ring (collapsed pill) ───────────────────────────────────────────

const ProgressRing = ({ pct }: { pct: number }) => {
  const r = 17;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <span style={{ position: 'relative', display: 'grid', placeItems: 'center', width: 42, height: 42, flexShrink: 0 }}>
      <svg viewBox="0 0 42 42" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="21" cy="21" r={r} fill="none" strokeWidth="6" stroke="rgba(255,255,255,0.15)" />
        <circle
          cx="21"
          cy="21"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          stroke={GREEN}
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 500ms' }}
        />
      </svg>
      <span style={{ fontSize: 10, fontWeight: 700, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
    </span>
  );
};

// ─── Checklist item (pending, interactive) ────────────────────────────────────

const PendingRow = ({ item }: { item: ChecklistItem }) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={() => toast('Onboarding step — coming soon!')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        padding: 8,
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        background: hover ? 'rgba(255,255,255,0.06)' : 'transparent',
        transition: 'background 100ms ease',
        fontFamily: font,
      }}
    >
      <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 9999, border: '2px solid rgba(255,255,255,0.3)' }} />
      <span style={{ minWidth: 0, flex: 1, fontSize: 13, lineHeight: 1.25, color: '#fff', fontWeight: 500 }}>{item.label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, color: '#9F9FA9', fontSize: 11 }}>
        <ClockIcon />
        {item.time}
      </span>
    </button>
  );
};

const DoneRow = ({ item }: { item: ChecklistItem }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', padding: 8, borderRadius: 10 }}>
    <span style={{ display: 'grid', placeItems: 'center', width: 20, height: 20, flexShrink: 0, borderRadius: 9999, background: GREEN, color: '#fff' }}>
      <CheckIcon />
    </span>
    <span style={{ minWidth: 0, flex: 1, fontSize: 13, lineHeight: 1.25, color: '#9F9FA9', textDecoration: 'line-through' }}>{item.label}</span>
  </div>
);

// ─── Main widget ──────────────────────────────────────────────────────────────

const SidebarLaunchpad = () => {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [minHover, setMinHover] = useState(false);
  const [skipHover, setSkipHover] = useState(false);
  const [pillHover, setPillHover] = useState(false);

  // Real onboarding state (shared with the dashboard "Get started" card).
  const { steps: ITEMS, done: DONE, pct: PCT } = useOnboardingChecklist();

  // Hide once every step is complete (or the user skipped it).
  if (dismissed || PCT >= 100) return null;

  return (
    <>
      {/* Collapsed pill — pinned to sidebar bottom */}
      <div
        data-launchpad="true"
        className="max-lg:hidden"
        style={{ position: 'fixed', left: 0, bottom: 0, width: 220, zIndex: 60, padding: '0px 12px 12px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      >
        <button
          type="button"
          aria-label="Open Surfer setup"
          onClick={() => setOpen((o) => !o)}
          onMouseEnter={() => setPillHover(true)}
          onMouseLeave={() => setPillHover(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            width: '100%',
            textAlign: 'left',
            padding: '8px 12px',
            borderRadius: 9999,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(0,0,0,0.7)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(2px)',
            cursor: 'pointer',
            fontFamily: font,
            filter: pillHover ? 'brightness(1.25)' : 'none',
            transition: 'filter 200ms ease, transform 200ms ease',
          }}
        >
          <ProgressRing pct={PCT} />
          <span style={{ display: 'flex', minWidth: 0, flexDirection: 'column' }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '-0.025em' }}>Get started</span>
            <span style={{ color: '#9F9FA9', fontSize: 11, fontWeight: 500 }}>{DONE} of {ITEMS.length} complete</span>
          </span>
        </button>
      </div>

      {/* Expanded panel — fixed overlay above the pill */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 65 }}
          />
          <div
            className="max-lg:hidden styled-scrollbar-dark"
            style={{
              position: 'fixed',
              left: 12,
              bottom: 80,
              width: 360,
              maxWidth: 'calc(100vw - 24px)',
              zIndex: 70,
              overflow: 'hidden',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(9,9,11,0.98)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(24px)',
              fontFamily: font,
            }}
          >
            {/* Header */}
            <div style={{ padding: '24px 24px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '-0.025em' }}>Get started</span>
                  <span style={{ color: '#9F9FA9', fontSize: 13 }}>{DONE} of {ITEMS.length} complete</span>
                </span>
                <button
                  type="button"
                  aria-label="Minimize"
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => setMinHover(true)}
                  onMouseLeave={() => setMinHover(false)}
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    color: '#D4D4D8',
                    background: minHover ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)',
                    transition: 'background 150ms ease',
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 12h14" />
                  </svg>
                </button>
              </div>
              <div style={{ height: 6, width: '100%', overflow: 'hidden', borderRadius: 9999, background: 'rgba(255,255,255,0.1)' }}>
                <div style={{ height: '100%', width: '100%', transformOrigin: 'left center', borderRadius: 9999, background: GREEN, transform: `scaleX(${PCT / 100})`, transition: 'transform 500ms ease-out' }} />
              </div>
            </div>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px 16px', maxHeight: 380, overflowY: 'auto' }}>
              {ITEMS.map((item) => (item.done ? <DoneRow key={item.label} item={item} /> : <PendingRow key={item.label} item={item} />))}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                onClick={() => { setDismissed(true); toast('Checklist skipped'); }}
                onMouseEnter={() => setSkipHover(true)}
                onMouseLeave={() => setSkipHover(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: font,
                  fontSize: 13,
                  color: skipHover ? '#fff' : '#9F9FA9',
                  transition: 'color 150ms ease',
                }}
              >
                Skip checklist
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default SidebarLaunchpad;
