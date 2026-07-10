import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../core';
import DomainFavicon from '../common/DomainFavicon';

const FONT = 'var(--font-family-primary)';
type Card = { domain: string; gap: number; shared: number; you: number };

/** Two overlapping circles: competitor (orange, ∝ gap+shared), you (violet, ∝ shared+you),
 *  with the shared intersection painted red (your circle clipped to the competitor's). */
const Bubble = ({ card }: { card: Card }) => {
   const compR = 37;
   const compTotal = Math.max(1, card.gap + card.shared);
   const yourTotal = card.shared + card.you;
   const yourR = Math.max(3, Math.min(compR, Math.round((compR * Math.sqrt(Math.max(1, yourTotal))) / Math.sqrt(compTotal))));
   const cx1 = compR;
   const cx2 = 2 * compR - 2; // small partner sits on the right rim
   const w = cx2 + yourR + 2;
   const clipId = `gapclip-${card.domain.replace(/[^a-z0-9]/gi, '')}`;
   return (
      <svg width={w} height={74} style={{ overflow: 'visible', flexShrink: 0 }} aria-hidden>
         <defs><clipPath id={clipId}><circle cx={cx1} cy={37} r={compR} /></clipPath></defs>
         <circle cx={cx1} cy={37} r={compR} fill="#F97316" fillOpacity={0.7} />
         <circle cx={cx2} cy={37} r={yourR} fill="#783AFB" fillOpacity={0.75} />
         {card.shared > 0 ? <circle cx={cx2} cy={37} r={yourR} fill="#FF6F77" clipPath={`url(#${clipId})`} /> : null}
      </svg>
   );
};

