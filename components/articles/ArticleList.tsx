import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge, Checkbox, Gauge, HoverTooltip, TableLoadMore } from '../koala/core';
import { Icon } from '../koala/icons/Icon';
import GeneratingStage from './GeneratingStage';

interface Article {
  id: number;
  title: string;
  status: string;
  score_data?: string;
  content_score?: number;
  target_keyword: string;
  word_count: number | null;
  publish_target: string | null;
  publish_url: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  articles: Array<{
    id: number | string;
    title: string;
    status: string;
    score_data?: string;
    content_score?: number;
    target_keyword: string;
    word_count: number | null;
    publish_target: string | null;
    publish_url: string | null;
    created_at: string;
    updated_at: string;
  }>;
  onDelete: (id: number | string) => void | Promise<void>;
  onDeleteMultiple: (ids: Array<number | string>) => void | Promise<void>;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  startLinks?: {
    recommendations: string;
    keyword: string;
    contentAudit: string;
  };
}

const timeAgo = (dateStr: string): { relative: string; full: string } => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relative: string;
  if (diffMins < 1) relative = 'just now';
  else if (diffMins < 60) relative = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  else if (diffHrs < 24) relative = `${diffHrs} hour${diffHrs !== 1 ? 's' : ''} ago`;
  else relative = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

  const full = date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  return { relative, full };
};

const articleStatusBadge = (status: string) => {
  if (status === 'published') {
    return <Badge appearance="success" size="sm">Published</Badge>;
  }
  if (status === 'accepted') {
    return <Badge appearance="warning" size="sm">Accepted</Badge>;
  }
  return null;
};

/** Figma Button Group on card hover (nodes 11679:484899 / 11679:484919). */
function ArticleCardHoverActions({
  articleId,
  onDelete,
  onSelect,
}: {
  articleId: number | string;
  onDelete: (id: number | string) => void | Promise<void>;
  onSelect: (id: number | string) => void;
}) {
  return (
    <div
      className="article-card-hover-actions"
      role="toolbar"
      aria-label="Article actions"
      onClick={(e) => e.stopPropagation()}
    >
      <Link href={`/articles/${articleId}`}>
        <a
          className="article-card-hover-btn"
          aria-label="Edit"
          title="Edit"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="PencilSimple" size={20} />
        </a>
      </Link>
      <HoverTooltip label="Delete">
        <button
          type="button"
          className="article-card-hover-btn"
          aria-label="Delete"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(articleId);
          }}
        >
          <Icon name="Trash" size={20} />
        </button>
      </HoverTooltip>
      <button
        type="button"
        className="article-card-hover-btn"
        aria-label="Select"
        title="Select"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(articleId);
        }}
      >
        <Icon name="CheckCircle" size={20} />
      </button>
    </div>
  );
}

const EmptyCardArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RecommendationsIcon = () => (
  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
    <path d="M22.2 4.4c.5 5.1 5.8 6.5 7.6 11.2 1.8 4.5.5 10.4-4.6 13.4 1.1-3.5-.4-5.8-2.6-8.2.1 4.9-2.8 7.5-6.5 8.5-4.6-2.3-6.7-6.3-5.8-11.2.8-4.6 5.8-7.5 6.5-12.9 2.1 1.4 3.9 3.3 5.4 5.6.6-1.9.5-3.8 0-6.4Z" fill="#FF5B49" />
    <path d="M20.5 30.2c-2.4-.8-4.1-2.8-4-5.4 0-2.2 1.6-3.8 3.2-5.4.3 2.7 2.7 3.4 3.4 5.8.6 2-.2 3.9-2.6 5Z" fill="#FFB199" />
  </svg>
);

const KeywordIcon = () => (
  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
    <rect x="7" y="9" width="28" height="24" rx="5" fill="var(--koala-bg-secondary)" stroke="var(--koala-border-secondary)" strokeWidth="1.5" />
    <path d="M14 17h14M14 22h10M14 27h14" stroke="var(--koala-text-primary)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ContentAuditIcon = () => (
  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
    <rect x="9" y="7" width="19" height="26" rx="4" fill="var(--koala-status-success-bg)" stroke="var(--koala-status-success)" strokeWidth="1.5" />
    <path d="M14 15h9M14 20h7M14 25h5" stroke="var(--koala-status-success)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="29" cy="28" r="5" fill="var(--koala-bg-primary)" stroke="var(--koala-status-success)" strokeWidth="2" />
    <path d="m32.8 31.8 3.2 3.2" stroke="var(--koala-status-success)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

type EmptyStartOptionKey = 'recommendations' | 'keyword' | 'contentAudit';

const EMPTY_START_OPTIONS: Array<{
  key: EmptyStartOptionKey;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'recommendations',
    title: 'Recommendations',
    description: 'Start with one of the suggested actions',
    href: '/dashboard',
    icon: <RecommendationsIcon />,
  },
  {
    key: 'keyword',
    title: 'Your keyword',
    description: 'Create content based on the keyword you provide',
    href: '/articles/new',
    icon: <KeywordIcon />,
  },
  {
    key: 'contentAudit',
    title: 'Content Audit',
    description: 'Optimize your existing content',
    href: '/articles/import',
    icon: <ContentAuditIcon />,
  },
];

