import React, { useMemo, useState } from 'react';
import type { FanoutByQueryRow, FanoutByPromptRow } from '../../services/aiVisibility';

const FONT = 'var(--font-family-primary)';

// ── Per-engine model icons (mirror AiVisibilityToolbar, keyed on the display label). ─
const Starburst = () => (<svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M32 16.032C27.8484 16.2868 23.9332 18.0509 20.9921 20.9921C18.0509 23.9332 16.2868 27.8484 16.032 32H15.968C15.7136 27.8482 13.9497 23.9328 11.0084 20.9916C8.06716 18.0503 4.15176 16.2864 0 16.032L0 15.968C4.15176 15.7136 8.06716 13.9497 11.0084 11.0084C13.9497 8.06716 15.7136 4.15176 15.968 0L16.032 0C16.2868 4.15162 18.0509 8.06677 20.9921 11.0079C23.9332 13.9491 27.8484 15.7132 32 15.968V16.032Z" fill="currentColor" /></svg>);
const GoogleG = () => (<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M15.6823 8.18368C15.6823 7.63986 15.6382 7.0931 15.5442 6.55811H7.99829V9.63876H12.3194C12.1401 10.6323 11.564 11.5113 10.7203 12.0698V14.0687H13.2983C14.8122 12.6753 15.6823 10.6176 15.6823 8.18368Z" fill="currentColor" /><path d="M7.99812 16C10.1558 16 11.9753 15.2915 13.3011 14.0687L10.7231 12.0698C10.0058 12.5578 9.07988 12.8341 8.00106 12.8341C5.91398 12.8341 4.14436 11.426 3.50942 9.53296H0.849121V11.5936C2.2072 14.295 4.97332 16 7.99812 16Z" fill="currentColor" /><path d="M3.50665 9.53295C3.17154 8.53938 3.17154 7.4635 3.50665 6.46993V4.4093H0.849292C-0.285376 6.66982 -0.285376 9.33306 0.849292 11.5936L3.50665 9.53295Z" fill="currentColor" /><path d="M7.99812 3.16589C9.13867 3.14825 10.241 3.57743 11.067 4.36523L13.3511 2.0812C11.9048 0.723121 9.98526 -0.0235266 7.99812 -1.02057e-05C4.97332 -1.02057e-05 2.2072 1.70493 0.849121 4.40932L3.50648 6.46995C4.13848 4.57394 5.91104 3.16589 7.99812 3.16589Z" fill="currentColor" /></svg>);
const ChatGptIcon = () => (<svg width="16" height="16" viewBox="0 0 19 18" fill="none" aria-hidden="true"><path d="M18.1007 8.5592C18.2985 8.99438 18.4241 9.45956 18.4754 9.93413C18.5249 10.4087 18.5001 10.8889 18.3974 11.356C18.2966 11.823 18.1217 12.2713 17.8782 12.684C17.7185 12.9597 17.5302 13.2186 17.3134 13.4568C17.0985 13.6932 16.8588 13.907 16.5983 14.0946C16.3358 14.2822 16.0562 14.4397 15.7595 14.5692C15.4647 14.6967 15.1566 14.7942 14.8409 14.858C14.6926 15.312 14.472 15.7415 14.1867 16.1279C13.9033 16.5143 13.5591 16.8538 13.1673 17.1333C12.7755 17.4147 12.3419 17.6323 11.8816 17.7786C11.4214 17.9268 10.9402 17.9999 10.4552 17.9999C10.1338 18.0018 9.81046 17.968 9.49475 17.9043C9.18094 17.8386 8.87284 17.7392 8.57805 17.6098C8.28326 17.4803 8.00368 17.319 7.74312 17.1314C7.48447 16.9439 7.24483 16.7282 7.03182 16.4899C6.55635 16.5912 6.06947 16.6156 5.5883 16.5668C5.10712 16.5162 4.63546 16.3924 4.19232 16.1973C3.75108 16.0041 3.34218 15.7415 2.98272 15.4207C2.62327 15.1 2.31707 14.7248 2.07553 14.3122C1.91387 14.0364 1.78074 13.7457 1.67994 13.4437C1.57914 13.1417 1.51257 12.8303 1.47834 12.5133C1.44411 12.1982 1.44601 11.8793 1.48024 11.5623C1.51448 11.2472 1.58485 10.9358 1.68564 10.6338C1.36233 10.2793 1.09606 9.87599 0.898268 9.44081C0.702374 9.00375 0.574948 8.54044 0.5255 8.06587C0.474149 7.5913 0.500775 7.11111 0.601575 6.64404C0.702374 6.17698 0.877347 5.72867 1.12079 5.316C1.28054 5.04026 1.46883 4.77953 1.68374 4.54318C1.89865 4.30684 2.14019 4.093 2.40075 3.90542C2.66131 3.71785 2.94279 3.55841 3.23758 3.43085C3.53427 3.30143 3.84237 3.20576 4.15808 3.14199C4.30643 2.68617 4.52705 2.2585 4.81043 1.87209C5.09571 1.48568 5.43995 1.14617 5.83174 0.864806C6.22352 0.585317 6.65715 0.367728 7.1174 0.219543C7.57766 0.073233 8.05883 -0.00179761 8.54381 7.81569e-05C8.86523 -0.00179761 9.18855 0.0300904 9.50426 0.0957422C9.81997 0.161394 10.1281 0.258934 10.4229 0.388362C10.7177 0.519665 10.9972 0.679105 11.2578 0.866682C11.5183 1.05613 11.758 1.26997 11.971 1.50819C12.4446 1.40878 12.9314 1.38439 13.4126 1.43316C13.8938 1.48193 14.3636 1.60761 14.8067 1.80081C15.2479 1.99589 15.6568 2.25662 16.0163 2.57738C16.3757 2.89626 16.6819 3.26954 16.9235 3.68408C17.0851 3.95794 17.2183 4.24869 17.3191 4.55256C17.4199 4.85456 17.4883 5.16594 17.5207 5.48294C17.5549 5.79995 17.5549 6.11883 17.5188 6.43583C17.4845 6.75284 17.4142 7.06421 17.3134 7.36621C17.6386 7.72073 17.9029 8.12214 18.1007 8.5592Z" fill="currentColor" /></svg>);
const PerplexityIcon = () => (<svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M26.38 0V9.696H30V23.4933H26.0867V32L16.704 23.7413V31.9347H15.2493V23.732L5.856 32V23.38H2V9.584H5.84533V0L15.2493 8.65867V0.253333H16.7027V8.90667L26.38 0ZM16.704 12.0587V21.8173L24.632 28.796V19.2533L16.704 12.0587ZM15.2387 11.952L7.31067 19.1493V28.796L15.2387 21.8173V11.9533V11.952ZM26.0867 22.0587H28.5453V11.132H17.9467L26.0867 18.5187V22.0587ZM14.1107 11.0187H3.45333V21.9453H5.85333V18.5107L14.1093 11.0173L14.1107 11.0187ZM7.3 3.30133V9.58133H14.12L7.3 3.30133ZM24.9253 3.30133L18.1053 9.58133H24.9253V3.30133Z" fill="currentColor" /></svg>);

/** raw model key → label → icon. Renders nothing for unknown keys. */
const MODEL_ICON: Record<string, React.ReactNode> = {
   ai_overview: <Starburst />, ai_mode: <GoogleG />, chat_gpt: <ChatGptIcon />, perplexity: <PerplexityIcon />, gemini: <Starburst />,
};
const MODEL_LABEL: Record<string, string> = {
   ai_overview: 'AI Overviews', ai_mode: 'AI Mode', chat_gpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini',
};

const ModelStack = ({ models }: { models: string[] }) => {
   const known = models.filter((m) => MODEL_ICON[m]);
   if (!known.length) return <span style={{ color: '#9F9FA9' }}>—</span>;
   return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
         {known.map((m, i) => (
            <span key={m} title={MODEL_LABEL[m] || m} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 9999, background: '#fff', border: '1px solid #E4E4E7', color: '#18181B', marginLeft: i ? -6 : 0, flexShrink: 0 }}>
               <span style={{ display: 'inline-flex', transform: 'scale(0.72)' }}>{MODEL_ICON[m]}</span>
            </span>
         ))}
      </span>
   );
};

