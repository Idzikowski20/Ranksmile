import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Gauge } from '../core';
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
    topicalMap: string;
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
    <rect x="7" y="9" width="28" height="24" rx="5" fill="#F4F4F5" stroke="#D4D4D8" strokeWidth="1.5" />
    <path d="M14 17h14M14 22h10M14 27h14" stroke="#3F3F47" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ContentAuditIcon = () => (
  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
    <rect x="9" y="7" width="19" height="26" rx="4" fill="#F0FDF4" stroke="#1AB25E" strokeWidth="1.5" />
    <path d="M14 15h9M14 20h7M14 25h5" stroke="#137832" strokeWidth="2" strokeLinecap="round" />
    <circle cx="29" cy="28" r="5" fill="#FFFFFF" stroke="#137832" strokeWidth="2" />
    <path d="m32.8 31.8 3.2 3.2" stroke="#137832" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const TopicalMapIcon = () => (
  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
    <path d="M21 5.5 34.4 13v15L21 35.5 7.6 28V13L21 5.5Z" fill="#FDE8D8" stroke="#F29964" strokeWidth="1.5" />
    <path d="M21 20.5 34 13M21 20.5 8 13M21 20.5v14" stroke="#F29964" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="21" cy="20.5" r="3.5" fill="#F29964" />
  </svg>
);

type EmptyStartOptionKey = 'recommendations' | 'keyword' | 'contentAudit' | 'topicalMap';

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
  {
    key: 'topicalMap',
    title: 'Topical Map',
    description: 'Create content based on your existing topics',
    href: '/dashboard',
    icon: <TopicalMapIcon />,
  },
];

