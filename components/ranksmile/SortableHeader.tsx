import React from 'react';
import { SortUpDown } from './icons';
import type { SortDir } from '../../lib/useSortState';

const SortableHeader = ({ label, sortKey, activeKey, dir, width, onSort, align = 'flex-end' }: {
  label: string; sortKey: string; activeKey: string; dir: SortDir; width: number; onSort: (k: string) => void;
  align?: 'center' | 'flex-end';
}) => {
  const active = activeKey === sortKey;
  return (
    <div role="button" tabIndex={0} onClick={() => onSort(sortKey)} onKeyDown={(e) => e.key === 'Enter' && onSort(sortKey)}
      style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: align, width, flexShrink: 0, cursor: 'pointer', userSelect: 'none', gap: 4 }}>
      <span style={{ fontSize: 14, fontWeight: active ? 700 : 500, lineHeight: '20px', letterSpacing: '-0.4px', color: active ? 'var(--koala-text-primary, #1a1a1a)' : 'var(--koala-text-secondary, #575757)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <SortUpDown active={active} dir={active ? dir : null} />
    </div>
  );
};
export default SortableHeader;
