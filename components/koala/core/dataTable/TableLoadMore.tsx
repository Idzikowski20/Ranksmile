import React, { useEffect, useRef } from 'react';

type TableLoadMoreProps = {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  /** Scroll container for IntersectionObserver; omit to use viewport. */
  scrollRootRef?: React.RefObject<Element | null>;
};

/** Sentinel row — fires onLoadMore when scrolled into view (HeroUI Table.LoadMore). */
export function TableLoadMore({ hasMore, isLoading, onLoadMore, scrollRootRef }: TableLoadMoreProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { root: scrollRootRef?.current ?? null, rootMargin: '80px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, scrollRootRef]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className="rs-data-table__load-more" role="status" aria-live="polite">
      {isLoading ? (
        <span className="rs-data-table__spinner" aria-label="Loading more" />
      ) : (
        <span className="rs-data-table__load-more-label">Scroll for more</span>
      )}
    </div>
  );
}
