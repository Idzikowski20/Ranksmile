import React, { useEffect, useRef, useState } from 'react';
import { Gauge } from '../ui';
import { AuditCardDTO } from '../../lib/auditTypes';

const FONT = 'var(--font-family-primary)';

// SERP language → country label shown on the card (mirrors the article card's locale line).
const LANG_COUNTRY: Record<string, string> = {
   pl: 'Poland', en: 'United States', de: 'Germany', fr: 'France',
   es: 'Spain', it: 'Italy', nl: 'Netherlands', pt: 'Portugal',
};

const timeAgo = (dateStr: string): string => {
   const diffMs = Date.now() - new Date(dateStr).getTime();
   const mins = Math.floor(diffMs / 60000);
   const hrs = Math.floor(diffMs / 3600000);
   const days = Math.floor(diffMs / 86400000);
   if (mins < 1) return 'just now';
   if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
   if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
   return `${days} day${days !== 1 ? 's' : ''} ago`;
};

const DotsIcon = () => (
   <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

/** One audit row — 1:1 with the content-editor article card: score gauge, keyword title +
 *  URL subtitle, status check, avatar, triple-dot menu, Unassigned/Tag chips, and a
 *  country + timestamp footer. Queued/running renders the "Analyzing content…" variant. */
const AuditCard = ({ item, onOpen, onDelete }: { item: AuditCardDTO; onOpen: (id: number) => void; onDelete?: (id: number) => void }) => {
   const busy = item.status === 'running' || item.status === 'queued';
   const done = item.status === 'completed';
   const failed = item.status === 'failed';

   const [menuOpen, setMenuOpen] = useState(false);
   const [mounted, setMounted] = useState(false);
   const menuRef = useRef<HTMLDivElement>(null);
   useEffect(() => { setMounted(true); }, []);
   useEffect(() => {
      if (!menuOpen) return undefined;
      const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
      document.addEventListener('mousedown', h);
      return () => document.removeEventListener('mousedown', h);
   }, [menuOpen]);

   const country = item.language ? LANG_COUNTRY[item.language.toLowerCase()] : null;
   const when = mounted ? timeAgo(item.finishedAt || item.createdAt || new Date().toISOString()) : '';

   const shareLink = () => {
      try {
         const href = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}/${item.id}`;
         navigator.clipboard?.writeText(href);
      } catch { /* clipboard unavailable */ }
      setMenuOpen(false);
   };
   const del = () => { setMenuOpen(false); onDelete?.(item.id); };

   // ── Analyzing / queued: simplified row with a spinner ──
   if (busy) {
      return (
         <div style={{ height: 133, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #E4E4E7', borderRadius: 12, paddingRight: 24, gap: 12, userSelect: 'none', opacity: 0.7, fontFamily: FONT }}>
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', paddingLeft: 24, paddingRight: 12, width: 84, flexShrink: 0 }}>
               <div style={{ width: 24, height: 24, border: '2.5px solid #E4E4E7', borderTopColor: '#783AFB', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
               <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, color: '#3F3F47', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.keyword}</span>
               <span style={{ fontSize: 13, lineHeight: '16px', color: '#9F9FA9' }}>{item.status === 'running' ? 'Analyzing content…' : 'Queued…'}</span>
            </div>
         </div>
      );
   }

   return (
      <div
         className="article-list-item"
         style={{ height: 133, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #E4E4E7', borderRadius: 12, paddingRight: 24, gap: 12, userSelect: 'none', cursor: done ? 'pointer' : 'default', transition: 'box-shadow 0.2s, border-color 0.2s', fontFamily: FONT }}
         onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0px 4px 4px 0px rgba(24,26,34,0.02), 0px 1px 2px 0px rgba(24,26,34,0.08), 0px -1px 1px 0px rgba(0,0,0,0.02)'; }}
         onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      >
         {/* Left: score gauge */}
         <div
            style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'space-between', borderRight: '1px solid transparent', paddingLeft: 24, paddingRight: 12, transition: 'border-color 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderRightColor = '#F4F4F5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderRightColor = 'transparent'; }}
         >
            <div style={{ width: 48 }}><Gauge score={item.contentScore ?? 0} size="sm" /></div>
         </div>

         {/* Main content */}
         <div style={{ position: 'relative', display: 'flex', height: '100%', flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Click surface → detail (completed only) */}
            {done && <button type="button" aria-label={`Open audit ${item.keyword}`} onClick={() => onOpen(item.id)} style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} />}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minWidth: 0 }}>
               {/* Top row: title + meta */}
               <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                     <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, maxWidth: 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#2F2F34' }}>{item.keyword}</span>
                     <span style={{ fontSize: 14, lineHeight: '20px', maxWidth: 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: failed ? '#DC2626' : '#3F3F47' }}>{failed ? 'Audit failed' : item.url}</span>
                  </div>

                  {/* Right meta: status check, avatar, menu */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 1, flexShrink: 0 }}>
                     {done && (
                        <span style={{ display: 'inline-flex', color: '#16a34a' }} title="Done">
                           <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12m13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094z" clipRule="evenodd" /></svg>
                        </span>
                     )}
                     <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#F4F4F5', color: '#09090B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', flexShrink: 0 }}>b</div>

                     <div style={{ position: 'relative' }} ref={menuRef}>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen((o) => !o); }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#3F3F47', padding: 0, transition: 'opacity 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
                           <DotsIcon />
                        </button>
                        {menuOpen && (
                           <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 100, display: 'flex', flexDirection: 'column', padding: 6, borderRadius: 8, background: '#fff', boxShadow: '0px 8px 16px 0px rgba(24,26,34,0.06), 0px 2px 8px 0px rgba(24,26,34,0.03), 0px 1px 2px 0px rgba(24,26,34,0.06)', border: '1px solid #F4F4F5', minWidth: 200, animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)', transformOrigin: '100% 0' }} onClick={(e) => e.stopPropagation()}>
                              <div role="button" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, fontSize: 14, fontWeight: 500, color: '#2F2F34', cursor: 'pointer', transition: 'background 0.12s' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F8F8F9'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }} onClick={shareLink}>
                                 <svg viewBox="0 0 24 24" width="20" height="20" style={{ flexShrink: 0 }}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186m0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185" /></svg>
                                 Get shareable link
                              </div>
                              {onDelete && (
                                 <>
                                    <div style={{ height: 1, background: '#F4F4F5', margin: '4px -6px' }} />
                                    <div role="button" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, fontSize: 14, fontWeight: 500, color: '#EF4444', cursor: 'pointer', transition: 'background 0.12s' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }} onClick={del}>
                                       <svg viewBox="0 0 24 24" width="20" height="20" style={{ flexShrink: 0 }}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21q.512.078 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48 48 0 0 0-3.478-.397m-12 .562q.51-.088 1.022-.165m0 0a48 48 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a52 52 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a49 49 0 0 0-7.5 0" /></svg>
                                       Delete
                                    </div>
                                 </>
                              )}
                           </div>
                        )}
                     </div>
                  </div>
               </div>

               {/* Bottom row: tags + country + timestamp */}
               <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24, zIndex: 1 }}>
                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 12px', borderRadius: 24, background: '#F8F8F9', border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: '16px', color: '#3F3F47', fontFamily: FONT, whiteSpace: 'nowrap' }}>
                        <svg viewBox="0 0 24 24" width="20" height="20" style={{ flexShrink: 0 }}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.75 9.776q.168-.026.344-.026h15.812q.176 0 .344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" /></svg>
                        <span>Unassigned</span>
                     </button>
                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: '16px', fontWeight: 600, color: '#3F3F47', fontFamily: FONT }}>
                        <svg viewBox="0 0 20 20" width="16" height="16"><path fill="currentColor" d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5z" /></svg>
                        <span>Tag</span>
                     </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, zIndex: 1 }}>
                     {country && (
                        <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, lineHeight: '16px', color: '#3F3F47', gap: 2 }}>
                           <svg viewBox="0 0 24 24" width="16" height="16" style={{ flexShrink: 0 }}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" /></svg>
                           <span>{country}</span>
                        </div>
                     )}
                     <div style={{ fontSize: 13, lineHeight: '16px', color: '#3F3F47', whiteSpace: 'nowrap' }} suppressHydrationWarning>{when}</div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

export default AuditCard;
