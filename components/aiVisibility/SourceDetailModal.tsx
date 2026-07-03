import React, { useEffect } from 'react';
import { SourceRow, splitSourceUrl } from './SourcesTable';
import { AI_VIS_MODEL_LABEL } from '../../lib/aiVisibility';

const FONT = 'var(--font-family-primary)';
const faviconFor = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;

const ArrowUp = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowDown = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ExternalIcon = () => (<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><g fill="currentColor" fillRule="evenodd" clipRule="evenodd"><path d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5z" /><path d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06" /></g></svg>);
const CloseIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', padding: 4, color: '#52525C', cursor: 'pointer', borderRadius: 6 };

/** Detail modal for a source row. When `navigable`, the up/down arrows (and ↑/↓ keys)
 *  page through the surrounding list — SurferSEO's ungrouped-modal behaviour. */
const SourceDetailModal = ({ list, index, navigable, onNavigate, onClose }: {
   list: SourceRow[];
   index: number;
   navigable: boolean;
   onNavigate: (delta: number) => void;
   onClose: () => void;
}) => {
   const s = list[index];

   useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
         if (e.key === 'Escape') onClose();
         if (navigable && e.key === 'ArrowUp') { e.preventDefault(); onNavigate(-1); }
         if (navigable && e.key === 'ArrowDown') { e.preventDefault(); onNavigate(1); }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
   }, [navigable, onNavigate, onClose]);

   if (!s) return null;
   const { host, path } = splitSourceUrl(s.url, s.domain);
   const canUp = navigable && index > 0;
   const canDown = navigable && index < list.length - 1;

   return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(9,9,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} role="presentation">
         <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 720, maxWidth: '100%', maxHeight: 'calc(100vh - 64px)', overflow: 'auto', boxShadow: '0px 24px 64px rgba(0,0,0,0.2)', animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)', fontFamily: FONT }} role="dialog" aria-modal="true">
            {/* Header: nav arrows (left) + external/close (right), then the source URL */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     {navigable ? (
                        <>
                           <button type="button" aria-label="Previous source" disabled={!canUp} onClick={() => onNavigate(-1)} style={{ ...iconBtn, opacity: canUp ? 1 : 0.35, cursor: canUp ? 'pointer' : 'not-allowed' }}><ArrowUp /></button>
                           <button type="button" aria-label="Next source" disabled={!canDown} onClick={() => onNavigate(1)} style={{ ...iconBtn, opacity: canDown ? 1 : 0.35, cursor: canDown ? 'pointer' : 'not-allowed' }}><ArrowDown /></button>
                        </>
                     ) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label="Open source" style={{ ...iconBtn, textDecoration: 'none' }}><ExternalIcon /></a>
                     <button type="button" aria-label="Close" onClick={onClose} style={iconBtn}><CloseIcon /></button>
                  </div>
               </div>
               <h2 style={{ margin: 0, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                     { /* eslint-disable-next-line @next/next/no-img-element */ }
                     <img alt="" src={faviconFor(s.domain)} width={20} height={20} style={{ borderRadius: 4, flexShrink: 0 }} />
                     <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 16 }}>
                        <span style={{ fontWeight: 600, color: '#18181B' }}>{host}</span>
                        <span style={{ fontWeight: 400, color: '#9F9FA9' }}>{path}</span>
                     </span>
                  </span>
               </h2>
            </div>

            {/* Body: real per-source data from the latest scan */}
            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                     <span style={{ fontSize: 13, color: '#71717B' }}>Times shown</span>
                     <span style={{ fontSize: 24, fontWeight: 700, color: '#18181B' }}>{s.timesShown}</span>
                  </div>
                  <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                     <span style={{ fontSize: 13, color: '#71717B' }}>Models</span>
                     <span style={{ fontSize: 24, fontWeight: 700, color: '#18181B' }}>{s.models.length}</span>
                  </div>
               </div>
               <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#18181B', marginBottom: 8 }}>Cited by</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                     {s.models.map((m) => (
                        <span key={m} style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #E4E4E7', borderRadius: 9999, padding: '4px 12px', fontSize: 13, fontWeight: 500, color: '#3F3F47' }}>{AI_VIS_MODEL_LABEL[m] || m}</span>
                     ))}
                  </div>
                  <p style={{ margin: '12px 0 0', fontSize: 13, color: '#9F9FA9', lineHeight: 1.5 }}>Engines that cited this page for your tracked prompts in the latest scan.</p>
               </div>
            </div>
         </div>
      </div>
   );
};

export default SourceDetailModal;
