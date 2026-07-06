import React from 'react';
import { Tabs as CoreTabs } from '../core/tabs/tabs';

export interface TabItem { value: string; label: React.ReactNode; count?: number; }

const Tabs = ({ items, value, onChange }: { items: TabItem[]; value: string; onChange: (v: string) => void }) => (
  <CoreTabs items={items} value={value} onChange={onChange} size="md" />
);

export default Tabs;