const Chevron = ({ open }: { open: boolean }) => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: '#71717B', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }}><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const SortArrow = ({ dir }: { dir: 'asc' | 'desc' | null }) => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: dir ? 1 : 0.45, transform: dir === 'asc' ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}><path d="M12 5v14m0 0l-5-5m5 5l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const headCell: React.CSSProperties = { padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#71717B', fontFamily: FONT, borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', boxSizing: 'border-box' };
const bodyCell: React.CSSProperties = { padding: '12px 16px', fontSize: 14, fontFamily: FONT, borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', minHeight: 48, boxSizing: 'border-box', color: '#18181B' };
const rowStyle: React.CSSProperties = { display: 'flex', borderBottom: '1px solid #F4F4F5', background: '#fff', transition: 'background 100ms ease' };

const SortHead = ({ label, dir, onClick }: { label: string; dir: 'asc' | 'desc'; onClick: () => void }) => (
   <button type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, color: '#18181B' }}>
      {label} <SortArrow dir={dir} />
   </button>
);

// left-anchored faint "times-shown" bar rendered behind the first column's text.
const TimesBar = ({ pct }: { pct: number }) => (
   <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'linear-gradient(to right, transparent, #F4F4F5)', pointerEvents: 'none', borderRadius: '0 4px 4px 0' }} />
);

const isFanout = (r: FanoutByQueryRow | FanoutByPromptRow): r is FanoutByQueryRow => 'query' in r;

type Props = {
   group: 'fanout' | 'prompt';
   // Already filtered+sorted by the page, so `index` in onOpenRow matches the page's
   // `items[]` mapping exactly. Union so children render per group.
   rows: Array<FanoutByQueryRow | FanoutByPromptRow>;
   dir: 'asc' | 'desc';
   onToggleSort: () => void;
   onOpenRow: (index: number) => void;
};