const ArticleList = ({ articles, onDelete, onDeleteMultiple, isLoading, hasMore, onLoadMore, isLoadingMore, startLinks }: Props) => {
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleSelect = (id: number | string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDeleteMultiple(Array.from(selectedIds));
      clearSelection();
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }} aria-busy="true" aria-label="Loading articles">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`article-skel-${i}`}
            className="article-list-card"
            style={{
              height: 133,
              display: 'flex',
              alignItems: 'center',
              border: '1px solid var(--koala-border-primary)',
              borderRadius: 12,
              gap: 12,
              animation: 'skeletonPulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.08}s`,
            }}
          >
            {/* Left: score gauge placeholder */}
            <div style={{ width: 84, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--koala-bg-secondary)' }} />
            </div>
            {/* Title + meta */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ width: '45%', height: 16, borderRadius: 6, background: 'var(--koala-bg-secondary)' }} />
              <div style={{ width: '28%', height: 12, borderRadius: 6, background: 'var(--koala-bg-tertiary)' }} />
            </div>
            {/* Right: status/date placeholders */}
            <div style={{ paddingRight: 24, display: 'flex', gap: 16, flexShrink: 0 }}>
              <div style={{ width: 60, height: 12, borderRadius: 6, background: 'var(--koala-bg-tertiary)' }} />
              <div style={{ width: 40, height: 12, borderRadius: 6, background: 'var(--koala-bg-tertiary)' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          gap: 16,
          marginTop: 56,
          fontFamily: 'var(--font-family-primary)',
        }}
      >
        <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 600, color: 'var(--koala-text-secondary)' }}>
          How do you want to start?
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, width: '100%' }}>
          {EMPTY_START_OPTIONS.map((option) => (
            <Link href={startLinks?.[option.key] ?? option.href} key={option.title}>
              <a
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 196,
                  padding: 16,
                  border: '1px solid var(--koala-border-primary)',
                  borderRadius: 16,
                  background: 'var(--koala-bg-primary)',
                  color: 'var(--koala-text-primary)',
                  textDecoration: 'none',
                  transition: 'border-color 150ms ease, background 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--koala-border-secondary)';
                  e.currentTarget.style.background = 'var(--koala-bg-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--koala-border-primary)';
                  e.currentTarget.style.background = 'var(--koala-bg-primary)';
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--koala-border-focus)';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(242,153,100,0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--koala-border-primary)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  style={{
                    height: 82,
                    borderRadius: 12,
                    background: 'var(--koala-bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {option.icon}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 16, color: 'var(--koala-text-primary)' }}>
                  <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600 }}>
                    {option.title}
                  </span>
                  <EmptyCardArrow />
                </div>
                <span style={{ marginTop: 4, fontSize: 14, lineHeight: '20px', color: 'var(--koala-text-secondary)' }}>
                  {option.description}
                </span>
              </a>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="article-list" style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 0, maxWidth: '100%', paddingTop: 20 }}>
      {articles.map((article) => {
        const time = mounted ? timeAgo(article.updated_at || article.created_at) : null;
        // Content score from dedicated column (synced with editor via PUT /api/articles/[id])
        const score = typeof article.content_score === 'number' ? article.content_score : null;

        // Analyzing state — nc-gen mini stage (same language as /generating)
        if (article.status === 'analyzing') {
          return (
            <Link href={`/articles/${article.id}`} key={article.id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div
              className="article-list-card"
              style={{
                height: 133,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid var(--koala-border-primary)',
                borderRadius: 12,
                paddingRight: 24,
                gap: 12,
                userSelect: 'none',
                opacity: 0.85,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingLeft: 16,
                  paddingRight: 8,
                  width: 84,
                  flexShrink: 0,
                }}
              >
                <GeneratingStage size="xs" showProgress={false} />
              </div>

              {/* Main content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 14,
                    lineHeight: '20px',
                    fontWeight: 600,
                    color: 'var(--koala-text-primary)',
                    fontFamily: 'var(--font-family-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 450,
                  }}
                >
                  {article.title || article.target_keyword || '(untitled)'}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: '16px',
                    color: 'var(--koala-text-tertiary)',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Analyzing content…
                </span>
                <div className="nc-gen-progress" style={{ maxWidth: 180, height: 4, marginTop: 4 }} aria-hidden>
                  <div className="nc-gen-progress-fill nc-gen-progress-fill--indeterminate" />
                </div>
              </div>

              {/* Right: delete button */}
              <button
                type="button"
                title="Delete"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(article.id); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--koala-text-tertiary)',
                  flexShrink: 0,
                  transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--koala-status-danger)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--koala-status-danger-bg)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--koala-text-tertiary)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            </div>
            </Link>
          );
        }

        const statusBadge = articleStatusBadge(article.status);
        const wordsLabel = article.word_count != null ? `${article.word_count.toLocaleString()} words` : '—';

        return (
          <div
            key={article.id}
            className={`article-list-card article-list-item group/selectable-item select-none relative flex w-full cursor-pointer${selectedIds.has(article.id) ? ' is-selected' : ''}`}
          >
            <ArticleCardHoverActions
              articleId={article.id}
              onDelete={onDelete}
              onSelect={toggleSelect}
            />

            {/* Left: Score gauge / Checkbox */}
            <div className="article-list-card-gauge">
              <div style={{ width: 48 }}>
                <div className="article-gauge-default">
                  <Gauge score={score ?? 0} size="sm" />
                </div>
                <div className="article-gauge-checkbox hidden">
                  <Checkbox
                    checked={selectedIds.has(article.id)}
                    onChange={() => toggleSelect(article.id)}
                    size="md"
                  />
                </div>
              </div>
            </div>

            {/* Main content — Figma article card (10218:665879) */}
            <div className="article-list-card-main">
              <Link href={`/articles/${article.id}`}>
                <a style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
              </Link>

              <div className="article-list-card-cols">
                <div className="article-list-card-copy">
                  <span className="article-list-card-title">
                    {article.title || '(untitled)'}
                  </span>
                  {article.target_keyword ? (
                    <span className="article-list-card-keyword">
                      {article.target_keyword}
                    </span>
                  ) : null}
                </div>

                <div className="article-list-card-meta">
                  <div className="article-list-card-meta-item">
                    <span className="article-list-card-meta-label">Words:</span>
                    <span className="article-list-card-meta-value">{wordsLabel}</span>
                  </div>
                  <div className="article-list-card-meta-item" suppressHydrationWarning>
                    <span className="article-list-card-meta-label">Updated:</span>
                    <span className="article-list-card-meta-value">
                      <span className="article-time-relative">{time?.relative || ''}</span>
                      <span className="article-time-full hidden">{time?.full || ''}</span>
                    </span>
                  </div>
                  {statusBadge ? (
                    <div className="article-list-card-meta-badge" style={{ position: 'relative', zIndex: 1 }}>
                      {statusBadge}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {typeof hasMore === 'boolean' && onLoadMore ? (
        <TableLoadMore
          hasMore={hasMore}
          isLoading={Boolean(isLoadingMore)}
          onLoadMore={onLoadMore}
        />
      ) : null}

      {/* ── Bulk selection bar ── */}
      {selectedIds.size > 0 && (
        <div
          className="article-bulk-bar"
          style={{
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 48,
            borderRadius: 8,
            background: 'var(--koala-bg-inverse)',
            boxShadow: '0px 8px 16px 0px rgba(24,26,34,0.12), 0px 2px 4px 0px rgba(24,26,34,0.06), 0px 1px 2px 0px rgba(0,0,0,0.08)',
          }}
        >
          {/* Deselect all */}
          <button
            type="button"
            onClick={clearSelection}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--koala-text-on-brand)',
              padding: 0,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.7'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
            </svg>
          </button>

          {/* Count */}
          <span
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: '16px',
              color: 'var(--koala-text-on-brand)',
              fontFamily: 'var(--font-family-primary)',
              fontWeight: 400,
              flex: 1,
            }}
          >
            {selectedIds.size} selected
          </span>

          {/* Put in trash */}
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={isDeleting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 24,
              background: 'color-mix(in srgb, var(--koala-status-danger) 12%, transparent)',
              border: 'none',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              fontSize: 13,
              lineHeight: '16px',
              color: 'var(--koala-status-danger)',
              fontFamily: 'var(--font-family-primary)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              opacity: isDeleting ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { if (!isDeleting) (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--koala-status-danger) 25%, transparent)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--koala-status-danger) 12%, transparent)'; }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" style={{ flexShrink: 0 }}>
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21q.512.078 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-1.935l-1.342-9.523m16.498 0a48.108 48.108 0 0 0-3.478-.397m-12 .562q.51-.088 1.022-.166m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            <span>
              {isDeleting ? 'Deleting…' : (
                <>
                  <span className="article-bulk-bar-trash-full">Put in trash</span>
                  <span className="article-bulk-bar-trash-short">Trash</span>
                </>
              )}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ArticleList;