const ChevronDown = () => (<svg viewBox="0 0 20 20" width="16" height="16"><path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" /></svg>);
const XIcon = () => (<svg viewBox="0 0 20 20" width="16" height="16"><path fill="currentColor" d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94z" /></svg>);
const PlusIcon = () => (<svg viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>);

const LegendRow = ({ n, label, color }: { n: number; label: string; color: string }) => (
   <>
      <div style={{ textAlign: 'right', fontWeight: 600, color: '#18181B', fontSize: 14 }}>{n}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#18181B' }}>{label}<span style={{ width: 8, height: 8, borderRadius: 9999, background: color }} /></div>
   </>
);

const PICKER_W = 300;
// Rendered in a portal because the cards row is `overflow-x: auto`, which would clip
// an in-flow absolutely-positioned dropdown. Fixed-positioned to the trigger's rect.
const Picker = ({ rect, candidates, exclude, onPick, onClose }: { rect: DOMRect | null; candidates: string[]; exclude: string[]; onPick: (b: string) => void; onClose: () => void }) => {
   const [q, setQ] = useState('');
   if (!rect || typeof document === 'undefined') return null;
   const list = candidates.filter((c) => !exclude.includes(c) && c.toLowerCase().includes(q.trim().toLowerCase()));
   const left = Math.max(8, Math.min(rect.left, window.innerWidth - PICKER_W - 8));
   const top = rect.bottom + 6;
   return createPortal(
      <>
         { /* click-away backdrop so typing in the search never dismisses the picker */ }
         <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400 }} role="presentation" />
         <div style={{ position: 'fixed', top, left, width: PICKER_W, background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 401, fontFamily: FONT, animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <style>{'.aiv-gap-scroll{scrollbar-width:thin;scrollbar-color:#D4D4D8 transparent}.aiv-gap-scroll::-webkit-scrollbar{width:8px;background:transparent}.aiv-gap-scroll::-webkit-scrollbar-track{background:transparent}.aiv-gap-scroll::-webkit-scrollbar-thumb{background:#D4D4D8;border-radius:9999px}'}</style>
            <input
               autoFocus
               value={q}
               onChange={(e) => setQ(e.target.value)}
               onClick={(e) => e.stopPropagation()}
               placeholder="Search"
               style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #D4D4D8', borderRadius: 8, padding: '8px 10px', fontSize: 14, fontFamily: FONT, color: '#18181B', marginBottom: 8, outline: 'none', transition: 'border-color 150ms ease, box-shadow 150ms ease' }}
               onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(120,58,251,0.1)'; }}
               onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            <div className="aiv-gap-scroll" style={{ maxHeight: 260, overflow: 'auto', background: 'transparent' }}>
               {list.map((c) => (
                  <Button key={c} type="button" variant="transparent" size="sm" onClick={(e) => { e.stopPropagation(); onPick(c); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'flex-start', textAlign: 'left', fontFamily: FONT, borderRadius: 8, padding: '8px 10px' }}>
                     <DomainFavicon domain={c} size={16} />
                     <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</span>
                  </Button>
               ))}
               {list.length === 0 ? <div style={{ padding: '10px 10px', fontSize: 13, color: '#9F9FA9' }}>No matches.</div> : null}
            </div>
         </div>
      </>,
      document.body,
   );
};

const MentionGapCards = ({ cards, candidates, ownLabel, selected, onSelected, activeDomain, onCompare }: { cards: Card[]; candidates: string[]; ownLabel: string; selected: string[]; onSelected: (b: string[]) => void; activeDomain?: string | null; onCompare?: (domain: string) => void }) => {
   const [addOpen, setAddOpen] = useState(false);
   const [swapFor, setSwapFor] = useState<string | null>(null);
   const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);
   if (!candidates.length) return null;
   const stop = (e: React.MouseEvent) => e.stopPropagation();
   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
         <div style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>Mention Gap</div>
         <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {cards.map((card) => (
               <div
                  key={card.domain}
                  onClick={() => onCompare && onCompare(card.domain)}
                  role={onCompare ? 'button' : undefined}
                  tabIndex={onCompare ? 0 : undefined}
                  onKeyDown={(e) => { if (!onCompare || e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCompare(card.domain); } }}
                  style={{ position: 'relative', width: 300, flexShrink: 0, border: `1px solid ${activeDomain === card.domain ? '#783AFB' : '#DAD9DE'}`, boxShadow: activeDomain === card.domain ? '0 0 0 3px rgba(120,58,251,0.1)' : '0 4px 0 0 #e4e4e7', borderRadius: 12, background: '#fff', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, cursor: onCompare ? 'pointer' : 'default', transition: 'border-color 120ms ease, box-shadow 120ms ease' }}
               >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <div style={{ position: 'relative', minWidth: 0 }}>
                        <Button type="button" variant="transparent" size="sm" onClick={(e) => { stop(e); const r = e.currentTarget.getBoundingClientRect(); setPickerRect(r); setSwapFor((s) => (s === card.domain ? null : card.domain)); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, fontWeight: 600, fontFamily: FONT, maxWidth: 220 }}>
                           <DomainFavicon domain={card.domain} size={16} />
                           <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.domain}</span> <ChevronDown /></Button>
                        {swapFor === card.domain ? <Picker rect={pickerRect} candidates={candidates} exclude={selected} onPick={(b) => { onSelected(selected.map((x) => (x === card.domain ? b : x))); setSwapFor(null); }} onClose={() => setSwapFor(null)} /> : null}
                     </div>
                     <Button type="button" variant="transparent" size="sm" aria-label="Remove" onClick={(e) => { stop(e); onSelected(selected.filter((x) => x !== card.domain)); }} icon={<XIcon />} style={{ flexShrink: 0, color: '#9F9FA9' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                     <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px' }}>
                        <LegendRow n={card.gap} label="Gap" color="#F97316" />
                        <LegendRow n={card.shared} label="Shared" color="#FF6F77" />
                        <LegendRow n={card.you} label={ownLabel} color="#783AFB" />
                     </div>
                     <Bubble card={card} />
                  </div>
               </div>
            ))}
            <div style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
               <Button type="button" variant="secondary" size="sm" aria-label="Add brand" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPickerRect(r); setAddOpen((o) => !o); }} icon={<PlusIcon />} style={{ width: 56, height: '100%', color: '#71717B' }} />
               {addOpen ? <Picker rect={pickerRect} candidates={candidates} exclude={selected} onPick={(b) => { onSelected([...selected, b]); setAddOpen(false); }} onClose={() => setAddOpen(false)} /> : null}
            </div>
         </div>
      </div>
   );
};

export default MentionGapCards;
