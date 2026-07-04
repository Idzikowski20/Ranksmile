import React, { useState } from 'react';

const FONT = 'var(--font-family-primary)';

const CloseIcon = () => (
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
   </svg>
);

/**
 * "Create new Audit" modal. URL + one keyword per line → the page creates one audit
 * per keyword. Presentational: the caller owns the mutation and passes onCreate + submitting.
 */
const CreateAuditModal = ({ onClose, onCreate, submitting }: {
   onClose: () => void;
   onCreate: (url: string, keywords: string[]) => void;
   submitting: boolean;
}) => {
   const [url, setUrl] = useState('');
   const [kw, setKw] = useState('');
   const [focus, setFocus] = useState<string | null>(null);

   const keywords = kw.split('\n').map((k) => k.trim()).filter(Boolean);
   const urlOk = /^https?:\/\/.+\..+/i.test(url.trim());
   const canSubmit = urlOk && keywords.length > 0 && !submitting;

   const inputStyle = (name: string): React.CSSProperties => ({
      width: '100%', boxSizing: 'border-box', borderRadius: 8, padding: '9px 12px',
      fontSize: 14, fontFamily: FONT, color: '#18181B', outline: 'none',
      border: `1px solid ${focus === name ? '#AA93FD' : '#D4D4D8'}`,
      boxShadow: focus === name ? '0 0 0 3px rgba(120,58,251,0.1)' : 'none',
      transition: 'border-color 150ms ease, box-shadow 150ms ease',
   });

   return (
      <div
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
         <div style={{ position: 'relative', width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <button
               type="button"
               onClick={onClose}
               aria-label="Close"
               style={{ position: 'absolute', right: 8, top: 8, padding: 8, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', display: 'inline-flex', transition: 'color 150ms ease, transform 150ms ease' }}
               onMouseEnter={(e) => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
               onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.transform = 'none'; }}
            >
               <CloseIcon />
            </button>

            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>Create new Audit</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#71717B', fontFamily: FONT }}>
               One audit is created per keyword. Each runs in the background.
            </p>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3F3F47', fontFamily: FONT, marginBottom: 6 }}>URL to audit</label>
            <input
               value={url}
               onChange={(e) => setUrl(e.target.value)}
               onFocus={() => setFocus('url')}
               onBlur={() => setFocus(null)}
               placeholder="https://example.com/blog/article"
               style={{ ...inputStyle('url'), marginBottom: 16 }}
            />

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3F3F47', fontFamily: FONT, marginBottom: 6 }}>
               Keywords <span style={{ fontWeight: 400, color: '#9F9FA9' }}>— one per line</span>
            </label>
            <textarea
               value={kw}
               onChange={(e) => setKw(e.target.value)}
               onFocus={() => setFocus('kw')}
               onBlur={() => setFocus(null)}
               rows={4}
               placeholder={'ktoś mnie śledzi\njak sprawdzić telefon'}
               style={{ ...inputStyle('kw'), resize: 'vertical', minHeight: 88, lineHeight: 1.5 }}
            />
            <div style={{ marginTop: 6, fontSize: 12, color: '#9F9FA9', fontFamily: FONT, minHeight: 16 }}>
               {keywords.length > 0 && `${keywords.length} audit${keywords.length === 1 ? '' : 's'} will be created`}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
               <button
                  type="button"
                  onClick={onClose}
                  style={{ border: 'none', boxShadow: 'inset 0 0 0 1px #E4E4E7', background: 'transparent', color: '#3F3F47', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', transition: 'background 150ms ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
               >
                  Cancel
               </button>
               <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => onCreate(url.trim(), keywords)}
                  style={{ border: 'none', background: '#2F2F34', color: '#fff', borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5, transition: 'background 150ms ease' }}
                  onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.background = '#783AFB'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
               >
                  {submitting ? 'Creating…' : 'Create audit'}
               </button>
            </div>
         </div>
      </div>
   );
};

export default CreateAuditModal;
