import React from 'react';
import type { MetricWithDelta } from '../../lib/seoOverview/types';

export const FONT = 'var(--font-family-primary)';

export const card: React.CSSProperties = {
  border: '1px solid #DAD9DE',
  borderRadius: 12,
  background: '#FFFFFF',
  boxShadow: '0 4px 0 0 #e4e4e7',
};

export const cardFlex: React.CSSProperties = {
  ...card,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

export const cardTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 600,
  color: '#3F3F47',
  fontFamily: FONT,
};

export const WidgetCtaStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 14px',
  borderRadius: 8,
  background: '#2F2F34',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
  fontFamily: FONT,
};

export const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: '#9F9FA9', flexShrink: 0 }}>
    <path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const WidgetHeader = ({ title, meta, action }: { title: string; meta?: React.ReactNode; action?: React.ReactNode }) => (
  <div style={{ padding: '20px 24px 0' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: meta ? 8 : 0 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <h2 style={cardTitle}>{title}</h2>
        <InfoIcon />
      </div>
      {action}
    </div>
    {meta}
  </div>
);

export const ViewFullReport = ({ href, label = 'View full report' }: { href: string; label?: string }) => (
  <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #F4F4F5' }}>
    <a href={href} style={{ fontSize: 13, fontWeight: 600, color: '#783AFB', textDecoration: 'none', fontFamily: FONT }}>
      {label}
      {' →'}
    </a>
  </div>
);

export function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

export function formatDuration(sec: number | null): string {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const DeltaPct = ({ value, trend }: { value: number | null; trend: 'up' | 'down' | 'same' }) => {
  if (value == null || trend === 'same') {
    return <span style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT }}>0%</span>;
  }
  const up = trend === 'up';
  return (
    <span style={{ fontSize: 13, fontWeight: 600, color: up ? '#1AB25E' : '#FF6F77', fontFamily: FONT }}>
      {up ? '↑' : '↓'}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
};

export const MetricDelta = ({ m }: { m: MetricWithDelta }) => {
  if (m.deltaPct == null || m.trend === 'same') return null;
  const up = m.trend === 'up';
  return (
    <span style={{
      fontSize: 13, fontWeight: 600, color: up ? '#1AB25E' : '#FF6F77', fontFamily: FONT,
      display: 'inline-flex', alignItems: 'center', gap: 2,
    }}
    >
      {up ? '↑' : '↓'}{Math.abs(m.deltaPct).toFixed(2)}%
    </span>
  );
};

export const WidgetSkeletonBar = ({ height = 14 }: { height?: number }) => (
  <div style={{ height, borderRadius: 6, background: '#E8E8ED' }} />
);

export const CountryPill = ({ label = 'Poland', flag = '🇵🇱' }: { label?: string; flag?: string }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
    borderRadius: 9999, border: '1px solid #E4E4E7', fontSize: 13, color: '#52525C', fontFamily: FONT,
  }}
  >
    <span style={{ fontSize: 14 }}>{flag}</span>
    {label}
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="#9F9FA9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);
