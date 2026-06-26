import React, { useEffect, useState } from 'react';

const font = 'var(--font-family-primary)';

const AlertIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  /** When set, the user must type this exact text to enable the confirm button. */
  confirmText?: string;
}

const ConfirmModal = ({ open, title, message, confirmLabel, onConfirm, onClose, loading, destructive, confirmText }: ConfirmModalProps) => {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (!open) setTyped(''); }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);
  if (!open) return null;

  const accent = destructive ? '#FF6F77' : '#2F2F34';
  const accentHover = destructive ? '#E5484D' : '#783AFB';
  const canConfirm = !loading && (!confirmText || typed === confirmText);

  return (
    <div
      role="presentation"
      onClick={() => { if (!loading) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(440px, 100%)', background: '#FFFFFF', borderRadius: 16, padding: 24, boxShadow: '0 18px 48px rgba(17,24,39,0.22)', animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)', fontFamily: font, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          {destructive && (
            <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 9999, background: 'rgba(255,111,119,0.12)', color: '#FF6F77', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><AlertIcon /></span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: '#18181B' }}>{title}</span>
            <span style={{ fontSize: 14, color: '#52525C', lineHeight: 1.5 }}>{message}</span>
          </div>
        </div>

        {confirmText && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, color: '#52525C' }}>
              Type <span style={{ fontWeight: 600, color: '#18181B' }}>{confirmText}</span> to confirm
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) onConfirm(); }}
              placeholder={confirmText}
              style={{ width: '100%', height: 40, border: '1px solid #D4D4D8', borderRadius: 8, padding: '0 12px', fontSize: 14, color: '#18181B', fontFamily: font, outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(120,58,251,0.1)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => { if (!loading) onClose(); }}
            disabled={loading}
            style={{ height: 40, padding: '0 16px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#FFFFFF', color: '#52525C', fontSize: 14, fontWeight: 600, fontFamily: font, cursor: loading ? 'default' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { if (canConfirm) onConfirm(); }}
            disabled={!canConfirm}
            style={{ height: 40, padding: '0 16px', borderRadius: 8, border: 'none', background: accent, color: '#FFFFFF', fontSize: 14, fontWeight: 600, fontFamily: font, cursor: canConfirm ? 'pointer' : 'default', opacity: canConfirm ? 1 : 0.5, transition: 'background 150ms ease' }}
            onMouseEnter={(e) => { if (canConfirm) e.currentTarget.style.background = accentHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = accent; }}
          >
            {loading ? 'Removing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
