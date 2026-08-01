import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { typeface } from '../tokens/typography';

const Root = styled.div`
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: ${semantic.background.secondary};
  border-radius: 12px;
  border: 1px solid ${semantic.border.primary};
`;

const TabBtn = styled.button<{ $active: boolean }>`
  appearance: none;
  border: none;
  cursor: pointer;
  font-family: ${typeface.body};
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.4px;
  padding: 6px 12px;
  border-radius: 10px;
  background: ${(p) => (p.$active ? semantic.background.primary : 'transparent')};
  color: ${(p) => (p.$active ? semantic.text.primary : semantic.text.secondary)};
  box-shadow: ${(p) => (p.$active ? 'var(--shadow-1)' : 'none')};
  transition: background 120ms ease, color 120ms ease;
`;

export type TabItem = { id: string; label: React.ReactNode; disabled?: boolean };

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <Root className={className} role="tablist">
      {items.map((item) => (
        <TabBtn
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          disabled={item.disabled}
          $active={item.id === value}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </TabBtn>
      ))}
    </Root>
  );
}
