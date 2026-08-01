import React, { useMemo, useState } from 'react';
import { Button } from '../core';
import type { FanoutByQueryRow, FanoutByPromptRow } from '../../services/aiVisibility';
import { ModelIcon, isKnownModel } from './modelIcons';

const FONT = 'var(--font-family-primary)';

const MODEL_LABEL: Record<string, string> = {
   ai_overview: 'AI Overviews', ai_mode: 'AI Mode', chat_gpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini',
};

const ModelStack = ({ models }: { models: string[] }) => {
   const known = models.filter((m) => isKnownModel(m));
   if (!known.length) return <span style={{ color: '#9F9FA9' }}>—</span>;
   return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
         {known.map((m, i) => (
            <span key={m} title={MODEL_LABEL[m] || m} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 9999, background: '#fff', border: '1px solid #E4E4E7', color: '#18181B', marginLeft: i ? -6 : 0, flexShrink: 0 }}>
               <span style={{ display: 'inline-flex', transform: 'scale(0.72)' }}><ModelIcon model={m} size={16} /></span>
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
   <Button type="button" variant="transparent" size="sm" onClick={onClick} style={{ gap: 4, fontWeight: 600, color: '#18181B' }}>
      {label} <SortArrow dir={dir} />
   </Button>
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

/** Ranksmile/Peec-style fanout table: parent rows (grouped by fanout query or by
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
      <div style={{ border: '1px solid #dbded4', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
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
