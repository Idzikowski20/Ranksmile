import React from 'react';
import { Gauge } from '../ui';
import { AuditCardDTO } from '../../lib/auditTypes';

const FONT = 'var(--font-family-primary)';

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
   queued: { bg: '#FFFBEB', color: '#B45309', label: 'Queued' },
   running: { bg: '#FFFBEB', color: '#B45309', label: 'Analyzing' },
   completed: { bg: '#F0FDF4', color: '#15803D', label: 'Done' },
   failed: { bg: '#FEF2F2', color: '#DC2626', label: 'Failed' },
};

const Spinner = ({ size = 12 }: { size?: number }) => (
   <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, animation: 'spin 0.7s linear infinite', color: '#B45309' }}>
      <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
   </svg>
);

const StatusBadge = ({ status }: { status: string }) => {
   const s = STATUS[status] || STATUS.queued;
   const busy = status === 'running' || status === 'queued';
   return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, fontFamily: FONT }}>
         {busy && <Spinner size={11} />}{s.label}
      </span>
   );
};

/** One audit row in the list. Click → detail. Progress bar while queued/running. */
const AuditCard = ({ item, onOpen }: { item: AuditCardDTO; onOpen: (id: number) => void }) => {
   const busy = item.status === 'running' || item.status === 'queued';
   const done = item.status === 'completed';

   return (
      <button
         type="button"
         onClick={() => done && onOpen(item.id)}
         className="audit-card-row"
         style={{
            display: 'flex', alignItems: 'center', gap: 16, width: '100%', textAlign: 'left',
            border: '1px solid #F4F4F5', borderRadius: 12, background: '#fff', padding: '16px 20px',
            cursor: done ? 'pointer' : 'default', fontFamily: FONT, transition: 'background 150ms ease',
         }}
         onMouseEnter={(e) => { if (done) e.currentTarget.style.background = '#F8F8F9'; }}
         onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
      >
         <div style={{ width: 40, height: 40, flexShrink: 0, opacity: done ? 1 : 0.35 }}>
            <Gauge score={item.contentScore ?? 0} size="sm" />
         </div>

         <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
               {item.keyword}
            </div>
            <div style={{ fontSize: 12, color: '#52525C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
               {item.url}
            </div>
            {busy && (
               <div style={{ marginTop: 10, height: 4, borderRadius: 9999, background: '#F4F4F5', overflow: 'hidden' }}>
                  <div style={{
                     height: '100%', borderRadius: 9999, background: '#783AFB',
                     width: item.status === 'running' ? '55%' : '12%',
                     animation: item.status === 'running' ? 'auditBarPulse 1.4s ease-in-out infinite' : 'none',
                  }}
                  />
               </div>
            )}
         </div>

         <StatusBadge status={item.status} />
      </button>
   );
};

export default AuditCard;
