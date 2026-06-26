import React, { useState } from 'react';

const F = 'var(--font-family-primary)';

/**
 * Blocking modal shown to anonymous preview visitors before they can view/comment.
 * No close button, no backdrop dismiss, no Escape — a non-empty name is required.
 * Onboarding-style: illustration header + name field.
 */
const PreviewNameGate = ({ onSubmit }: { onSubmit: (name: string) => void }) => {
  const [name, setName] = useState('');
  const valid = name.trim().length >= 2;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSubmit(name.trim());
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Enter your name"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(9,9,11,0.5)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', fontFamily: F, animation: 'pngFade 0.2s ease-out' }}
      onMouseDown={(e) => e.stopPropagation()}>
      <style>{`
        @keyframes pngFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pngPop { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: none; } }
      `}</style>

      <form onSubmit={submit}
        style={{ width: 'min(440px, 100%)', background: '#fff', borderRadius: 21, overflow: 'hidden', boxShadow: '0 32px 80px rgba(9,9,11,0.32), 0 6px 16px rgba(9,9,11,0.12)', animation: 'pngPop 0.32s cubic-bezier(0.16,1,0.3,1)' }}>

        {/* Illustration header */}
        <div style={{ height: 196, position: 'relative', background: 'linear-gradient(135deg, #efe9ff 0%, #eaf1ff 52%, #e9fbf4 100%)', borderBottom: '1px solid #F4F4F5', overflow: 'hidden' }}>
          <img src="/article-viewer.png" alt="" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 42%' }} />
        </div>

        {/* Body */}
        <div style={{ padding: '24px 26px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: '#18181B' }}>What&apos;s your name?</h2>
            <p style={{ margin: '8px 0 0', fontSize: 14.5, lineHeight: 1.55, color: '#52525C' }}>
              You&apos;re viewing a shared draft. Add your name so the author knows who left each comment.
            </p>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First and last name"
              style={{ boxSizing: 'border-box', width: '100%', height: 46, padding: '0 14px', fontSize: 15, fontFamily: F, color: '#18181B', borderRadius: 10, border: '1px solid #D4D4D8', outline: 'none', boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(120,58,251,0.1)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; e.currentTarget.style.boxShadow = '0px 1px 2px 0px rgba(26,29,40,0.06)'; }}
            />
          </div>

          <button type="submit" disabled={!valid}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, border: 'none', borderRadius: 10, background: valid ? '#2F2F34' : '#E4E4E7', color: valid ? '#fff' : '#A1A1AA', fontSize: 15, fontWeight: 600, fontFamily: F, cursor: valid ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}
            onMouseEnter={(e) => { if (valid) e.currentTarget.style.background = '#783AFB'; }}
            onMouseLeave={(e) => { if (valid) e.currentTarget.style.background = '#2F2F34'; }}>
            Continue
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>

          <p style={{ margin: 0, fontSize: 12, color: '#A1A1AA', textAlign: 'center' }}>
            Your name is only used to label your comments.
          </p>
        </div>
      </form>
    </div>
  );
};

export default PreviewNameGate;
