import React from 'react';
import Button from './button/button';

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
  caption?: React.ReactNode;
  disabled?: boolean;
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

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className = '',
  caption,
  disabled = false,
}: PaginationProps) {
  if (pageCount <= 1) return null;
  const prevDisabled = disabled || page <= 1;
  const nextDisabled = disabled || page >= pageCount;

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
