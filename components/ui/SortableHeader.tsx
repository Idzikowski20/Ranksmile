import React from 'react';
import { SortUpDown } from './icons';
import type { SortDir } from '../../lib/useSortState';

const SortableHeader = ({ label, sortKey, activeKey, dir, width, onSort }: {
  label: string; sortKey: string; activeKey: string; dir: SortDir; width: number; onSort: (k: string) => void;
}) => {
  const active = activeKey === sortKey;
  return (
    <div role="button" tabIndex={0} onClick={() => onSort(sortKey)} onKeyDown={(e) => e.key === 'Enter' && onSort(sortKey)}
      style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width, flexShrink: 0, cursor: 'pointer', userSelect: 'none', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#09090B' : '#52525C', textDecoration: 'underline dotted', textDecorationColor: '#9F9FA9', textUnderlineOffset: 4 }}>
        {label}
      </span>
      <SortUpDown active={active} dir={active ? dir : null} />
    </div>
  );
};
export default SortableHeader;
