import React, { useEffect, useRef, useState } from 'react';
import { AUDIT_COUNTRIES } from '../../lib/countryLang';

const FONT = 'var(--font-family-primary)';

const CloseIcon = () => (
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);
const BrowserIcon = () => (
   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M5.25 6h.008v.008H5.25zM7.5 6h.008v.008H7.5zm2.25 0h.008v.008H9.75z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const KeyIcon = () => (
   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Chevron = () => (
   <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" fill="currentColor" /></svg>
);

/**
 * "Create new Audit" modal. URL + keyword chips (one audit per keyword) + a country/region
 * whose language drives the competitor SERP + NLP terms. Presentational: the caller owns
 * the mutation and passes onCreate + submitting.
 */
const CreateAuditModal = ({ onClose, onCreate, submitting, defaultCountry = 'PL' }: {
   onClose: () => void;
   onCreate: (url: string, keywords: string[], country: string) => void;
   submitting: boolean;
   defaultCountry?: string;
}) => {
   const [url, setUrl] = useState('');
   const [chips, setChips] = useState<string[]>([]);
   const [draft, setDraft] = useState('');
   const [country, setCountry] = useState(defaultCountry);
   const [focus, setFocus] = useState<string | null>(null);
   const [ctryOpen, setCtryOpen] = useState(false);
   const ctryRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      if (!ctryOpen) return undefined;
      const onDoc = (e: MouseEvent) => { if (ctryRef.current && !ctryRef.current.contains(e.target as Node)) setCtryOpen(false); };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
   }, [ctryOpen]);

   const addChip = (raw: string) => {
      const v = raw.trim();
      if (v && !chips.includes(v)) setChips((c) => [...c, v]);
      setDraft('');
   };
   const onKwKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addChip(draft); }
      else if (e.key === 'Backspace' && !draft && chips.length) setChips((c) => c.slice(0, -1));
   };

   const keywords = draft.trim() ? [...chips, draft.trim()].filter((v, i, a) => a.indexOf(v) === i) : chips;
   const urlOk = /^https?:\/\/.+\..+/i.test(url.trim());
   const canSubmit = urlOk && keywords.length > 0 && !submitting;
   const selected = AUDIT_COUNTRIES.find((c) => c.code === country) || AUDIT_COUNTRIES[0];

   const fieldBorder = (name: string): React.CSSProperties => ({
      border: `1px solid ${focus === name ? '#AA93FD' : '#D4D4D8'}`,
      boxShadow: focus === name ? '0 0 0 3px rgba(120,58,251,0.1)' : 'none',
      transition: 'border-color 150ms ease, box-shadow 150ms ease',
   });

   return (
      <div
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
         <div style={{ position: 'relative', width: '100%', maxWidth: 520, background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <button
               type="button" onClick={onClose} aria-label="Close"
               style={{ position: 'absolute', right: 12, top: 12, padding: 8, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', display: 'inline-flex', transition: 'color 150ms ease, transform 150ms ease' }}
               onMouseEnter={(e) => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
               onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.transform = 'none'; }}
            ><CloseIcon /></button>

            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>Create new Audit</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#71717B', fontFamily: FONT }}>One audit is created per keyword. Each runs in the background.</p>

            {/* URL */}
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: FONT, marginBottom: 6 }}>URL</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
               <span style={{ position: 'absolute', left: 12, color: '#52525C', display: 'inline-flex', pointerEvents: 'none' }}><BrowserIcon /></span>
               <input
                  value={url} onChange={(e) => setUrl(e.target.value)}
                  onFocus={() => setFocus('url')} onBlur={() => setFocus(null)}
                  placeholder="https://example.com/article.html"
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, padding: '10px 12px 10px 40px', fontSize: 14, fontFamily: FONT, color: '#18181B', outline: 'none', ...fieldBorder('url') }}
               />
            </div>
            <div style={{ paddingTop: 6, fontSize: 13, color: '#71717B', fontFamily: FONT }}>Enter URL of the page you&apos;d like to audit</div>

            {/* Keywords — chip input */}
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: FONT, margin: '16px 0 6px' }}>Keyword(s)</label>
            <div
               onClick={() => (document.getElementById('audit-kw-input') as HTMLInputElement | null)?.focus()}
               style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, borderRadius: 8, padding: '7px 10px', minHeight: 42, cursor: 'text', ...fieldBorder('kw') }}
            >
               <span style={{ color: '#52525C', display: 'inline-flex', flexShrink: 0 }}><KeyIcon /></span>
               {chips.map((c) => (
                  <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F4F4F5', borderRadius: 9999, padding: '3px 6px 3px 10px', fontSize: 13, color: '#18181B', fontFamily: FONT }}>
                     {c}
                     <button type="button" onClick={(e) => { e.stopPropagation(); setChips((x) => x.filter((k) => k !== c)); }} aria-label={`Remove ${c}`} style={{ border: 'none', background: 'transparent', color: '#9F9FA9', cursor: 'pointer', display: 'inline-flex', padding: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                     </button>
                  </span>
               ))}
               <input
                  id="audit-kw-input"
                  value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKwKey}
                  onFocus={() => setFocus('kw')} onBlur={() => { setFocus(null); if (draft.trim()) addChip(draft); }}
                  placeholder={chips.length ? '' : 'e.g. best SEO tool'}
                  style={{ flex: 1, minWidth: 120, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, fontFamily: FONT, color: '#18181B', padding: '2px 0' }}
               />
            </div>
            <div style={{ paddingTop: 6, fontSize: 13, color: '#71717B', fontFamily: FONT }}>
               Press Enter to add a keyword{keywords.length > 0 ? ` — ${keywords.length} audit${keywords.length === 1 ? '' : 's'} will be created` : ''}
            </div>

            {/* Footer: country + create */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 24 }}>
               <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#52525C', fontFamily: FONT }}>
                  <span>Results for</span>
                  <div ref={ctryRef} style={{ position: 'relative' }}>
                     <button
                        type="button" onClick={() => setCtryOpen((o) => !o)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#18181B', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', padding: 0 }}
                     >
                        <span style={{ fontSize: 16 }}>{selected.flag}</span>
                        <span>{selected.name}</span>
                        <span style={{ color: '#9F9FA9', display: 'inline-flex', transform: ctryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}><Chevron /></span>
                     </button>
                     {ctryOpen && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, minWidth: 200, maxHeight: 260, overflow: 'auto', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: 6, zIndex: 10, animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)' }}>
                           {AUDIT_COUNTRIES.map((c) => (
                              <button
                                 key={c.code} type="button" onClick={() => { setCountry(c.code); setCtryOpen(false); }}
                                 style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', borderRadius: 8, padding: '8px 10px', background: c.code === country ? '#F4F4F5' : 'transparent', color: '#18181B', fontSize: 14, fontFamily: FONT, cursor: 'pointer', textAlign: 'left' }}
                                 onMouseEnter={(e) => { if (c.code !== country) e.currentTarget.style.background = '#F8F8F9'; }}
                                 onMouseLeave={(e) => { if (c.code !== country) e.currentTarget.style.background = 'transparent'; }}
                              >
                                 <span style={{ fontSize: 16 }}>{c.flag}</span><span>{c.name}</span>
                              </button>
                           ))}
                        </div>
                     )}
                  </div>
               </div>

               <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <button
                     type="button" onClick={onClose}
                     style={{ border: 'none', background: 'transparent', color: '#71717B', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}
                     onMouseEnter={(e) => { e.currentTarget.style.color = '#3F3F47'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.color = '#71717B'; }}
                  >Cancel</button>
                  <button
                     type="button" disabled={!canSubmit}
                     onClick={() => onCreate(url.trim(), keywords, country)}
                     style={{ border: 'none', background: '#2F2F34', color: '#fff', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5, transition: 'background 150ms ease' }}
                     onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.background = '#783AFB'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
                  >{submitting ? 'Creating…' : 'Create Audit'}</button>
               </div>
            </div>
         </div>
      </div>
   );
};

export default CreateAuditModal;
