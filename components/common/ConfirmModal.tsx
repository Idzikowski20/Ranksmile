import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const font = 'var(--font-family-primary)';

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  destructive?: boolean;
  /** When set, the user must type this exact (case-sensitive) text to enable confirm. */
  confirmText?: string;
  /** Field label above the confirm input (defaults to "Type <confirmText> to confirm"). */
  confirmFieldLabel?: string;
  /** Small hint shown under the confirm input (e.g. "Case sensitive"). */
  confirmHint?: string;
}

const ConfirmModal = ({ open, title, message, confirmLabel, onConfirm, onClose, loading, destructive, confirmText, confirmFieldLabel, confirmHint }: ConfirmModalProps) => {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (!open) setTyped(''); }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);
  if (!open || typeof document === 'undefined') return null;

  const accent = destructive ? '#FF6F77' : '#2F2F34';
  const accentHover = destructive ? '#E5484D' : '#783AFB';
  const canConfirm = !loading && (!confirmText || typed === confirmText);

  // Portal to <body> so the fixed overlay centers on the whole viewport rather than
  // being clipped/offset by a transformed ancestor (the app shell / settings main).
  return createPortal(
    <div
      role="presentation"
      onClick={() => { if (!loading) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(480px, 100%)', background: '#FFFFFF', borderRadius: 16, padding: 24, boxShadow: '0 24px 60px rgba(17,24,39,0.24)', animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)', fontFamily: font, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#18181B', lineHeight: 1.3 }}>{title}</span>
          <button
            type="button"
            aria-label="Close"
            onClick={() => { if (!loading) onClose(); }}
            style={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 32, height: 32, marginTop: -4, marginRight: -4, borderRadius: 8, border: 'none', background: 'transparent', color: '#71717B', cursor: loading ? 'default' : 'pointer', transition: 'background 120ms ease, color 120ms ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; e.currentTarget.style.color = '#18181B'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#71717B'; }}
          >
            <CloseIcon />
          </button>
        </div>

        <span style={{ fontSize: 14, color: '#52525C', lineHeight: 1.55 }}>{message}</span>

        {confirmText && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#18181B' }}>
              {confirmFieldLabel || (<>Type <span style={{ fontWeight: 600 }}>{confirmText}</span> to confirm</>)}
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) onConfirm(); }}
              style={{ width: '100%', height: 40, border: '1px solid #D4D4D8', borderRadius: 8, padding: '0 12px', fontSize: 14, color: '#18181B', fontFamily: font, outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(120,58,251,0.1)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            {confirmHint && <span style={{ fontSize: 13, color: '#71717B' }}>{confirmHint}</span>}
          </div>
        )}

        <div role="separator" style={{ height: 1, background: '#F4F4F5', margin: '0 -24px' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={() => { if (!loading) onClose(); }}
            disabled={loading}
            style={{ height: 40, padding: '0 18px', borderRadius: 8, border: 'none', background: '#F4F4F5', color: '#18181B', fontSize: 14, fontWeight: 600, fontFamily: font, cursor: loading ? 'default' : 'pointer', transition: 'background 120ms ease' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#E4E4E7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { if (canConfirm) onConfirm(); }}
            disabled={!canConfirm}
            style={{ height: 40, padding: '0 18px', borderRadius: 8, border: 'none', background: accent, color: '#FFFFFF', fontSize: 14, fontWeight: 600, fontFamily: font, cursor: canConfirm ? 'pointer' : 'default', opacity: canConfirm ? 1 : 0.5, transition: 'background 150ms ease' }}
            onMouseEnter={(e) => { if (canConfirm) e.currentTarget.style.background = accentHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = accent; }}
          >
            {loading ? 'Removing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ConfirmModal;
