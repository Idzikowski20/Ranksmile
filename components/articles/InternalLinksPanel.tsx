import React, { useEffect, useState } from 'react';
import type { LinkSuggestion } from '../../pages/api/articles/suggest-internal-links';
import { getErrorMessage } from '../../lib/errors';
import DomainFavicon from '../common/DomainFavicon';
import { CompactSelect, DropdownButton } from '../koala/core';

export interface InsertResult {
  url: string;
  anchorText: string;
  success: boolean;
}

interface FetchedLink {
  url: string;
  title: string;
}

type Phase = 'idle' | 'fetching' | 'selecting' | 'inserting' | 'done';

interface Props {
  articleId: number;
  keyword: string;
  plainText: string;
  domainBaseUrl: string;
  /** GSC-connected domains the user can pick as the link source */
  domains?: DomainType[];
  onClose: () => void;
  /** Called with suggestions to insert; returns per-URL results */
  onInsertLinks: (links: Array<{ anchorText: string; url: string }>) => InsertResult[];
  onAiActivity?: (active: boolean) => void;
  articleKeywords?: string[];
  internalArticles?: Array<{ id: number; url: string }>;
}

const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'dark' | 'ghost' }> = ({
  variant = 'dark', style, children, ...rest
}) => (
  <button
    type="button"
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 8, border: 'none', cursor: rest.disabled ? 'not-allowed' : 'pointer',
      fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-family-primary)',
      padding: '9px 16px', transition: 'opacity 0.15s, background 0.15s',
      opacity: rest.disabled ? 0.45 : 1,
      ...(variant === 'dark'
        ? { background: 'var(--koala-text-primary)', color: 'var(--koala-bg-primary)' }
        : { background: 'transparent', color: 'var(--koala-text-secondary)', boxShadow: 'inset 0 0 0 1px var(--koala-border-primary)' }),
      ...style,
    }}
    {...rest}
  >
    {children}
  </button>
);

