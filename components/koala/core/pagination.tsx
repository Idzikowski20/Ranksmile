import React from 'react';
import Button from './button/button';

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
  caption?: React.ReactNode;
  disabled?: boolean;
  /** Numbered page buttons (Figma 3950:178062). Default true. */
  showPageNumbers?: boolean;
};

const ChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Visible page list with ellipses — Koala Pagination (Figma 3950:178062). */
export function getVisiblePages(page: number, pageCount: number): Array<number | 'ellipsis'> {
  if (pageCount <= 1) return pageCount === 1 ? [1] : [];
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, pageCount]);
  for (let i = page - 1; i <= page + 1; i += 1) {
    if (i >= 1 && i <= pageCount) set.add(i);
  }
  if (page <= 3) {
    set.add(2);
    set.add(3);
    set.add(4);
  }
  if (page >= pageCount - 2) {
    set.add(pageCount - 1);
    set.add(pageCount - 2);
    set.add(pageCount - 3);
  }
  const sorted = Array.from(set).sort((a, b) => a - b);
  const out: Array<number | 'ellipsis'> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('ellipsis');
    out.push(sorted[i]);
  }
  return out;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className = '',
  caption,
  disabled = false,
  showPageNumbers = true,
}: PaginationProps) {
  if (pageCount <= 1) return null;
  const prevDisabled = disabled || page <= 1;
  const nextDisabled = disabled || page >= pageCount;
  const pages = showPageNumbers ? getVisiblePages(page, pageCount) : [];

  return (
    <div className={`koala-pagination ${className}`} data-test-id="pagination">
      {caption && <div className="koala-pagination-caption">{caption}</div>}
      <div className="koala-pagination-controls">
        <Button
          size="sm"
          variant="secondary"
          aria-label="Previous page"
          disabled={prevDisabled}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        {pages.map((item, idx) => {
          if (item === 'ellipsis') {
            return (
              <span key={`e-${idx}`} className="koala-pagination-ellipsis" aria-hidden>
                …
              </span>
            );
          }
          const active = item === page;
          return (
            <Button
              key={item}
              size="sm"
              variant={active ? 'primary' : 'secondary'}
              aria-label={`Page ${item}`}
              aria-current={active ? 'page' : undefined}
              disabled={disabled}
              className={active ? 'koala-pagination-page is-active' : 'koala-pagination-page'}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          );
        })}
        <Button
          size="sm"
          variant="secondary"
          aria-label="Next page"
          disabled={nextDisabled}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function getPaginationCaption({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}): string {
  if (total === 0) return '0 results';
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start}–${end} of ${total}`;
}

export default Pagination;
