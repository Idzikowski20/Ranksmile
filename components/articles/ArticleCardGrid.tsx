import React, { useState } from 'react';
import { TableLoadMore } from '../koala/core';
import ArticleCard, { type ArticleCardAuthor, type ArticleCardData } from './ArticleCard';

type Props = {
  articles: ArticleCardData[];
  hrefFor: (article: ArticleCardData) => string;
  author?: ArticleCardAuthor;
  isLoading?: boolean;
  /** Shown instead of the grid when there are no articles at all. */
  emptyState?: React.ReactNode;
  onDelete?: (id: number | string) => void | Promise<void>;
  onDeleteMultiple?: (ids: Array<number | string>) => void | Promise<void>;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  skeletonCount?: number;
};

const Skeleton = ({ count }: { count: number }) => (
  <div className="article-card-grid" aria-busy="true" aria-label="Loading articles">
    {Array.from({ length: count }).map((_, i) => (
      <div key={`article-card-skel-${i}`} className="article-card article-card--skeleton" style={{ animationDelay: `${i * 0.08}s` }}>
        <div className="article-card__thumb" />
        <div className="article-card__bone" style={{ width: '80%' }} />
        <div className="article-card__bone" style={{ width: '45%', height: 12 }} />
      </div>
    ))}
  </div>
);

/** Three-up card grid shared by the dashboard and the Content page. */
export default function ArticleCardGrid({
  articles, hrefFor, author, isLoading, emptyState, onDelete, onDeleteMultiple, hasMore, onLoadMore, isLoadingMore, skeletonCount = 6,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleSelect = (id: number | string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const handleBulkDelete = async () => {
    if (isDeleting || !onDeleteMultiple) return;
    setIsDeleting(true);
    try {
      await onDeleteMultiple(Array.from(selectedIds));
      clearSelection();
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) return <Skeleton count={skeletonCount} />;
  if (!articles.length) return <>{emptyState ?? null}</>;

  return (
    <>
      <div className="article-card-grid">
        {articles.map((a) => (
          <ArticleCard
            key={a.id}
            article={a}
            href={hrefFor(a)}
            author={author}
            selected={selectedIds.has(a.id)}
            onDelete={onDelete}
            onSelect={onDeleteMultiple ? toggleSelect : undefined}
          />
        ))}
      </div>

      {typeof hasMore === 'boolean' && onLoadMore ? (
        <TableLoadMore hasMore={hasMore} isLoading={Boolean(isLoadingMore)} onLoadMore={onLoadMore} />
      ) : null}

      {selectedIds.size > 0 ? (
        <div className="article-bulk-bar" role="status">
          <button type="button" className="article-bulk-bar__close" aria-label="Deselect all" onClick={clearSelection}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="currentColor" fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
            </svg>
          </button>
          <span className="article-bulk-bar__count">{selectedIds.size} selected</span>
          <button type="button" className="article-bulk-bar__trash" onClick={handleBulkDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Put in trash'}
          </button>
        </div>
      ) : null}
    </>
  );
}
