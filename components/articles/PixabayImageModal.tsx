import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PixabayImage, PixabayResponse } from '../../pages/api/pixabay/search';

interface Props {
  defaultQuery?: string;
  onSelect: (image: { url: string; alt: string; width: number; height: number }) => void;
  onClose: () => void;
}

/* ── Shared style objects using design tokens ───────────────────────── */
const ACCENT = 'var(--color-surface-raised)';  // #783afb
const STRONG = 'var(--color-surface-strong)';    // #09090b
const BORDER_STRONG = 'var(--color-border-strong)'; // #221e28
const FF = 'var(--font-family-primary)';
const RADIUS_XS = 'var(--radius-xs)';  // 7px
const RADIUS_SM = 'var(--radius-sm)';  // 10.5px
const SPACE_5 = 'var(--space-5)';      // 10.5px
const SPACE_6 = 'var(--space-6)';      // 14px

const PixabayImageModal = ({ defaultQuery = '', onSelect, onClose }: Props) => {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<PixabayImage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const perPage = 21;

  const search = useCallback(async (q: string, p: number) => {
    if (!q.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pixabay/search?q=${encodeURIComponent(q)}&page=${p}&per_page=${perPage}`);
      const data: PixabayResponse & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.hits || []);
      setTotal(data.totalHits || 0);
      if (data.totalHits === 0) setError('No images found for this query.');
    } catch (err: any) {
      setError(err.message);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (defaultQuery) {
      search(defaultQuery, 1);
    }
    inputRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    search(query, 1);
  };

  const handleSelect = () => {
    const img = results.find((r) => r.id === selectedId);
    if (!img) return;
    onSelect({
      url: img.largeImageURL,
      alt: img.tags?.split(',')[0]?.trim() || query,
      width: img.imageWidth,
      height: img.imageHeight,
    });
    onClose();
  };

  // Keyboard: Enter on selected image confirms selection
  const handleImageKeyDown = (e: React.KeyboardEvent, imgId: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (imgId === selectedId) {
        handleSelect();
      } else {
        setSelectedId(imgId);
      }
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        role="dialog"
        aria-label="Search Pixabay images"
        style={{
          background: '#fff',
          borderRadius: RADIUS_SM,
          boxShadow: 'rgba(0, 0, 0, 0.05) 0px 1px 1px 0px, rgba(34, 42, 53, 0.04) 0px 4px 6px 0px, rgba(47, 48, 55, 0.05) 0px 24px 68px 0px, rgba(0, 0, 0, 0.04) 0px 2px 3px 0px',
          width: '100%', maxWidth: 720, maxHeight: '88vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${SPACE_6} 20px`, borderBottom: '1px solid #e4e4e7',
        }}>
          <h2 style={{
            margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 600, color: STRONG,
            fontFamily: FF,
          }}>
            Pixabay — Free Images
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: RADIUS_XS, border: 'none',
              background: 'transparent', cursor: 'pointer', color: '#9f9fa9',
              transition: 'background var(--motion-fast), color var(--motion-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f4f4f5';
              e.currentTarget.style.color = '#18181b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#9f9fa9';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{
          display: 'flex', gap: 8, padding: `var(--space-5) 20px`, borderBottom: '1px solid #f4f4f5',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search free images..."
            aria-label="Search Pixabay"
            style={{
              flex: 1, height: 38, padding: '0 var(--space-5)',
              border: '1px solid #d4d4d8', borderRadius: RADIUS_XS,
              fontSize: 'var(--font-size-sm)', color: '#18181b', outline: 'none',
              fontFamily: FF,
              boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
              transition: 'border-color var(--motion-fast)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 38, padding: '0 16px', borderRadius: RADIUS_XS, border: 'none',
              background: query.trim() ? ACCENT : '#d4d4d8',
              color: '#fff', fontSize: 'var(--font-size-sm)', fontWeight: 600, fontFamily: FF,
              cursor: query.trim() ? 'pointer' : 'not-allowed',
              transition: `background var(--motion-fast)`,
            }}
            onMouseEnter={(e) => {
              if (query.trim() && !isLoading) e.currentTarget.style.background = '#5a1fd6';
            }}
            onMouseLeave={(e) => {
              if (query.trim() && !isLoading) e.currentTarget.style.background = ACCENT;
            }}
          >
            {isLoading ? (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : 'Search'}
          </button>
        </form>

        <div
          style={{ flex: 1, overflowY: 'auto', padding: `var(--space-5) 20px`, minHeight: 300 }}
          className="styled-scrollbar"
        >
          {!error && !isLoading && results.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 8 }}>
              <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="m2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5m10.5-11.25h.008v.008h-.008zm.375 0a.375.375 0 1 1-.75 0a.375.375 0 0 1 .75 0" />
              </svg>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: '#9f9fa9', fontFamily: FF }}>
                Search for free stock images from Pixabay
              </p>
            </div>
          )}

          {error && !isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 8 }}>
              <p style={{ margin: 0, textAlign: 'center', color: '#9f9fa9', fontSize: 'var(--font-size-sm)', fontFamily: FF }}>
                {error}
              </p>
              <button
                type="button"
                onClick={() => search(query, 1)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: `${SPACE_5} ${SPACE_6}`, borderRadius: RADIUS_XS,
                  border: '1px solid #e4e4e7', background: '#fff',
                  fontSize: 'var(--font-size-sm)', color: '#52525c', fontWeight: 500,
                  cursor: 'pointer', fontFamily: FF,
                }}
              >
                Retry
              </button>
            </div>
          )}

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
              <div style={{
                width: 24, height: 24,
                border: '2px solid #e4e4e7',
                borderTopColor: ACCENT,
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-5)' }}>
                {results.map((img) => {
                  const isSelected = selectedId === img.id;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => setSelectedId(img.id)}
                      onKeyDown={(e) => handleImageKeyDown(e, img.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: 0,
                        border: isSelected ? `2px solid ${ACCENT}` : '2px solid transparent',
                        borderRadius: RADIUS_XS, cursor: 'pointer',
                        background: isSelected ? '#f8f5ff' : '#f8f8f9',
                        overflow: 'hidden',
                        transition: `border-color var(--motion-fast), background var(--motion-fast)`,
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${ACCENT}`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#f0f0f1';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#f8f8f9';
                      }}
                    >
                      <img
                        src={img.webformatURL}
                        alt={img.tags}
                        loading="lazy"
                        style={{
                          width: '100%', height: 130, objectFit: 'cover', display: 'block',
                        }}
                      />
                      <div style={{
                        padding: '4px 8px',
                        fontSize: 'var(--font-size-xs)',
                        color: isSelected ? ACCENT : '#71717a',
                        fontFamily: FF, fontWeight: isSelected ? 500 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        width: '100%', textAlign: 'center',
                        transition: `color var(--motion-fast)`,
                      }}>
                        {img.tags?.split(',')[0] || '—'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '16px 0',
                }}>
                  <button
                    type="button"
                    disabled={page <= 1}
                    aria-label="Previous page"
                    onClick={() => {
                      setPage((p) => {
                        const prev = p - 1;
                        search(query, prev);
                        return prev;
                      });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: 'var(--radius-xs)',
                      border: '1px solid #e4e4e7', background: '#fff',
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                      opacity: page <= 1 ? 0.4 : 1,
                      transition: `background var(--motion-fast)`,
                    }}
                    onMouseEnter={(e) => {
                      if (page > 1) e.currentTarget.style.background = '#f4f4f5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                    }}
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: '#52525c', fontFamily: FF }}>
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    aria-label="Next page"
                    onClick={() => {
                      setPage((p) => {
                        const next = p + 1;
                        search(query, next);
                        return next;
                      });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: 'var(--radius-xs)',
                      border: '1px solid #e4e4e7', background: '#fff',
                      cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                      opacity: page >= totalPages ? 0.4 : 1,
                      transition: `background var(--motion-fast)`,
                    }}
                    onMouseEnter={(e) => {
                      if (page < totalPages) e.currentTarget.style.background = '#f4f4f5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                    }}
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 'var(--space-5)', padding: `var(--space-5) 20px`, borderTop: '1px solid #f4f4f5',
        }}>
          <span style={{
            fontSize: 'var(--font-size-xs)', color: '#9f9fa9', fontFamily: FF, marginRight: 'auto',
          }}>
            {total > 0 ? `${total.toLocaleString()} images found` : 'Search to find images'}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 36, padding: '0 16px', borderRadius: RADIUS_XS,
              border: '1px solid #d4d4d8', background: '#fff',
              fontSize: 'var(--font-size-sm)', fontWeight: 500, color: '#52525c',
              cursor: 'pointer', fontFamily: FF,
              transition: `background var(--motion-fast)`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSelect}
            disabled={!selectedId}
            style={{
              height: 36, padding: '0 20px', borderRadius: RADIUS_XS,
              border: 'none',
              background: selectedId ? ACCENT : '#d4d4d8',
              color: '#fff', fontSize: 'var(--font-size-sm)', fontWeight: 600,
              cursor: selectedId ? 'pointer' : 'not-allowed',
              fontFamily: FF,
              transition: `background var(--motion-fast)`,
            }}
            onMouseEnter={(e) => {
              if (selectedId) e.currentTarget.style.background = '#5a1fd6';
            }}
            onMouseLeave={(e) => {
              if (selectedId) e.currentTarget.style.background = ACCENT;
            }}
          >
            Insert Image
          </button>
        </div>
      </div>
    </div>
  );
};

export default PixabayImageModal;
