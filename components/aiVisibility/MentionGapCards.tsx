import React, { useState } from 'react';

const FONT = 'var(--font-family-primary)';
type Card = { brand: string; gap: number; shared: number; you: number };

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
   const clipId = `gapclip-${card.brand.replace(/[^a-z0-9]/gi, '')}`;
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

const Picker = ({ candidates, exclude, onPick, onClose }: { candidates: string[]; exclude: string[]; onPick: (b: string) => void; onClose: () => void }) => (
   <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 220, maxHeight: 260, overflow: 'auto', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 150, fontFamily: FONT, animation: 'growOut 0.2s ease' }} onMouseLeave={onClose}>
      {candidates.filter((c) => !exclude.includes(c)).map((c) => (
         <button key={c} type="button" onClick={() => onPick(c)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', fontSize: 14, color: '#18181B', cursor: 'pointer', fontFamily: FONT }}>{c}</button>
      ))}
      {candidates.filter((c) => !exclude.includes(c)).length === 0 ? <div style={{ padding: '8px 10px', fontSize: 13, color: '#9F9FA9' }}>No more brands.</div> : null}
   </div>
);

const MentionGapCards = ({ cards, candidates, ownLabel, selected, onSelected }: { cards: Card[]; candidates: string[]; ownLabel: string; selected: string[]; onSelected: (b: string[]) => void }) => {
   const [addOpen, setAddOpen] = useState(false);
   const [swapFor, setSwapFor] = useState<string | null>(null);
   if (!candidates.length) return null;
   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
         <div style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>Mention Gap</div>
         <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {cards.map((card) => (
               <div key={card.brand} style={{ position: 'relative', width: 300, flexShrink: 0, border: '1px solid #F4F4F5', borderRadius: 12, background: '#fff', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <div style={{ position: 'relative' }}>
                        <button type="button" onClick={() => setSwapFor((s) => (s === card.brand ? null : card.brand))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT, maxWidth: 220 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.brand}</span> <ChevronDown /></button>
                        {swapFor === card.brand ? <Picker candidates={candidates} exclude={selected} onPick={(b) => { onSelected(selected.map((x) => (x === card.brand ? b : x))); setSwapFor(null); }} onClose={() => setSwapFor(null)} /> : null}
                     </div>
                     <button type="button" aria-label="Remove" onClick={() => onSelected(selected.filter((x) => x !== card.brand))} style={{ border: 'none', background: 'transparent', color: '#9F9FA9', cursor: 'pointer', display: 'inline-flex' }}><XIcon /></button>
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
            <div style={{ position: 'relative', flexShrink: 0 }}>
               <button type="button" aria-label="Add brand" onClick={() => setAddOpen((o) => !o)} style={{ width: 56, height: 144, border: '1px solid #F4F4F5', borderRadius: 12, background: 'transparent', color: '#71717B', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><PlusIcon /></button>
               {addOpen ? <Picker candidates={candidates} exclude={selected} onPick={(b) => { onSelected([...selected, b]); setAddOpen(false); }} onClose={() => setAddOpen(false)} /> : null}
            </div>
         </div>
      </div>
   );
};

export default MentionGapCards;
