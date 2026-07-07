import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'serpbear-nav-collapsed';

/** Persists primary nav rail collapsed state (icon-only rail). */
export function useNavCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored != null) setCollapsed(JSON.parse(stored) as boolean);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
    } catch { /* ignore */ }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  return [collapsed, toggle];
}