const ArticleList = ({ articles, onDelete, onDeleteMultiple, isLoading, hasMore, onLoadMore, isLoadingMore, startLinks }: Props) => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore || isLoadingMore) return undefined;
    const el = loadMoreRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) onLoadMore();
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, onLoadMore, isLoadingMore]);
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Close menu on outside click / scroll / resize (fixed portal follows neither)
  useEffect(() => {
    if (openMenuId === null) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || menuBtnRef.current?.contains(t)) return;
      setOpenMenuId(null);
      setMenuPos(null);
    };
    const close = () => {
      setOpenMenuId(null);
      setMenuPos(null);
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openMenuId]);

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
              border: '1px solid #E4E4E7',
              borderRadius: 12,
              gap: 12,
              animation: 'skeletonPulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.08}s`,
            }}
          >
            {/* Left: score gauge placeholder */}
            <div style={{ width: 84, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F0F0F4' }} />
            </div>
            {/* Title + meta */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ width: '45%', height: 16, borderRadius: 6, background: '#F0F0F4' }} />
              <div style={{ width: '28%', height: 12, borderRadius: 6, background: '#F5F5F9' }} />
            </div>
            {/* Right: status/date placeholders */}
            <div style={{ paddingRight: 24, display: 'flex', gap: 16, flexShrink: 0 }}>
              <div style={{ width: 60, height: 12, borderRadius: 6, background: '#F5F5F9' }} />
              <div style={{ width: 40, height: 12, borderRadius: 6, background: '#F5F5F9' }} />
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
        <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 600, color: '#71717B' }}>
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
                  border: '1px solid #E4E4E7',
                  borderRadius: 16,
                  background: '#FFFFFF',
                  color: '#18181B',
                  textDecoration: 'none',
                  transition: 'border-color 150ms ease, background 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#D4D4D8';
                  e.currentTarget.style.background = '#f3f4f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E4E4E7';
                  e.currentTarget.style.background = '#FFFFFF';
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#F5C4A0';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(242,153,100,0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E4E4E7';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  style={{
                    height: 82,
                    borderRadius: 12,
                    background: '#f3f4f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {option.icon}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 16, color: '#18181B' }}>
                  <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600 }}>
                    {option.title}
                  </span>
                  <EmptyCardArrow />
                </div>
                <span style={{ marginTop: 4, fontSize: 14, lineHeight: '20px', color: '#71717B' }}>
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
    <div className="article-list" style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 0, maxWidth: '100%' }}>
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
                border: '1px solid #E4E4E7',
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
                    color: '#3F3F47',
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
                    color: '#9F9FA9',
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
                  color: '#9F9FA9',
                  flexShrink: 0,
                  transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#dc2626';
                  (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#9F9FA9';
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

        return (
          <div
            key={article.id}
            className={`article-list-card article-list-item group/selectable-item select-none gap-md relative flex h-[133px] w-full items-center justify-between border border-solid hover:shadow-sm cursor-pointer pr-lg border-gray-20 rounded-xl${selectedIds.has(article.id) ? ' is-selected' : ''}`}
            style={{
              height: 133,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px solid #E4E4E7',
              borderRadius: 12,
              paddingRight: 24,
              gap: 12,
              userSelect: 'none',
              cursor: 'pointer',
              minWidth: 0,
              maxWidth: '100%',
              boxSizing: 'border-box',
              boxShadow: 'none',
              transition: 'border-color 0.2s, box-shadow 0.12s ease',
            }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0px 6px 10px 0px rgba(24,26,34,0.06)'; el.style.borderColor = '#D4D4D8'; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = 'none'; el.style.borderColor = '#E4E4E7'; }}
          >
            {/* Left: Score gauge / Checkbox */}
            <div
              className="article-list-card-gauge group flex h-full items-center justify-between border-r hover:border-gray-10 border-transparent pl-lg pr-md"
              style={{
                display: 'flex',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRight: '1px solid transparent',
                paddingLeft: 24,
                paddingRight: 12,
                flexShrink: 0,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderRightColor = '#F4F4F5'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderRightColor = 'transparent'; }}
            >
              <div style={{ width: 48 }}>
                {/* Score gauge — visible by default, hidden on group hover */}
                <div className="article-gauge-default">
                  <Gauge score={score ?? 0} size="sm" />
                </div>
                {/* Checkbox — hidden by default, shown on group hover */}
                <div className="article-gauge-checkbox hidden">
                  <label
                    style={{
                      fontSize: 16,
                      lineHeight: '24px',
                      color: '#2F2F34',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      position: 'relative',
                    }}
                  >
                    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(article.id)}
                        onChange={() => toggleSelect(article.id)}
                        style={{
                          margin: 0,
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          border: '1px solid #D4D4D8',
                          background: selectedIds.has(article.id) ? '#F29964' : '#fff',
                          boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
                          cursor: 'pointer',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          flexShrink: 0,
                          display: 'grid',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.25s, border-color 0.25s',
                        }}
                      />
                      {selectedIds.has(article.id) && (
                        <svg
                          viewBox="0 0 20 20"
                          width="16"
                          height="16"
                          style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            color: '#fff',
                            pointerEvents: 'none',
                          }}
                        >
                          <path fill="currentColor" fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Main content */}
            <div className="article-list-card-main" style={{ position: 'relative', display: 'flex', height: '100%', flex: 1, alignItems: 'center', justifyContent: 'space-between', minWidth: 0, overflow: 'hidden' }}>
              <Link href={`/articles/${article.id}`}>
                <a style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
              </Link>

              <div className="article-list-card-cols" style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minWidth: 0, paddingRight: 4 }}>
                {/* Top row: title + meta */}
                <div className="article-list-card-top" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                      <span
                        className="article-list-card-title"
                        style={{
                          fontSize: 14,
                          lineHeight: '20px',
                          fontWeight: 600,
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: '#2F2F34',
                          fontFamily: 'var(--font-family-primary)',
                        }}
                      >
                        {article.title || '(untitled)'}
                      </span>
                    </div>
                    {article.target_keyword && (
                      <span
                        className="article-list-card-keyword"
                        style={{
                          fontSize: 14,
                          lineHeight: '20px',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: '#3F3F47',
                          fontFamily: 'var(--font-family-primary)',
                        }}
                      >
                        {article.target_keyword}
                      </span>
                    )}
                  </div>

                  {/* Right meta: status check, avatar, menu */}
                  <div className="article-list-card-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 1, flexShrink: 0 }}>
                    {/* Check icon if accepted or published */}
                    {(article.status === 'accepted' || article.status === 'published') && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#16a34a',
                          padding: 0,
                          flexShrink: 0,
                        }}
                        title={article.status === 'published' ? 'Published' : 'Accepted'}
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20">
                          <path fill="currentColor" fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12m13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}

                    {/* Avatar */}
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: '#F4F4F5',
                        color: '#09090B',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        fontFamily: 'var(--font-family-primary)',
                        flexShrink: 0,
                        position: 'relative',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                        b
                      </span>
                    </div>

                    {/* Triple-dot menu — dropdown portaled to body (cards/panels clip overflow) */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        ref={openMenuId === article.id ? menuBtnRef : undefined}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (openMenuId === article.id) {
                            setOpenMenuId(null);
                            setMenuPos(null);
                            return;
                          }
                          const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          const menuW = 220;
                          setMenuPos({
                            top: r.bottom + 4,
                            left: Math.max(8, Math.min(r.right - menuW, window.innerWidth - menuW - 8)),
                          });
                          setOpenMenuId(article.id);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#3F3F47',
                          padding: 0,
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.7'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M19 13C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11C18.4477 11 18 11.4477 18 12C18 12.5523 18.4477 13 19 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M5 13C5.55228 13 6 12.5523 6 12C6 11.4477 5.55228 11 5 11C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      {openMenuId === article.id && menuPos && mounted && createPortal(
                        <div
                          ref={menuRef}
                          style={{
                            position: 'fixed',
                            top: menuPos.top,
                            left: menuPos.left,
                            zIndex: 10000,
                            display: 'flex',
                            flexDirection: 'column',
                            padding: 6,
                            borderRadius: 8,
                            background: '#fff',
                            boxShadow: '0px 8px 16px 0px rgba(24,26,34,0.06), 0px 2px 8px 0px rgba(24,26,34,0.03), 0px 1px 2px 0px rgba(24,26,34,0.06)',
                            border: '1px solid #F4F4F5',
                            minWidth: 220,
                            animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)',
                            transformOrigin: '100% 0',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            role="button"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '8px 12px', borderRadius: 6,
                              fontSize: 14, fontWeight: 500, color: '#2F2F34',
                              cursor: 'pointer', transition: 'background 0.12s',
                              fontFamily: 'var(--font-family-primary)',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f3f4f0'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                            onClick={() => { setOpenMenuId(null); setMenuPos(null); }}
                          >
                            <svg viewBox="0 0 24 24" width="20" height="20" style={{ flexShrink: 0 }}>
                              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186m0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185" />
                            </svg>
                            Get shareable link
                          </div>

                          <div style={{ height: 1, background: '#F4F4F5', margin: '4px -6px' }} />

                          <div
                            role="button"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '8px 12px', borderRadius: 6,
                              fontSize: 14, fontWeight: 500, color: '#EF4444',
                              cursor: 'pointer', transition: 'background 0.12s',
                              fontFamily: 'var(--font-family-primary)',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#FEF2F2'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                            onClick={() => { setOpenMenuId(null); setMenuPos(null); onDelete(article.id); }}
                          >
                            <svg viewBox="0 0 24 24" width="20" height="20" style={{ flexShrink: 0 }}>
                              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21q.512.078 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48 48 0 0 0-3.478-.397m-12 .562q.51-.088 1.022-.165m0 0a48 48 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a52 52 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a49 49 0 0 0-7.5 0" />
                            </svg>
                            Delete
                          </div>
                        </div>,
                        document.body,
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom row: country + timestamp */}
                <div className="article-list-card-bottom" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 }}>
                  {/* Left tags */}
                  {/* Right: country + timestamp */}
                  <div className="article-list-card-loc" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minWidth: 0 }}>
                    {/* Country */}
                    <div className="article-list-card-country" style={{ display: 'flex', alignItems: 'center', fontSize: 13, lineHeight: '16px', color: '#3F3F47', gap: 2, fontFamily: 'var(--font-family-primary)' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" style={{ flexShrink: 0 }}>
                        <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
                      </svg>
                      <span>Poland</span>
                    </div>

                    {/* Timestamp */}
                    <div style={{ fontSize: 13, lineHeight: '16px', color: '#3F3F47', whiteSpace: 'nowrap', fontFamily: 'var(--font-family-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }} suppressHydrationWarning>
                      <span className="article-time-relative">{time?.relative || ''}</span>
                      <span className="article-time-full hidden">{time?.full || ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {hasMore ? (
        <div ref={loadMoreRef} className="text-gray-80 text-md py-lg block text-center" style={{ fontFamily: 'var(--font-family-primary)' }}>
          {isLoadingMore ? 'Loading more…' : ''}
        </div>
      ) : (
        <div className="text-gray-80 text-md py-lg block text-center" style={{ fontFamily: 'var(--font-family-primary)' }}>
          No more results found.
        </div>
      )}

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
            background: '#18181B',
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
              color: '#fff',
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
              color: '#fff',
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
              background: '#EF444420',
              border: 'none',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              fontSize: 13,
              lineHeight: '16px',
              color: '#FCA5A5',
              fontFamily: 'var(--font-family-primary)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              opacity: isDeleting ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { if (!isDeleting) (e.currentTarget as HTMLButtonElement).style.background = '#EF444440'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#EF444420'; }}
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
