import React from 'react';

export interface TabItem { value: string; label: React.ReactNode; count?: number; }

const Tabs = ({ items, value, onChange }: { items: TabItem[]; value: string; onChange: (v: string) => void; }) => (
  <div style={{ display: 'inline-flex', position: 'relative', background: '#F4F4F5', borderRadius: 8, padding: 3 }}>
    {items.map((t) => {
      const active = value === t.value;
      return (
        <button key={t.value} type="button" onClick={() => onChange(t.value)}
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 6,
            fontFamily: 'var(--font-family-primary)',
            fontSize: 14,
            fontWeight: 500,
            background: active ? '#fff' : 'transparent',
            color: active ? '#09090B' : '#3F3F47',
            boxShadow: active ? '0px 4px 4px rgba(24,26,34,0.02), 0px 1px 2px rgba(24,26,34,0.08), 0px -1px 1px rgba(0,0,0,0.02)' : 'none',
            transition: 'background 200ms, box-shadow 200ms, color 200ms',
          }}>
          <span style={{ fontWeight: 600 }}>{t.label}</span>
          {t.count !== undefined && (
            <span style={{ fontWeight: 400, color: active ? '#52525C' : '#9F9FA9', fontSize: 13 }}>{t.count}</span>
          )}
        </button>
      );
    })}
  </div>
);

export default Tabs;
