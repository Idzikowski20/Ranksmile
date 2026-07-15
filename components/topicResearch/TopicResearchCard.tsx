import React, { useEffect, useRef, useState } from 'react';
import { AUDIT_COUNTRIES } from '../../lib/countryLang';
import type { TopicResearchCardDTO } from '../../lib/topicResearchTypes';
import CountryFlag from '../audit/CountryFlag';

const FONT = 'var(--font-family-primary)';

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

const fmtVol = (v: number | null): string => {
   if (v == null) return '—';
   if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
   if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
   return v.toLocaleString();
};

const DotsIcon = () => (
   <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

const TopicResearchCard = ({ item, onOpen, onDelete }: { item: TopicResearchCardDTO; onOpen: (id: number) => void; onDelete?: (id: number) => void }) => {
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

   const countryMeta = AUDIT_COUNTRIES.find((c) => c.code === (item.country || '').toUpperCase());
   const when = mounted ? timeAgo(item.finishedAt || item.createdAt || new Date().toISOString()) : '';

   const shareLink = () => {
      try {
         const href = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}/${item.id}`;
         navigator.clipboard?.writeText(href);
      } catch { /* clipboard unavailable */ }
      setMenuOpen(false);
   };
   const del = () => { setMenuOpen(false); onDelete?.(item.id); };

   if (busy) {
      return (
         <div style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #E4E4E7', borderRadius: 12, padding: '0 24px', gap: 12, userSelect: 'none', opacity: 0.7, fontFamily: FONT }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
               <div style={{ width: 24, height: 24, border: '2.5px solid #E4E4E7', borderTopColor: '#F29964', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
               <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, color: '#3F3F47', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.seed}</span>
                  <span style={{ fontSize: 13, lineHeight: '16px', color: '#9F9FA9' }}>{item.status === 'running' ? 'Researching topics…' : 'Queued…'}</span>
               </div>
            </div>
         </div>
      );
   }

   return (
      <div
         style={{
            height: 96, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            border: '1px solid #E4E4E7', borderRadius: 12, padding: '0 24px', gap: 16,
            userSelect: 'none', cursor: done ? 'pointer' : 'default',
            transition: 'box-shadow 150ms ease, border-color 150ms ease', fontFamily: FONT,
         }}
         onClick={() => { if (done) onOpen(item.id); }}
         onMouseEnter={(e) => { if (done) e.currentTarget.style.boxShadow = '0px 4px 4px 0px rgba(24,26,34,0.02), 0px 1px 2px 0px rgba(24,26,34,0.08)'; }}
         onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      >
         <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, color: failed ? '#DC2626' : '#2F2F34', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
               {failed ? 'Research failed' : item.seed}
            </span>
            <span style={{ fontSize: 13, lineHeight: '16px', color: '#71717B' }}>
               {done && item.totalIdeas != null ? `${item.totalIdeas} ideas · ${fmtVol(item.searchVolume)} vol` : failed ? 'Try again with a different seed' : '—'}
            </span>
         </div>

         <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {countryMeta && (
               <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#52525C' }}>
                  <CountryFlag code={countryMeta.code} />
                  <span>{countryMeta.name}</span>
               </div>
            )}
            <div style={{ fontSize: 13, color: '#71717B', whiteSpace: 'nowrap' }} suppressHydrationWarning>{when}</div>

            <div style={{ position: 'relative' }} ref={menuRef} onClick={(e) => e.stopPropagation()}>
               <button type="button" onClick={() => setMenuOpen((o) => !o)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#3F3F47', padding: 0 }}>
                  <DotsIcon />
               </button>
               {menuOpen && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 100, display: 'flex', flexDirection: 'column', padding: 6, borderRadius: 8, background: '#fff', boxShadow: '0px 8px 16px 0px rgba(24,26,34,0.06)', border: '1px solid #F4F4F5', minWidth: 180, animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
                     <div role="button" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, fontSize: 14, fontWeight: 500, color: '#2F2F34', cursor: 'pointer' }} onClick={shareLink}>
                        Get shareable link
                     </div>
                     {onDelete && (
                        <>
                           <div style={{ height: 1, background: '#F4F4F5', margin: '4px -6px' }} />
                           <div role="button" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, fontSize: 14, fontWeight: 500, color: '#EF4444', cursor: 'pointer' }} onClick={del}>
                              Delete
                           </div>
                        </>
                     )}
                  </div>
               )}
            </div>
         </div>
      </div>
   );
};

export default TopicResearchCard;
