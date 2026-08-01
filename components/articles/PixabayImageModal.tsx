import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PixabayImage, PixabayResponse } from '../../pages/api/pixabay/search';
import { getErrorMessage } from '../../lib/errors';
import Modal from '../koala/core/modal/modal';
import Button from '../koala/core/button/button';
import Input from '../koala/core/input/input';

interface Props {
  defaultQuery?: string;
  onSelect: (image: { url: string; alt: string; width: number; height: number }) => void;
  onClose: () => void;
}

/* ── Shared style objects using design tokens ───────────────────────── */
const ACCENT = 'var(--color-surface-raised)';  // #F84416
const STRONG = 'var(--color-surface-strong)';    // #09090b
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
    } catch (err) {
      setError(getErrorMessage(err));
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
    <Modal onClose={onClose} width={720} closeOnOverlayClick>
      <div
        role="dialog"
        aria-label="Search Pixabay images"
        style={{
          width: '100%',
          maxHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
          <Button
            type="button"
            variant="transparent"
            size="sm"
            onClick={onClose}
            aria-label="Close"
            icon={(
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            )}
          />
        </div>

        <form onSubmit={handleSubmit} style={{
          display: 'flex', gap: 8, padding: `var(--space-5) 20px`, borderBottom: '1px solid #f4f4f5',
        }}>
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search free images..."
            aria-label="Search Pixabay"
          />
          <Button type="submit" variant="primary" disabled={isLoading || !query.trim()} busy={isLoading}>
            Search
          </Button>
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
              <Button type="button" variant="secondary" onClick={() => search(query, 1)}>
                Retry
              </Button>
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
                        background: isSelected ? '#f8f5ff' : '#f3f4f0',
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
                        if (!isSelected) e.currentTarget.style.background = '#f3f4f0';
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
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    aria-label="Previous page"
                    onClick={() => {
                      setPage((p) => {
                        const prev = p - 1;
                        search(query, prev);
                        return prev;
                      });
                    }}
                    icon={(
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    )}
                  />
                  <span style={{ fontSize: 'var(--font-size-sm)', color: '#52525c', fontFamily: FF }}>
                    {page} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    aria-label="Next page"
                    onClick={() => {
                      setPage((p) => {
                        const next = p + 1;
                        search(query, next);
                        return next;
                      });
                    }}
                    icon={(
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    )}
                  />
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
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleSelect} disabled={!selectedId}>
            Insert Image
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PixabayImageModal;
