import React, { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';

export interface TabItem { value: string; label: React.ReactNode; count?: number; }

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  size?: 'xs' | 'sm' | 'md';
}

const TabList = styled.div`
  display: inline-flex;
  position: relative;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  background: #F0F0F2;
  border-radius: 6px;
  padding: 3px;
`;

const Pill = styled.div<{ $left: number; $width: number }>(({ $left, $width }) => ({
  position: 'absolute', top: 3, left: $left, width: $width,
  height: 'calc(100% - 6px)',
  background: '#FFFFFF',
  borderRadius: 5,
  boxShadow: '0px 4px 4px rgba(24,26,34,0.02), 0px 1px 2px rgba(24,26,34,0.08)',
  transition: 'left 160ms cubic-bezier(0.72, 0, 0.16, 1), width 160ms cubic-bezier(0.72, 0, 0.16, 1)',
  pointerEvents: 'none',
}));

const TabBtn = styled.button<{ $on: boolean }>(({ $on }) => ({
  position: 'relative', zIndex: 1,
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '4px 12px',
  border: 'none', cursor: 'pointer',
  borderRadius: 5,
  fontFamily: "Rubik, 'Avenir Next', 'InterVariable', 'Inter', Arial, sans-serif",
  fontSize: 14, fontWeight: 500,
  background: 'transparent',
  color: $on ? '#181225' : '#6A6772',
  transition: 'color 160ms cubic-bezier(0.72, 0, 0.16, 1)',
  whiteSpace: 'nowrap',
  outline: 'none',
  '&:focus-visible': { outline: '2px solid #F29964', outlineOffset: -2 },
}));

const Cnt = styled.span<{ $on: boolean }>(({ $on }) => ({
  fontWeight: 400, fontSize: 13,
  color: $on ? '#6A6772' : '#878490',
}));

export function Tabs({ items, value, onChange }: TabsProps) {
  const [pill, setPill] = useState({ left: 0, width: 0 });
  const refs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const el = refs.current.get(value);
    if (el?.parentElement) {
      const pr = el.parentElement.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      setPill({ left: er.left - pr.left, width: er.width });
    }
  }, [value, items]);

  return (
    <TabList>
      <Pill $left={pill.left} $width={pill.width} />
      {items.map((t) => (
        <TabBtn key={t.value} ref={(el) => { if (el) refs.current.set(t.value, el); }}
          $on={value === t.value} onClick={() => onChange(t.value)} type="button">
          <span style={{ fontWeight: 600 }}>{t.label}</span>
          {t.count !== undefined && <Cnt $on={value === t.value}>{t.count}</Cnt>}
        </TabBtn>
      ))}
    </TabList>
  );
}

export default Tabs;
