import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CONTEXT_WINDOW_TOKENS, contextUsageColor, contextUsagePct } from '../../lib/ai/contextWindow';

const abbr = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '0';
  return n < 1000 ? String(Math.round(n)) : `${(n / 1000).toFixed(1)}k`;
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, lineHeight: '18px' }}>
    <span style={{ color: 'var(--koala-text-secondary)' }}>{label}</span>
    <span style={{ color: 'var(--koala-text-primary)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
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

const CARD_W = 252;

type FixedPos = { left: number; top?: number; bottom?: number; transformOrigin: string };

/** Twenty-style context-window usage ring. Hover/click opens a usage card (ported to body — parents clip overflow). */
const ContextUsageRing = ({
  conversationTokens, contextWindow = CONTEXT_WINDOW_TOKENS,
  lastInput = 0, lastOutput = 0, totalInput = 0, totalOutput = 0, placement = 'down', resetsAt,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<FixedPos | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pct = contextUsagePct(conversationTokens, contextWindow);
  const color = contextUsageColor(pct);
  const size = 18; const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;

  const clearClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const openNow = () => { clearClose(); setOpen(true); };
  const closeSoon = () => {
    clearClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = placement === 'up' ? rect.left : rect.right - CARD_W;
    left = Math.max(pad, Math.min(left, window.innerWidth - CARD_W - pad));
    if (placement === 'up') {
      // bottom: from viewport bottom — avoids fighting growOut's transform: scale()
      setPos({ left, bottom: window.innerHeight - rect.top + pad, transformOrigin: 'bottom left' });
    } else {
      setPos({ left, top: rect.bottom + pad, transformOrigin: 'top right' });
    }
  }, [placement]);

  useEffect(() => {
    if (!open) { setPos(null); return undefined; }
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if ((e.target as HTMLElement).closest?.('[data-context-usage-card]')) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => () => clearClose(), []);

  const card = open && pos && typeof document !== 'undefined'
    ? createPortal(
      <div
        role="dialog"
        data-context-usage-card
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        style={{
          position: 'fixed',
          zIndex: 10050,
          width: CARD_W,
          left: pos.left,
          top: pos.top,
          bottom: pos.bottom,
          transformOrigin: pos.transformOrigin,
          background: 'var(--koala-bg-primary)',
          border: '1px solid var(--koala-border-primary)',
          borderRadius: 12,
          padding: 12,
          boxShadow: '0px 8px 24px rgba(24,26,34,0.16), 0px 2px 6px rgba(24,26,34,0.08)',
          animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)',
          fontFamily: 'var(--font-family-primary)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--koala-text-primary)', marginBottom: 8 }}>{resetsAt ? 'Organization AI usage' : 'Context window'}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: 'var(--koala-text-primary)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
          <span style={{ color: 'var(--koala-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{abbr(conversationTokens)} / {abbr(contextWindow)} tokens</span>
        </div>
        <div style={{ height: 5, borderRadius: 9999, background: 'var(--koala-bg-secondary)', overflow: 'hidden', marginBottom: resetsAt ? 7 : 11 }}>
          <div style={{ height: '100%', width: `${Math.round(pct)}%`, background: color, borderRadius: 9999, transition: 'width 300ms ease, background 300ms ease' }} />
        </div>
        {resetsAt ? (
          <div style={{ fontSize: 11, color: 'var(--koala-text-disabled)', marginBottom: 11, fontVariantNumeric: 'tabular-nums' }}>
            Shared across your organization · resets at {resetLabel(resetsAt)}
          </div>
        ) : null}

        <div style={{ paddingTop: 9, borderTop: '1px solid var(--koala-bg-secondary)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--koala-text-primary)', margin: '2px 0 6px' }}>Last message</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Row label="Input tokens" value={lastInput ? abbr(lastInput) : '—'} />
            <Row label="Output tokens" value={lastOutput ? abbr(lastOutput) : '—'} />
          </div>
        </div>

        <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--koala-bg-secondary)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--koala-text-primary)', margin: '2px 0 6px' }}>Conversation</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Row label="Input tokens" value={totalInput ? abbr(totalInput) : '—'} />
            <Row label="Output tokens" value={totalOutput ? abbr(totalOutput) : '—'} />
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Context usage"
        title={`${pct.toFixed(1)}% of context window`}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 9999 }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--koala-border-primary)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 300ms ease, stroke 300ms ease' }} />
        </svg>
      </button>
      {card}
    </div>
  );
};

export default ContextUsageRing;