/** SurferSEO/Peec-style fanout table: parent rows (grouped by fanout query or by
 * prompt) sortable by "Times shown" (desc default), each expandable to its children,
 * with a faint gradient "times-shown" bar behind the first column. Rows arrive already
 * filtered+sorted; clicking a parent row (not the chevron) opens the shared detail
 * modal via onOpenRow(index) — the same index the page uses to build modal `items`. */
const FanoutTable = ({ group, rows, dir, onToggleSort, onOpenRow }: Props) => {
   const [open, setOpen] = useState<Set<string>>(new Set());

   const maxTimes = useMemo(() => Math.max(1, ...rows.map((r) => r.timesShown)), [rows]);

   const keyOf = (r: FanoutByQueryRow | FanoutByPromptRow): string => (isFanout(r) ? r.query : String(r.id));
   const toggle = (k: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

   const firstLabel = group === 'fanout' ? 'Fanout Query' : 'Prompt';
   const secondLabel = group === 'fanout' ? 'Prompts' : 'Fanout Queries';

   return (
      <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
         <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5' }}>
            <div style={{ ...headCell, borderLeft: 'none', flex: 1, minWidth: 0 }}>{firstLabel}</div>
            <div style={{ ...headCell, width: 120, flexShrink: 0, justifyContent: 'flex-end' }}>{secondLabel}</div>
            <div style={{ ...headCell, width: 100, flexShrink: 0, justifyContent: 'center' }}>Models</div>
            <div style={{ ...headCell, width: 140, flexShrink: 0, justifyContent: 'flex-end' }}><SortHead label="Times shown" dir={dir} onClick={onToggleSort} /></div>
         </div>

         {rows.map((r, i) => {
            const k = keyOf(r);
            const isOpen = open.has(k);
            const pct = Math.round((r.timesShown / maxTimes) * 100);
            const primaryText = isFanout(r) ? r.query : r.text;
            const secondaryCount = isFanout(r) ? r.promptCount : r.fanoutCount;
            return (
               <React.Fragment key={k}>
                  <div
                     style={{ ...rowStyle, cursor: 'pointer' }}
                     onClick={() => onOpenRow(i)}
                     onMouseEnter={(e) => { e.currentTarget.style.background = '#FBFAFF'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                     role="button"
                     tabIndex={0}
                     onKeyDown={(e) => { if (e.key === 'Enter') onOpenRow(i); }}
                  >
                     <div style={{ ...bodyCell, borderLeft: 'none', flex: 1, minWidth: 0, gap: 8, position: 'relative' }}>
                        <TimesBar pct={pct} />
                        <button
                           type="button"
                           aria-label={isOpen ? 'Collapse' : 'Expand'}
                           onClick={(e) => { e.stopPropagation(); toggle(k); }}
                           style={{ position: 'relative', zIndex: 1, display: 'inline-flex', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', flexShrink: 0 }}
                        >
                           <Chevron open={isOpen} />
                        </button>
                        <span style={{ position: 'relative', zIndex: 1, fontWeight: 600, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primaryText}</span>
                     </div>
                     <div style={{ ...bodyCell, width: 120, flexShrink: 0, justifyContent: 'flex-end', color: '#52525C' }}>{secondaryCount}</div>
                     <div style={{ ...bodyCell, width: 100, flexShrink: 0, justifyContent: 'center' }}><ModelStack models={r.models} /></div>
                     <div style={{ ...bodyCell, width: 140, flexShrink: 0, justifyContent: 'flex-end', fontWeight: 600 }}>{r.timesShown}</div>
                  </div>

                  {isOpen && isFanout(r) && r.prompts.map((child) => (
                     <div key={child.id} style={{ ...rowStyle, background: '#FCFCFD' }}>
                        <div style={{ ...bodyCell, borderLeft: 'none', flex: 1, minWidth: 0, paddingLeft: 48, color: '#3F3F47' }}>
                           <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.text}</span>
                        </div>
                        <div style={{ ...bodyCell, width: 120, flexShrink: 0 }} />
                        <div style={{ ...bodyCell, width: 100, flexShrink: 0 }} />
                        <div style={{ ...bodyCell, width: 140, flexShrink: 0, justifyContent: 'flex-end', color: '#52525C' }}>{child.timesShown}</div>
                     </div>
                  ))}
                  {isOpen && !isFanout(r) && r.queries.map((child) => (
                     <div key={child.query} style={{ ...rowStyle, background: '#FCFCFD' }}>
                        <div style={{ ...bodyCell, borderLeft: 'none', flex: 1, minWidth: 0, paddingLeft: 48, color: '#3F3F47' }}>
                           <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.query}</span>
                        </div>
                        <div style={{ ...bodyCell, width: 120, flexShrink: 0 }} />
                        <div style={{ ...bodyCell, width: 100, flexShrink: 0, justifyContent: 'center' }}><ModelStack models={child.models} /></div>
                        <div style={{ ...bodyCell, width: 140, flexShrink: 0, justifyContent: 'flex-end', color: '#52525C' }}>{child.timesShown}</div>
                     </div>
                  ))}
               </React.Fragment>
            );
         })}
      </div>
   );
};

export default FanoutTable;