const Spinner = () => (
  <div style={{ width: 20, height: 20, border: '2.5px solid var(--koala-border-primary)', borderTopColor: 'var(--koala-text-brand)', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />
);

const InternalLinksPanel: React.FC<Props> = ({
  articleId, keyword, plainText, domainBaseUrl, domains, onClose, onInsertLinks, onAiActivity,
  articleKeywords, internalArticles,
}) => {
  const storageKey = `internal-links-${articleId}`;

  const loadSaved = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as { siteUrl: string; fetchedLinks: FetchedLink[]; checked: number[] };
    } catch { return null; }
  };

  const saved = loadSaved();

  const [phase, setPhase] = useState<Phase>(saved?.fetchedLinks?.length ? 'selecting' : 'idle');
  const [siteUrl, setSiteUrl] = useState(saved?.siteUrl || domainBaseUrl || '');
  const [fetchedLinks, setFetchedLinks] = useState<FetchedLink[]>(saved?.fetchedLinks || []);
  const [checked, setChecked] = useState<Set<number>>(new Set(saved?.checked ?? []));
  const [results, setResults] = useState<InsertResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [cachedSuggestions, setCachedSuggestions] = useState<LinkSuggestion[] | null>(null);
  const [sharedKeywordCounts, setSharedKeywordCounts] = useState<Record<string, number>>({});

  const hostOf = (u: string) => {
    if (!u) return '';
    try { return new URL(u).hostname.replace(/^www\./, ''); }
    catch { return u.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, ''); }
  };
  const selectedHost = hostOf(siteUrl);
  const articleHost = hostOf(domainBaseUrl);

  const siteOptions = (domains || []).map((d) => d.domain).filter(Boolean);
  const currentDomain = siteOptions.find((d) => d.replace(/^www\./, '') === selectedHost) ?? '';

  // Compute shared keyword counts when insertion is done
  useEffect(() => {
    if (phase !== 'done' || !articleKeywords?.length || !internalArticles?.length) return;
    const computeShared = async () => {
      const counts: Record<string, number> = {};
      const ourKws = new Set(articleKeywords.map(k => k.toLowerCase()));
      const fetches = results
        .filter(r => r.success)
        .map(async (r) => {
          try {
            const pathname = new URL(r.url).pathname;
            const matched = internalArticles.find(a => a.url === pathname || a.url.endsWith(pathname));
            if (matched) {
              const res = await fetch(`/api/articles/${matched.id}/keywords`);
              const data = await res.json();
              const linkedKws = (data.keywords || []).map((k: { keyword?: string }) => k.keyword?.toLowerCase()).filter(Boolean);
              const overlapping = linkedKws.filter((k: string) => ourKws.has(k)).length;
              return { url: r.url, overlapping };
            }
          } catch { /* skip */ }
          return null;
        });
      const results2 = await Promise.allSettled(fetches);
      for (const r of results2) {
        if (r.status === 'rejected') continue;
        const item = r.value;
        if (item) counts[item.url] = item.overlapping;
      }
      setSharedKeywordCounts(counts);
    };
    computeShared();
  }, [phase, results, articleKeywords, internalArticles]);

  useEffect(() => {
    onAiActivity?.(phase === 'fetching' || phase === 'inserting');
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist siteUrl + fetchedLinks + checked whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        siteUrl,
        fetchedLinks,
        checked: [...checked],
      }));
    } catch { /* quota exceeded or SSR */ }
  }, [siteUrl, fetchedLinks, checked, storageKey]);

  // ── Step 1: crawl the URL ──────────────────────────────────────────
  const handleRequestLinks = async () => {
    if (!siteUrl.trim()) return;
    setPhase('fetching');
    setError(null);
    try {
      const res = await fetch('/api/articles/fetch-site-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: siteUrl.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const links: FetchedLink[] = data.links || [];
      setFetchedLinks(links);
      setHint(data.hint || null);
      setChecked(new Set(links.map((_, i) => i))); // all pre-checked
      setPhase('selecting');
    } catch (err) {
      setError(getErrorMessage(err));
      setPhase('idle');
    }
  };

  // ── "Select recommended by Ranksmile" — AI filters which links fit the article ──
  const handleRecommend = async () => {
    if (!fetchedLinks.length || isRecommending) return;
    setIsRecommending(true);
    setError(null);
    try {
      const articles = fetchedLinks.map((l) => ({ id: 0, title: l.title, url: l.url }));
      const res = await fetch('/api/articles/suggest-internal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: 0, content: plainText, keyword, articles }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const suggestions: LinkSuggestion[] = data.suggestions || [];
      setCachedSuggestions(suggestions);

      // Check only the recommended URLs
      const recommendedUrls = new Set(suggestions.map((s) => s.url));
      const nextChecked = new Set<number>();
      fetchedLinks.forEach((l, i) => { if (recommendedUrls.has(l.url)) nextChecked.add(i); });
      setChecked(nextChecked);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsRecommending(false);
    }
  };

  // ── Step 2: insert checked links (use cached suggestions when available) ──
  const handleInsert = async () => {
    const selected = fetchedLinks.filter((_, i) => checked.has(i));
    if (!selected.length) return;
    setPhase('inserting');
    setError(null);

    let suggestions: LinkSuggestion[] = [];
    try {
      // If we already ran the AI recommendation, reuse those results for checked URLs
      if (cachedSuggestions) {
        const checkedUrls = new Set(selected.map((l) => l.url));
        suggestions = cachedSuggestions.filter((s) => checkedUrls.has(s.url));
        // For any checked URL not in cache, call API for those only
        const missing = selected.filter((l) => !suggestions.find((s) => s.url === l.url));
        if (missing.length) {
          const res = await fetch('/api/articles/suggest-internal-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articleId: 0, content: plainText, keyword, articles: missing.map((l) => ({ id: 0, title: l.title, url: l.url })) }),
          });
          const data = await res.json();
          if (!data.error) suggestions = [...suggestions, ...(data.suggestions || [])];
        }
      } else {
        const articles = selected.map((l) => ({ id: 0, title: l.title, url: l.url }));
        const res = await fetch('/api/articles/suggest-internal-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleId: 0, content: plainText, keyword, articles }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        suggestions = data.suggestions || [];
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setPhase('selecting');
      return;
    }

    const insertRes = onInsertLinks(suggestions.map((s) => ({ anchorText: s.anchorText, url: s.url })));
    const byUrl = new Map(insertRes.map((r) => [r.url, r]));
    const finalResults: InsertResult[] = selected.map((l) => byUrl.get(l.url) ?? { url: l.url, anchorText: '', success: false });
    setResults(finalResults);
    setPhase('done');
  };

  const toggleCheck = (i: number) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const checkedCount = checked.size;
  const insertedCount = results.filter((r) => r.success).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--koala-bg-primary)', fontFamily: 'var(--font-family-primary)', overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--koala-bg-secondary)', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => {
            if (phase === 'selecting' || phase === 'done') {
              setPhase('idle');
              setFetchedLinks([]);
              setChecked(new Set());
              setResults([]);
              setError(null);
              setHint(null);
              setCachedSuggestions(null);
              setSharedKeywordCounts({});
              try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
            } else {
              onClose();
            }
          }}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: 'none', background: 'var(--koala-bg-secondary)', color: 'var(--koala-text-secondary)', cursor: 'pointer', padding: 0, flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--koala-border-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--koala-bg-secondary)'; }}
        >
          <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0" clipRule="evenodd" />
          </svg>
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--koala-text-primary)', flex: 1 }}>Internal Links</span>

        {/* Score circle */}
        {phase === 'done' && (
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${insertedCount > 0 ? 'var(--koala-status-success)' : 'var(--koala-border-primary)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: insertedCount > 0 ? 'var(--koala-status-success)' : 'var(--koala-text-disabled)' }}>
            {insertedCount}
          </div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} className="styled-scrollbar">

        {/* ── IDLE ── */}
        {(phase === 'idle') && (
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--koala-text-secondary)', marginBottom: 8 }}>
              Site to add links from
            </div>

            {/* Site dropdown — pick a GSC-connected domain as the link source */}
            <CompactSelect
              search
              value={currentDomain}
              menuMinWidth="100%"
              emptyMessage={siteOptions.length === 0 ? 'No GSC domains connected.' : 'No sites found.'}
              options={siteOptions.map((d) => ({
                value: d,
                label: d,
                textValue: d,
                leadingItems: <DomainFavicon domain={d} size={20} />,
                details: d.replace(/^www\./, '') === articleHost ? 'Semantic links available' : 'Domain property',
              }))}
              onChange={(opt) => setSiteUrl(`https://${opt.value}/`)}
              trigger={(props, isOpen) => (
                <DropdownButton
                  {...props}
                  isOpen={isOpen}
                  size="sm"
                  prefix={selectedHost ? <DomainFavicon domain={selectedHost} size={18} /> : undefined}
                  style={{ width: '100%', fontFamily: 'var(--font-family-primary)' }}
                >
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedHost ? 'var(--koala-text-primary)' : 'var(--koala-text-disabled)' }}>
                    {selectedHost || 'Select a site'}
                  </span>
                </DropdownButton>
              )}
              menuBody={() => (
                <div style={{ padding: 4, borderTop: '1px solid var(--koala-border-primary)' }}>
                  <button
                    type="button"
                    onClick={() => { window.location.href = '/api/gsc/connect'; }}
                    style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-family-primary)', fontSize: 13, fontWeight: 600, color: 'var(--koala-text-secondary)', textAlign: 'left' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--koala-bg-secondary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    Add another Search Console account
                  </button>
                </div>
              )}
            />

            {error && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, color: 'var(--koala-status-danger)' }}>
                {error}
              </div>
            )}

            <p style={{ fontSize: 12, color: 'var(--koala-text-disabled)', marginTop: 12, lineHeight: '18px' }}>
              Pick a site — we&apos;ll scan its pages and suggest where to add internal links in your article.
            </p>
          </div>
        )}

        {/* ── FETCHING ── */}
        {phase === 'fetching' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '60px 0' }}>
            <Spinner />
            <span style={{ fontSize: 13, color: 'var(--koala-text-disabled)' }}>Fetching pages…</span>
          </div>
        )}

        {/* ── SELECTING ── checkbox list ── */}
        {phase === 'selecting' && (
          <div style={{ padding: '8px 0' }}>
            {fetchedLinks.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: 'var(--koala-text-disabled)' }}>
                No internal links found on that page.
                {hint && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--koala-status-warning-bg)', border: '1px solid var(--koala-status-warning-bg)', borderRadius: 6, fontSize: 12, color: '#92400e', lineHeight: '18px' }}>
                    {hint}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* "Link" section header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px 4px' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--koala-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 10 10" width={8} height={8} fill="none">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="var(--koala-bg-primary)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--koala-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Link</span>
                </div>

                {fetchedLinks.map((link, i) => (
                  <label
                    key={i}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', cursor: 'pointer' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--koala-bg-tertiary)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {/* Custom checkbox */}
                    <div
                      onClick={() => toggleCheck(i)}
                      style={{
                        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                        background: checked.has(i) ? 'var(--koala-text-brand)' : 'var(--koala-bg-primary)',
                        border: `1.5px solid ${checked.has(i) ? 'var(--koala-text-brand)' : 'var(--koala-border-secondary)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.12s',
                      }}
                    >
                      {checked.has(i) && (
                        <svg viewBox="0 0 10 10" width={8} height={8} fill="none">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="var(--koala-bg-primary)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* URL path */}
                    <span style={{ fontSize: 13, color: 'var(--koala-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(() => {
                        try { return new URL(link.url).pathname; } catch { return link.url; }
                      })()}
                    </span>
                  </label>
                ))}

                {error && (
                  <div style={{ margin: '8px 16px', padding: '10px 12px', background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, color: 'var(--koala-status-danger)' }}>
                    {error}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── INSERTING ── */}
        {phase === 'inserting' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '60px 0' }}>
            <Spinner />
            <span style={{ fontSize: 13, color: 'var(--koala-text-disabled)' }}>Finding anchor texts…</span>
          </div>
        )}

        {/* ── DONE ── results list ── */}
        {phase === 'done' && (
          <div style={{ padding: '8px 0' }}>
            {/* Summary row */}
            <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {insertedCount > 0 ? (
                <span style={{ fontSize: 13, color: 'var(--koala-status-success)', fontWeight: 600 }}>
                  ✓ {insertedCount} link{insertedCount !== 1 ? 's' : ''} added to article
                </span>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--koala-text-disabled)' }}>
                  No matching phrases found in article text.
                </span>
              )}
            </div>

            {results.map((r, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px' }}
              >
                {r.success ? (
                  <svg viewBox="0 0 16 16" width={16} height={16} fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="8" fill="var(--koala-status-success)" />
                    <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="var(--koala-bg-primary)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" width={16} height={16} fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="7.5" stroke="var(--koala-border-primary)" />
                    <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="var(--koala-text-disabled)" strokeWidth={1.5} strokeLinecap="round" />
                  </svg>
                )}
                <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.success ? 'var(--koala-text-secondary)' : 'var(--koala-text-disabled)', textDecoration: r.success ? 'none' : 'line-through' }}>
                  {(() => { try { return new URL(r.url).pathname; } catch { return r.url; } })()}
                </span>
                {r.success && r.anchorText && (
                  <span style={{ fontSize: 11, color: 'var(--koala-text-brand)', background: 'color-mix(in srgb, var(--koala-text-brand) 12%, transparent)', borderRadius: 4, padding: '1px 6px', flexShrink: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.anchorText}>
                    &ldquo;{r.anchorText}&rdquo;
                  </span>
                )}
                {r.success && sharedKeywordCounts[r.url] > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--koala-text-brand)', background: 'color-mix(in srgb, var(--koala-text-brand) 12%, transparent)', borderRadius: 4, padding: '1px 6px', flexShrink: 0, fontFamily: 'var(--font-family-primary)' }}>
                    {sharedKeywordCounts[r.url]} shared KW
                  </span>
                )}
              </div>
            ))}

            <div style={{ padding: '12px 16px 0', borderTop: '1px solid var(--koala-bg-secondary)', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => { setPhase('selecting'); setResults([]); setError(null); }}
                style={{ fontSize: 12, color: 'var(--koala-text-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-family-primary)' }}
              >
                ← Back to selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--koala-bg-secondary)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <Btn
            onClick={handleRequestLinks}
            disabled={!siteUrl.trim()}
            style={{ flex: 1 }}
          >
            Request links
          </Btn>
          {/* "..." menu placeholder */}
          <Btn variant="ghost" style={{ width: 38, padding: 0, flexShrink: 0 }}>
            <svg viewBox="0 0 20 20" width={16} height={16} fill="var(--koala-text-secondary)">
              <circle cx="4" cy="10" r="1.5" />
              <circle cx="10" cy="10" r="1.5" />
              <circle cx="16" cy="10" r="1.5" />
            </svg>
          </Btn>
        </div>
      )}

      {phase === 'selecting' && fetchedLinks.length > 0 && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--koala-bg-secondary)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Recommend button */}
          <button
            type="button"
            onClick={handleRecommend}
            disabled={isRecommending}
            style={{
              width: '100%', padding: '9px 16px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--koala-text-brand) 12%, transparent) 0%, #ede9fe 100%)',
              color: 'var(--koala-text-brand)', fontSize: 13, fontWeight: 600,
              cursor: isRecommending ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-family-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              opacity: isRecommending ? 0.7 : 1,
              transition: 'opacity 0.15s',
              boxShadow: 'inset 0 0 0 1px #ddd6fe',
            }}
          >
            {isRecommending ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid #c4b5fd', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />
                Analyzing…
              </>
            ) : (
              <>
                {/* Ranksmile sparkle icon */}
                <svg viewBox="0 0 16 16" width={14} height={14} fill="none">
                  <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5z" fill="#7c3aed" />
                </svg>
                Select recommended by Ranksmile
              </>
            )}
          </button>

          {/* Insert button */}
          <Btn
            onClick={handleInsert}
            disabled={checkedCount === 0}
            style={{ width: '100%' }}
          >
            Insert {checkedCount} link{checkedCount !== 1 ? 's' : ''}
          </Btn>
        </div>
      )}
    </div>
  );
};

export default InternalLinksPanel;
