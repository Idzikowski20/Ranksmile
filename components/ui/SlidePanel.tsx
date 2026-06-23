import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { XIcon } from './icons';

// ── Inlined helpers from recommendations.tsx ──────────────────────────────────

function compactNum(n: number): string {
   if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
   if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
   return String(Math.round(n));
}

function timeAgo(date: string | null | undefined): string {
   if (!date) return 'recently';
   try {
      const ms = Date.now() - new Date(date).getTime();
      const mins = Math.floor(ms / 60000);
      if (mins < 2) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}d ago`;
      return `${Math.floor(days / 30)}mo ago`;
   } catch { return 'recently'; }
}

function gaugePoint(score: number): { x: number; y: number } {
   const theta = (1 - score / 100) * Math.PI;
   return {
      x: 150 + 120 * Math.cos(theta),
      y: 150 - 120 * Math.sin(theta),
   };
}

function gaugeArcD(score: number): string {
   const p = gaugePoint(score);
   const largeArc = score > 50 ? 1 : 0;
   return `M ${p.x.toFixed(3)} ${p.y.toFixed(3)} A 120 120 0 ${largeArc} 0 30 150`;
}

const gaugeColor = (s: number) => (s >= 70 ? '#16a34a' : s >= 40 ? '#d97706' : '#dc2626');

const ExternalLinkIcon = () => (
   <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" style={{ flexShrink: 0 }}>
      <g fillRule="evenodd" clipRule="evenodd">
         <path d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5z" />
         <path d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06" />
      </g>
   </svg>
);

// ── Types ─────────────────────────────────────────────────────────────────────

type RecommRow = {
   id: number | string;
   title: string;
   url: string;
   keyword: string;
   content_score: number;
   position: number;
   clicks: number;
   impressions: number;
   status: string;
   source?: string;
   meta_title?: string | null;
   word_count?: number;
   updatedAt?: string | null;
};

// ── Slide panel ───────────────────────────────────────────────────────────────
// Source: pages/sites/[domain]/recommendations.tsx lines 477–686

function SlidePanel({ row, onClose, onRefresh, onChangeKeyword, analyzing }: {
   row: RecommRow | null;
   onClose: () => void;
   onRefresh?: (row: RecommRow, e: React.MouseEvent) => void;
   onChangeKeyword?: (row: RecommRow) => void;
   analyzing?: boolean;
}) {
   const router = useRouter();
   const [visible, setVisible] = useState(false);
   const [ready, setReady] = useState(false);
   const [animScore, setAnimScore] = useState(0);
   const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

   useEffect(() => {
      if (row) {
         setAnimScore(0);
         setReady(false);
         const t = setTimeout(() => setVisible(true), 10);
         return () => clearTimeout(t);
      }
      setVisible(false);
      setReady(false);
      setAnimScore(0);
      return undefined;
   }, [row]);

   // Animate gauge after the panel slide-in (starts ~120ms after visible)
   useEffect(() => {
      if (!visible || !row) return;
      const target = row.content_score || 0;
      const startDelay = setTimeout(() => {
         setReady(true);
         if (target <= 0) { setAnimScore(0); return; }
         const steps = target;
         const duration = Math.max(600, steps * 20);
         const intervalMs = duration / steps;
         let step = 0;
         timerRef.current = setInterval(() => {
            step += 1;
            if (step >= steps) {
               setAnimScore(target);
               if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
               return;
            }
            const eased = 1 - Math.pow(1 - step / steps, 2.5);
            setAnimScore(Math.round(target * eased));
         }, intervalMs);
      }, 140);
      return () => {
         clearTimeout(startDelay);
         if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      };
   }, [visible, row]);

   const handleClose = () => { setVisible(false); setTimeout(onClose, 220); };
   if (!row) return null;

   const targetScore = row.content_score || 0;
   const color = gaugeColor(animScore);

   return (
      <>
         <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.12)', opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }} />
         <div style={{ position: 'fixed', top: 8, bottom: 8, right: 8, width: 400, zIndex: 301, background: '#fff', borderRadius: 14, boxShadow: '0px 24px 64px rgba(0,0,0,0.16), 0px 8px 24px rgba(0,0,0,0.08)', border: '1px solid #E4E4E7', display: 'flex', flexDirection: 'column', overflow: 'hidden', transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 16px))', transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)' }}>

            {/* Header: "Page" label + actions + close */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid #F4F4F5', gap: 6 }}>
               <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#71717B', fontFamily: 'var(--font-family-primary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Page</span>
               {/* Three dots */}
               <button type="button" style={{ display: 'inline-flex', padding: 6, borderRadius: 7, border: '1px solid #E4E4E7', background: '#fff', color: '#52525C', cursor: 'pointer' }}>
                  <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
                     <path d="M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0M8.5 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0M15.5 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3" />
                  </svg>
               </button>
               {/* External link */}
               {row.url && (
                  <a href={row.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', padding: 6, borderRadius: 7, border: '1px solid #E4E4E7', background: '#fff', color: '#52525C', textDecoration: 'none' }}>
                     <ExternalLinkIcon />
                  </a>
               )}
               {/* Close */}
               <button type="button" onClick={handleClose} style={{ display: 'inline-flex', padding: 6, borderRadius: 7, border: '1px solid #E4E4E7', background: '#fff', color: '#52525C', cursor: 'pointer' }}>
                  <XIcon />
               </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 24px' }}>

               {/* Title + keyword — fade in first */}
               <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(6px)', transition: 'opacity 200ms ease 60ms, transform 200ms ease 60ms' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#09090B', fontFamily: 'var(--font-family-primary)', lineHeight: '21px' }}>{row.title}</p>

                  {/* Main keyword — clickable chip */}
                  <button
                     type="button"
                     onClick={() => onChangeKeyword?.(row)}
                     style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 20, padding: '4px 10px 4px 8px', borderRadius: 9999, border: '1px solid #E4E4E7', background: '#F8F8F9', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', maxWidth: '100%', transition: 'border-color 150ms, background 150ms' }}
                     onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; e.currentTarget.style.background = 'rgba(120,58,251,0.04)'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.background = '#F8F8F9'; }}
                  >
                     <svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor" style={{ color: '#783AFB', flexShrink: 0 }}>
                        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11M1.5 9a7.5 7.5 0 1 1 13 5.132l3.684 3.684a.75.75 0 1 1-1.06 1.06l-3.683-3.683A7.5 7.5 0 0 1 1.5 9" clipRule="evenodd" />
                     </svg>
                     <span style={{ fontSize: 12, fontWeight: 600, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.keyword || 'Set keyword'}
                     </span>
                     <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" style={{ color: '#9F9FA9', flexShrink: 0 }}>
                        <path fillRule="evenodd" d="M11.013 2.513a1.75 1.75 0 0 1 2.475 2.474L6.226 12.25a2.751 2.751 0 0 1-.892.596l-2.047.848a.75.75 0 0 1-.98-.98l.848-2.047a2.75 2.75 0 0 1 .596-.892zm1.414 1.06a.25.25 0 0 0-.354 0L3.82 10.835a1.25 1.25 0 0 0-.271.405l-.514 1.241 1.241-.514a1.25 1.25 0 0 0 .405-.271zm-5.927 11.427" clipRule="evenodd" />
                     </svg>
                  </button>
               </div>

               {/* Content Score section — fades in slightly after */}
               <div style={{ marginBottom: 16, opacity: ready ? 1 : 0, transform: ready ? 'none' : 'translateY(8px)', transition: 'opacity 240ms ease, transform 240ms ease' }}>
                  {/* Label row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                     <span style={{ fontSize: 11, fontWeight: 700, color: '#3F3F47', fontFamily: 'var(--font-family-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Content Score</span>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
                           Updated {timeAgo(row.updatedAt)}
                        </span>
                        {onRefresh && (
                           <button
                              type="button"
                              onClick={(e) => onRefresh(row, e)}
                              disabled={analyzing}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', color: analyzing ? '#9F9FA9' : '#52525C', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-family-primary)', cursor: analyzing ? 'default' : 'pointer' }}
                           >
                              <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: analyzing ? 'spin 0.7s linear infinite' : 'none' }}>
                                 <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6A6 6 0 1 0 14 9M14 5v3h-3" />
                              </svg>
                              {analyzing ? 'Analyzing…' : 'Refresh'}
                           </button>
                        )}
                     </div>
                  </div>

                  {/* Animated gauge */}
                  <div style={{ position: 'relative', width: 210, margin: '0 auto 0' }}>
                     <svg viewBox="10 10 280 160" style={{ width: '100%', height: 'auto', display: 'block' }}>
                        {/* Track */}
                        <path fill="transparent" stroke="#F0F0F3" strokeWidth="30" strokeLinecap="round" d="M 270 150 A 120 120 0 0 0 30 150" />
                        {/* Animated colored arc */}
                        {animScore > 0 && (
                           <path
                              fill="transparent"
                              stroke={color}
                              strokeWidth="30"
                              strokeLinecap="round"
                              d={gaugeArcD(animScore)}
                              style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
                           />
                        )}
                     </svg>
                     {/* Score number overlay */}
                     <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none', lineHeight: 1 }}>
                        <span style={{ fontSize: 42, fontWeight: 800, color: '#09090B', fontFamily: 'var(--font-family-primary)', letterSpacing: '-0.02em' }}>{animScore}</span>
                        <span style={{ fontSize: 15, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)', marginLeft: 2, fontWeight: 400 }}>/100</span>
                     </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px 14px', marginTop: 2 }}>
                     <span style={{ fontSize: 10, color: '#D4D4D8', fontFamily: 'var(--font-family-primary)' }}>0</span>
                     <span style={{ fontSize: 10, color: color, fontFamily: 'var(--font-family-primary)', fontWeight: 600, transition: 'color 200ms' }}>
                        {targetScore > 0 ? (targetScore >= 70 ? 'Good' : targetScore >= 40 ? 'Fair' : 'Poor') : ''}
                     </span>
                     <span style={{ fontSize: 10, color: '#D4D4D8', fontFamily: 'var(--font-family-primary)' }}>100</span>
                  </div>

                  {/* Optimize button */}
                  <button
                     type="button"
                     onClick={() => router.push(`/articles/${row.id}`)}
                     style={{ display: 'block', width: '100%', padding: '11px 16px', background: '#2F2F34', color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-family-primary)', border: 'none', cursor: 'pointer', transition: 'background 180ms ease, transform 100ms ease', letterSpacing: '0.01em' }}
                     onMouseEnter={(e) => { e.currentTarget.style.background = '#783AFB'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; e.currentTarget.style.transform = 'none'; }}
                  >
                     Optimize
                  </button>
               </div>

               {/* Divider */}
               <div style={{ height: 1, background: '#F4F4F5', margin: '4px 0 14px', opacity: ready ? 1 : 0, transition: 'opacity 300ms ease 80ms' }} />

               {/* Stats — staggered reveal */}
               {[
                  { label: 'Main keyword position', value: row.position > 0 ? row.position.toFixed(1) : '—', delay: 100 },
                  { label: 'Clicks', value: row.clicks > 0 ? compactNum(row.clicks) : '0', delay: 140 },
                  { label: 'Impressions', value: row.impressions > 0 ? compactNum(row.impressions) : '—', delay: 180 },
               ].map((stat, idx, arr) => (
                  <div
                     key={stat.label}
                     style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 0',
                        borderBottom: idx < arr.length - 1 ? '1px solid #F4F4F5' : 'none',
                        opacity: ready ? 1 : 0,
                        transform: ready ? 'none' : 'translateX(6px)',
                        transition: `opacity 220ms ease ${stat.delay}ms, transform 220ms ease ${stat.delay}ms`,
                     }}
                  >
                     <span style={{ fontSize: 13, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>{stat.label}</span>
                     <span style={{ fontSize: 14, fontWeight: 700, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>{stat.value}</span>
                  </div>
               ))}
            </div>
         </div>
      </>
   );
}

export default SlidePanel;
