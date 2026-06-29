import React, { useState, useRef, useEffect } from 'react';
import { formatTokens } from '../../lib/ai/sse';

// This-turn soft reference for the ring fill (per the Phase 4 decision).
const TOKEN_BUDGET = 60_000;

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, lineHeight: '18px', fontFamily: 'var(--font-family-primary)' }}>
    <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
    <span style={{ color: '#fff', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  </div>
);

/** Twenty/Claude-style usage ring for the dark Surfy bar: this turn's tokens filling toward
 *  TOKEN_BUDGET, compact count in the centre. Click to open a popover with the breakdown. */
const TokenCircle = ({ tokens, inputTokens = 0, outputTokens = 0 }: { tokens: number; inputTokens?: number; outputTokens?: number }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pct = Math.max(0, Math.min(tokens / TOKEN_BUDGET, 1));
  const r = 13;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Token usage"
        title={`${Math.max(0, Math.round(tokens)).toLocaleString()} tokens used this turn — click for details`}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 9999 }}
      >
        <svg width={32} height={32} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx={16} cy={16} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={3} />
          <circle cx={16} cy={16} r={r} fill="none" stroke="#AA93FD" strokeWidth={3} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 16 16)" style={{ transition: 'stroke-dashoffset 300ms ease' }} />
          <text x={16} y={16} textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-family-primary)" fontSize={8.5} fontWeight={600} fill="rgba(255,255,255,0.9)">{formatTokens(tokens)}</text>
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200, width: 232,
            background: '#18181b', border: '1px solid #221e28', borderRadius: 12, padding: 12,
            boxShadow: '0px 12px 28px 0px rgba(0,0,0,0.45), 0px 2px 6px 0px rgba(0,0,0,0.3)',
            transformOrigin: 'top right', animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)',
            fontFamily: 'var(--font-family-primary)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Token usage</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>this turn</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 5 }}>
            <span>Total</span>
            <span style={{ color: '#fff', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
              {Math.max(0, Math.round(tokens)).toLocaleString()}
              <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}> / {TOKEN_BUDGET.toLocaleString()}</span>
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 9999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 11 }}>
            <div style={{ height: '100%', width: `${Math.round(pct * 100)}%`, background: '#AA93FD', borderRadius: 9999, transition: 'width 300ms ease' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row label="Input" value={inputTokens ? inputTokens.toLocaleString() : '—'} />
            <Row label="Output" value={outputTokens ? outputTokens.toLocaleString() : '—'} />
          </div>

          <div style={{ marginTop: 11, paddingTop: 9, borderTop: '1px solid #221e28', fontSize: 10.5, lineHeight: '14px', color: 'rgba(255,255,255,0.4)' }}>
            Tokens Surfy used on the last request. The ring fills toward a soft {formatTokens(TOKEN_BUDGET)} per-turn budget.
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenCircle;
