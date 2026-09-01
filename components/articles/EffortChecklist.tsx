import React from 'react';
import { Badge } from '../koala/core';
import type { EffortChecklistItem, EffortSignalStatus } from '../../lib/contentEffort';

const F = 'var(--font-family-primary)';

const STATUS_BADGE: Record<EffortSignalStatus, { variant: 'success' | 'warning' | 'danger' | 'muted'; label: string }> = {
   pass: { variant: 'success', label: 'OK' },
   warn: { variant: 'warning', label: 'Weak' },
   fail: { variant: 'danger', label: 'Missing' },
   unknown: { variant: 'muted', label: '—' },
};

type Props = {
   items: EffortChecklistItem[];
   /** Optional effort score 0–100 from heuristic/LLM. */
   effortScore?: number | null;
   effortReasons?: string[];
   effortSource?: 'heuristic' | 'llm';
   onAnalyzeEffort?: () => void;
   analyzingEffort?: boolean;
   readOnly?: boolean;
   compact?: boolean;
   /** When parent already renders the section title (e.g. Write & Optimize accordion). */
   hideHeader?: boolean;
};

/**
 * Five effort signals — “not AI vs human, but hard to replicate with one prompt”.
 * Ranksmile editor zone: inline styles + Sentry Badge for status.
 */
const EffortChecklist = ({
   items,
   effortScore,
   effortReasons,
   effortSource,
   onAnalyzeEffort,
   analyzingEffort,
   readOnly,
   compact,
   hideHeader,
}: Props) => (
   <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12, fontFamily: F }}>
      {!hideHeader && (
         <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
               <div style={{ fontSize: compact ? 13 : 14, fontWeight: 600, color: '#18181b' }}>
                  Effort
               </div>
               <div style={{ fontSize: 12, color: '#52525c', marginTop: 2, lineHeight: 1.4 }}>
                  Not “AI vs writer” — signals that are hard to cheaply replicate with one prompt.
               </div>
            </div>
            {typeof effortScore === 'number' && (
               <span
                  style={{
                     flexShrink: 0,
                     fontSize: 13,
                     fontWeight: 700,
                     fontVariantNumeric: 'tabular-nums',
                     color: effortScore >= 70 ? '#1AB25E' : effortScore >= 45 ? '#B45309' : '#FF6F77',
                  }}
                  title={effortSource === 'llm' ? 'Our effort estimate (LLM)' : 'Our effort estimate (heuristic)'}
               >
                  {effortScore}
               </span>
            )}
         </div>
      )}

      {hideHeader && (
         <div style={{ fontSize: 12, color: '#52525c', lineHeight: 1.4, marginBottom: 2 }}>
            Not “AI vs writer” — signals that are hard to cheaply replicate with one prompt.
         </div>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
         {items.map((item) => {
            const meta = STATUS_BADGE[item.status];
            return (
               <li
                  key={item.key}
                  style={{
                     display: 'flex',
                     alignItems: 'flex-start',
                     gap: 10,
                     padding: compact ? '8px 10px' : '10px 12px',
                     borderRadius: 8,
                     border: '1px solid #F4F4F5',
                     background: '#FFFFFF',
                  }}
               >
                  <Badge variant={meta.variant} style={{ flexShrink: 0, marginTop: 1 }}>
                     {meta.label}
                  </Badge>
                  <div style={{ minWidth: 0, flex: 1 }}>
                     <div style={{ fontSize: 12, fontWeight: 600, color: '#3f3f47' }}>{item.label}</div>
                     <div style={{ fontSize: 12, color: '#71717b', marginTop: 2 }}>{item.detail}</div>
                  </div>
               </li>
            );
         })}
      </ul>

      {effortReasons && effortReasons.length > 0 && (
         <div style={{ fontSize: 12, color: '#52525c', lineHeight: 1.45 }}>
            {effortReasons.map((r, i) => (
               <div key={`${i}-${r}`} style={{ marginTop: 2 }}>• {r}</div>
            ))}
         </div>
      )}

      {onAnalyzeEffort && (
         <button
            type="button"
            disabled={readOnly || analyzingEffort}
            onClick={onAnalyzeEffort}
            style={{
               width: '100%',
               padding: '9px 16px',
               borderRadius: 6,
               border: 'none',
               boxShadow: 'inset 0 0 0 1px #e4e4e7',
               background: 'transparent',
               color: '#3f3f47',
               fontSize: 13,
               fontWeight: 600,
               fontFamily: F,
               cursor: readOnly || analyzingEffort ? 'not-allowed' : 'pointer',
               opacity: readOnly || analyzingEffort ? 0.6 : 1,
               transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { if (!readOnly && !analyzingEffort) e.currentTarget.style.background = '#f4f4f5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
         >
            {analyzingEffort ? 'Estimating effort…' : 'Estimate effort (LLM)'}
         </button>
      )}
   </div>
);

export default EffortChecklist;
