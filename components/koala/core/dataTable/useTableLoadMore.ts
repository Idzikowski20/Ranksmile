import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_PAGE = 20;

/** Pure step for LoadMore chunking — kept separate for a one-liner self-check. */
export function nextVisibleCount(visible: number, total: number, pageSize: number): number {
  return Math.min(visible + pageSize, total);
}

/**
 * Chunk already-loaded rows for infinite scroll (HeroUI Table.LoadMore pattern).
 * Resets visible count when `resetKey` changes (filters / sort / tab).
 */
export function useTableLoadMore<T>(
  items: T[],
  opts?: { pageSize?: number; resetKey?: string | number },
): {
  visibleItems: T[];
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => void;
} {
  const pageSize = opts?.pageSize ?? DEFAULT_PAGE;
  const resetKey = opts?.resetKey ?? items.length;
  const [visible, setVisible] = useState(pageSize);
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    setVisible(pageSize);
    setIsLoading(false);
    loadingRef.current = false;
  }, [resetKey, pageSize]);

  const hasMore = visible < items.length;

  const loadMore = useCallback(() => {
    if (!hasMore || loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    // Brief delay so the sentinel spinner is perceptible (matches HeroUI async demo feel).
    window.setTimeout(() => {
      setVisible((v) => nextVisibleCount(v, items.length, pageSize));
      setIsLoading(false);
      requestAnimationFrame(() => {
        loadingRef.current = false;
      });
    }, 280);
  }, [hasMore, items.length, pageSize]);

  return {
    visibleItems: items.slice(0, visible),
    hasMore,
    isLoading,
    loadMore,
  };
}

// ponytail: ceiling = client-side chunk only; upgrade = real API cursor pagination
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  // eslint-disable-next-line no-console
  console.assert(nextVisibleCount(20, 45, 20) === 40, 'load more mid');
  // eslint-disable-next-line no-console
  console.assert(nextVisibleCount(40, 45, 20) === 45, 'load more end');
}
