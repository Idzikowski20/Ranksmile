// lib/useSortState.ts
import { useState } from 'react';

export type SortDir = 'asc' | 'desc';

export function useSortState<K extends string>(defaultKey: K, defaultDir: SortDir = 'desc') {
  const [sortKey, setSortKey] = useState<K>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);
  const handleSort = (key: K) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  };
  return { sortKey, sortDir, handleSort };
}
