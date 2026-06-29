import React, { useState, useRef, useEffect } from 'react';
import { CONTEXT_WINDOW_TOKENS, contextUsageColor, contextUsagePct } from '../../lib/ai/contextWindow';

const abbr = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '0';
  return n < 1000 ? String(Math.round(n)) : `${(n / 1000).toFixed(1)}k`;
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, lineHeight: '18px' }}>
    <span style={{ color: '#52525c' }}>{label}</span>
    <span style={{ color: '#18181b', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  </div>
);

type Props = {
  conversationTokens: number; // tokens the current conversation occupies (≈ last turn's input)
  contextWindow?: number;
  lastInput?: number;
  lastOutput?: number;
  totalInput?: number;
  totalOutput?: number;
  /** 'down' opens the card below-right (header); 'up' opens it above-left (composer footer). */
  placement?: 'down' | 'up';
  /** When set, the ring tracks the organization's shared 5h pool; shows when it refills (epoch ms). */
  resetsAt?: number;
};

/** "Resets at 14:30" — local time the shared org pool refills. */
const resetLabel = (resetsAt: number) => {
  try { return new Date(resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

/** Twenty-style context-window usage ring (real tokens vs the model's context window), light theme.
 *  Hover (or click) opens a card with the % full, last-message tokens and conversation totals. */
const ContextUsageRing = ({
  conversationTokens, contextWindow = CONTEXT_WINDOW_TOKENS,
  lastInput = 0, lastOutput = 0, totalInput = 0, totalOutput = 0, placement = 'down', resetsAt,
}: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pct = contextUsagePct(conversationTokens, contextWindow);
  const color = contextUsageColor(pct);
  const size = 18; const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Context usage"
        title={`${pct.toFixed(1)}% of context window`}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 9999 }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4e4e7" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 300ms ease, stroke 300ms ease' }} />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          style={{
            position: 'absolute', zIndex: 200, width: 252,
            ...(placement === 'up' ? { bottom: 'calc(100% + 8px)', left: 0 } : { top: 'calc(100% + 8px)', right: 0 }),
            background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: 12,
            boxShadow: '0px 8px 24px rgba(24,26,34,0.16), 0px 2px 6px rgba(24,26,34,0.08)',
            transformOrigin: placement === 'up' ? 'bottom left' : 'top right', animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)',
            fontFamily: 'var(--font-family-primary)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#18181b', marginBottom: 8 }}>{resetsAt ? 'Organization AI usage' : 'Context window'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: '#18181b', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
            <span style={{ color: '#52525c', fontVariantNumeric: 'tabular-nums' }}>{abbr(conversationTokens)} / {abbr(contextWindow)} tokens</span>
          </div>
          <div style={{ height: 5, borderRadius: 9999, background: '#f4f4f5', overflow: 'hidden', marginBottom: resetsAt ? 7 : 11 }}>
            <div style={{ height: '100%', width: `${Math.round(pct)}%`, background: color, borderRadius: 9999, transition: 'width 300ms ease, background 300ms ease' }} />
          </div>
          {resetsAt ? (
            <div style={{ fontSize: 11, color: '#9f9fa9', marginBottom: 11, fontVariantNumeric: 'tabular-nums' }}>
              Shared across your organization · resets at {resetLabel(resetsAt)}
            </div>
          ) : null}

          <div style={{ paddingTop: 9, borderTop: '1px solid #f4f4f5' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#18181b', margin: '2px 0 6px' }}>Last message</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Row label="Input tokens" value={lastInput ? abbr(lastInput) : '—'} />
              <Row label="Output tokens" value={lastOutput ? abbr(lastOutput) : '—'} />
            </div>
          </div>

          <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid #f4f4f5' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#18181b', margin: '2px 0 6px' }}>Conversation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Row label="Input tokens" value={totalInput ? abbr(totalInput) : '—'} />
              <Row label="Output tokens" value={totalOutput ? abbr(totalOutput) : '—'} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContextUsageRing;
