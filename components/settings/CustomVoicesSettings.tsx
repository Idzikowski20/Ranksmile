import React, { useState } from 'react';
import toast from 'react-hot-toast';

const font = 'var(--font-family-primary)';

// ─── Ribbon for the reference-text editor ─────────────────────────────────────

const Chevron = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m19.5 8.25l-7.5 7.5l-7.5-7.5" /></svg>
);

const RibbonBtn = ({ children, chip }: { children: React.ReactNode; chip?: boolean }) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 28,
        minWidth: 28,
        padding: chip ? '0 6px' : 0,
        justifyContent: 'center',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: '#18181B',
        fontFamily: font,
        fontSize: 15,
        background: chip ? (hover ? '#F4F4F5' : '#F8F8F9') : (hover ? '#F4F4F5' : 'transparent'),
        transition: 'background 200ms ease',
      }}
    >
      {children}
    </button>
  );
};

const Divider = () => (
  <span style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
    <span style={{ width: 1, height: 20, background: '#E4E4E7' }} />
  </span>
);

const Ribbon = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <RibbonBtn chip>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#630DE3' }}>Aa</span>
      <span style={{ display: 'inline-flex' }}><Chevron /></span>
    </RibbonBtn>
    <Divider />
    <RibbonBtn><span style={{ fontWeight: 700 }}>B</span></RibbonBtn>
    <RibbonBtn><span style={{ fontStyle: 'italic', fontWeight: 600 }}>I</span></RibbonBtn>
    <RibbonBtn><span style={{ textDecoration: 'line-through', fontWeight: 600 }}>S</span></RibbonBtn>
    <Divider />
    <RibbonBtn>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>
      <Chevron />
    </RibbonBtn>
    <Divider />
    <RibbonBtn><span style={{ fontWeight: 700, fontSize: 16 }}>&#8221;</span></RibbonBtn>
    <RibbonBtn><span style={{ fontSize: 13, fontWeight: 600 }}>&lt;/&gt;</span></RibbonBtn>
  </div>
);

// ─── Add Custom Voice modal ───────────────────────────────────────────────────

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ flexShrink: 0, color: '#9F9FA9' }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" />
  </svg>
);

const NameInput = () => {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="text"
      placeholder="e.g. Surfer Tone of Voice"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        height: 44,
        padding: '0 14px',
        fontFamily: font,
        fontSize: 14,
        color: '#18181B',
        borderRadius: 8,
        border: `1px solid ${focused ? '#AA93FD' : '#E4E4E7'}`,
        boxShadow: focused ? '0 0 0 3px rgba(120,58,251,0.1)' : 'none',
        outline: 'none',
      }}
    />
  );
};

const AddVoiceModal = ({ onClose }: { onClose: () => void }) => {
  const [isDefault, setIsDefault] = useState(true);
  const [saveHover, setSaveHover] = useState(false);
  const [cancelHover, setCancelHover] = useState(false);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 760, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 16, fontFamily: font, boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 12px' }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#18181B' }}>Add Custom Voice</span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', color: '#52525C' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '0 24px 8px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Name</label>
            <NameInput />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Reference text</label>
            <Ribbon />
            <div style={{ border: '1px solid #E4E4E7', borderRadius: 8, padding: '12px 14px', minHeight: 320 }}>
              <div
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                translate="no"
                style={{ outline: 'none', minHeight: 300, fontSize: 16, lineHeight: 1.75, color: '#18181B' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 14, color: '#3F3F47', fontVariantNumeric: 'tabular-nums slashed-zero' }}>0 words</span>
              <span style={{ fontSize: 14, color: '#52525C' }}>The reference text should be at least 200 words long</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 24px 24px' }}>
          <button
            type="button"
            onClick={() => setIsDefault((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: font }}
          >
            <span style={{ display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: 5, background: isDefault ? '#18181B' : '#fff', border: isDefault ? 'none' : '1px solid #D4D4D8' }}>
              {isDefault && (
                <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </span>
            <span style={{ fontSize: 14, color: '#3F3F47' }}>Set the voice as default</span>
            <InfoIcon />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              onMouseEnter={() => setCancelHover(true)}
              onMouseLeave={() => setCancelHover(false)}
              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: font, fontSize: 14, fontWeight: 600, color: '#18181B', background: cancelHover ? '#E4E4E7' : '#F4F4F5', transition: 'background 150ms ease' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { onClose(); toast.success('Custom Voice saved'); }}
              onMouseEnter={() => setSaveHover(true)}
              onMouseLeave={() => setSaveHover(false)}
              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: font, fontSize: 14, fontWeight: 600, color: '#fff', background: saveHover ? '#783AFB' : '#18181B', transition: 'background 150ms ease' }}
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const AddButton = ({ onClick }: { onClick: () => void }) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 16px',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        fontFamily: font,
        fontSize: 14,
        fontWeight: 600,
        color: '#fff',
        background: hover ? '#783AFB' : '#18181B',
        transition: 'background 150ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      Add Custom Voice
    </button>
  );
};

const CustomVoicesSettings = () => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', fontFamily: font }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <AddButton onClick={() => setOpen(true)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%', padding: 16, borderRadius: 8, background: '#F8F8F9', fontSize: 14, color: '#3F3F47' }}>
        You haven&apos;t created any Custom Voice yet
      </div>

      {open && <AddVoiceModal onClose={() => setOpen(false)} />}
    </div>
  );
};

export default CustomVoicesSettings;
