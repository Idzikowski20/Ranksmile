import React from 'react';
import { useRouter } from 'next/router';
import type { AuditItem } from '../../pages/api/audit';
import { Gauge } from '../koala/core';

interface Props {
  item: AuditItem | null;
  lastAnalysisAt: string | null;
  lastSCUpdate: string | null;
  onClose: () => void;
}

const formatDate = (d: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString(); } catch { return d; }
};

const AuditPanel: React.FC<Props> = ({ item, lastAnalysisAt, lastSCUpdate, onClose }) => {
  const router = useRouter();

  if (!item) return null;

  const score = item.contentScore || 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 380,
        height: '100vh',
        background: '#fff',
        boxShadow: 'rgba(0, 0, 0, 0.08) -4px 0px 24px 0px, rgba(0, 0, 0, 0.04) -1px 0px 4px 0px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Inter Variable, Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 21px', borderBottom: '1px solid #f4f4f5', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#09090b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title}
          </div>
          <div style={{ fontSize: 11, color: '#9f9fa9', marginTop: 2 }}>
            {item.url}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 32, height: 32, borderRadius: 7, border: 'none', background: '#f4f4f5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#52525c', fontSize: 16, flexShrink: 0, marginLeft: 10,
          }}
        >
          &times;
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '21px' }} className="styled-scrollbar">
        {/* Content Score gauge */}
        <div style={{ textAlign: 'center', marginBottom: 21 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
            Content Score
          </div>
          <Gauge score={score} size="md" />
        </div>

        {/* CTA */}
        <button
          onClick={() => {
            const slug = router.query.slug;
            router.push(`/articles/${item.id}`);
          }}
          style={{
            width: '100%', padding: '11px 16px', borderRadius: 10.5, border: 'none',
            background: 'linear-gradient(135deg, #F84416 0%, #6d28d9 100%)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Inter Variable, Arial, sans-serif',
            marginBottom: 21, transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          Open in Content Editor
        </button>

        {/* SERP metrics */}
        <div style={{ background: '#f9fafb', borderRadius: 10.5, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            SERP Performance (30 days)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div style={{ textAlign: 'center', padding: '8px 4px', background: '#fff', borderRadius: 7, border: '1px solid #f4f4f5' }}>
              <div style={{ fontSize: 11, color: '#71717a' }}>Position</div>
              <div style={{ fontWeight: 700, color: '#09090b', fontSize: 16, marginTop: 2 }}>
                {item.position !== null ? item.position : '—'}
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '8px 4px', background: '#fff', borderRadius: 7, border: '1px solid #f4f4f5' }}>
              <div style={{ fontSize: 11, color: '#71717a' }}>Traffic</div>
              <div style={{ fontWeight: 700, color: '#09090b', fontSize: 16, marginTop: 2 }}>
                {item.traffic !== null ? item.traffic : '—'}
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '8px 4px', background: '#fff', borderRadius: 7, border: '1px solid #f4f4f5' }}>
              <div style={{ fontSize: 11, color: '#71717a' }}>CTR</div>
              <div style={{ fontWeight: 700, color: '#09090b', fontSize: 16, marginTop: 2 }}>
                {item.ctr !== null ? `${item.ctr.toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div style={{ fontSize: 11, color: '#9f9fa9', lineHeight: '1.8' }}>
          <div>
            Last page &amp; SERP analysis:{' '}
            <strong style={{ color: '#71717a' }}>{formatDate(lastAnalysisAt)}</strong>
          </div>
          <div>
            Last search data update:{' '}
            <strong style={{ color: '#71717a' }}>{formatDate(lastSCUpdate)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditPanel;
