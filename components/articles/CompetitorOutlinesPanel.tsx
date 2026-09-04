import React, { useEffect, useMemo, useState } from 'react';
import DomainFavicon from '../common/DomainFavicon';
import { Gauge } from '../koala/core';
import { useCompetitors } from '../../services/competitors';

export interface CompetitorHeading {
  level: number;
  text: string;
}

export interface Competitor {
  url: string;
  domain: string;
  title: string;
  serp_title?: string;
  snippet?: string;
  word_count: number;
  heading_count?: number;
  serp_position?: number;
  headings: CompetitorHeading[];
  seoScore?: number;
}

const stripWww = (host: string): string => host.replace(/^www\./, '');

const domainOf = (c: Pick<Competitor, 'url' | 'domain'>): string => c.domain || (() => {
  try { return stripWww(new URL(c.url).hostname); } catch { return c.url; }
})();

/** Relative SEO score vs peer median — mirrors lib/competitorScan.ts. */
function peerSeoScore(comp: Competitor, all: Competitor[]): number {
  if (all.length === 0) return 0;
  const words = all.map((c) => c.word_count ?? 0).filter((n) => n > 0);
  const headings = all.map((c) => c.heading_count ?? 0).filter((n) => n > 0);
  const medianWords = words.length ? words.slice().sort((a, b) => a - b)[Math.floor(words.length / 2)] : 1;
  const medianHeadings = headings.length ? headings.slice().sort((a, b) => a - b)[Math.floor(headings.length / 2)] : 1;
  const wordScore = comp.word_count > 0 ? Math.min((comp.word_count / medianWords) * 100, 100) : 0;
  const headingScore = (comp.heading_count ?? 0) > 0 ? Math.min(((comp.heading_count ?? 0) / medianHeadings) * 100, 100) : 0;
  return Math.round(wordScore * 0.7 + headingScore * 0.3);
}

/**
 * The gauge on every card: the shared competitors store's scanned score when it has one,
 * otherwise the peer-relative estimate — so an outline under review and the unlocked
 * editor grade the same page the same way.
 */
export function withSeoScores(
  competitors: Competitor[],
  scanned: ReadonlyArray<{ url: string; domain?: string; seoScore?: number }> = [],
): Competitor[] {
  const byUrl = new Map(scanned.map((c) => [c.url.replace(/\/$/, ''), c]));
  const byDomain = new Map(scanned.map((c) => [stripWww(c.domain || ''), c]));
  return competitors.map((comp) => {
    const api = byUrl.get(comp.url.replace(/\/$/, '')) || byDomain.get(stripWww(domainOf(comp)));
    return { ...comp, seoScore: api?.seoScore ?? comp.seoScore ?? peerSeoScore(comp, competitors) };
  });
}

/* ── Single competitor card (read-only) ─────────────────────────────── */
export const CompetitorCard = ({ competitor, defaultOpen }: { competitor: Competitor; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const domain = domainOf(competitor);
  const seoScore = competitor.seoScore ?? 0;

  return (
    <div style={{ border: '1px solid var(--koala-bg-secondary)', borderRadius: 8, overflow: 'hidden', background: 'var(--koala-bg-tertiary)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '8px 10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          gap: 8,
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, flex: 1, minWidth: 0 }}>
          <span style={{ display: 'inline-flex', flexShrink: 0, width: 14, height: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
            <DomainFavicon domain={domain} size={14} style={{ borderRadius: 2 }} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--koala-text-primary)',
              fontFamily: 'var(--font-family-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {competitor.serp_title || competitor.title}
            </div>
            {/* Domain only. The word and heading counts are what the gauge is computed
                from, not something the reader acts on, and at this width they pushed the
                domain onto a second line. */}
            <div style={{
              fontSize: 11,
              marginTop: 2,
              color: 'var(--koala-text-brand)',
              fontFamily: 'var(--font-family-primary)',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {domain}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 1 }}>
          <div style={{ display: 'inline-flex', transform: 'scale(0.72)', transformOrigin: 'center right' }}>
            <Gauge score={seoScore} size="sm" />
          </div>
          <svg viewBox="0 0 20 20" width={13} height={13} fill="currentColor"
            style={{ color: 'var(--koala-text-disabled)', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none' }}>
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--koala-bg-secondary)', padding: '6px 10px 8px' }}>
          <a
            href={competitor.url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 10, color: 'var(--koala-text-brand)', fontFamily: 'var(--font-family-primary)', textDecoration: 'none', wordBreak: 'break-all', display: 'block', marginBottom: 6, lineHeight: 1.4 }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
          >
            {competitor.url.replace(/^https?:\/\//, '').substring(0, 60)}{competitor.url.length > 66 ? '…' : ''}
          </a>
          {competitor.headings.length > 0 ? competitor.headings.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginLeft: (h.level - 1) * 8, marginBottom: 1 }}>
              <span style={{ fontSize: 10, color: 'var(--koala-text-disabled)', fontFamily: 'var(--font-family-primary)', flexShrink: 0, width: 14, textAlign: 'right' }}>h{h.level}</span>
              <span style={{
                fontSize: 11,
                color: h.level === 1 ? 'var(--koala-text-primary)' : 'var(--koala-text-secondary)',
                fontFamily: 'var(--font-family-primary)',
                fontWeight: h.level === 1 ? 600 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }} title={h.text}>{h.text}</span>
            </div>
          )) : (
            <p style={{ fontSize: 12, color: 'var(--koala-text-disabled)', textAlign: 'center', padding: '8px 12px', fontFamily: 'var(--font-family-primary)', fontStyle: 'italic', margin: 0 }}>
              No headings found
            </p>
          )}
        </div>
      )}
    </div>
  );
};

interface Props {
  articleId: number;
  keyword: string;
  cachedOutlines: string | null;
  /** Workspace slug — loads scanned SEO scores from the shared competitors store. */
  domainSlug?: string;
  /**
   * Omitted when the panel *is* the side column rather than something opened on top of
   * it — there is nothing to go back to, so the back button is dropped with it.
   */
  onClose?: () => void;
}

/* ── Main panel ────────────────────────────────────────────────────── */
const CompetitorOutlinesPanel: React.FC<Props> = ({ articleId, keyword, cachedOutlines, domainSlug, onClose }) => {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanned = useCompetitors(domainSlug, keyword || undefined);
  const scored = useMemo(() => withSeoScores(competitors, scanned.data?.competitors), [competitors, scanned.data]);

  useEffect(() => {
    // Try cache first
    if (cachedOutlines) {
      try {
        const parsed = JSON.parse(cachedOutlines);
        const list: Competitor[] = Array.isArray(parsed) ? parsed : (parsed.competitors || []);
        if (list.length > 0) {
          setCompetitors(list);
          return;
        }
      } catch { /* ignore — fall through to fetch */ }
    }

    // Fetch from API
    if (!keyword) return;
    setIsLoading(true);
    setError(null);
    fetch('/api/articles/competitor-outlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, num: 5, articleId }),
    })
      .then((r) => r.json())
      .then((d) => {
        const list: Competitor[] = Array.isArray(d) ? d : (d.competitors || []);
        setCompetitors(list);
        if (list.length === 0) setError('No competitors found for this keyword.');
      })
      .catch(() => setError('Failed to load competitor data.'))
      .finally(() => setIsLoading(false));
  }, [articleId, keyword, cachedOutlines]);

  return (
    // flex + minHeight 0, not height 100%: the parent is a flex column, and a percentage
    // height inside one let the list grow past the card, where `overflow: hidden` cut
    // the last competitors off with no scrollbar to reach them.
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--koala-bg-secondary)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 6, border: 'none',
              background: 'transparent', cursor: 'pointer', color: 'var(--koala-text-secondary)',
              padding: 0, transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--koala-bg-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            title="Back"
          >
            <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0" clipRule="evenodd" />
            </svg>
          </button>
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)' }}>
            Competitors
          </span>
          {competitors.length > 0 && (
            <span style={{
              fontSize: 11, color: 'var(--koala-text-disabled)', fontFamily: 'var(--font-family-primary)',
              background: 'var(--koala-bg-secondary)', borderRadius: 20, padding: '1px 7px',
            }}>
              {competitors.length}
            </span>
          )}
        </div>
      </div>

      {/* Content — the only scroll container; minHeight 0 is what lets it scroll at all. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}
        className="styled-scrollbar">

        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                border: '1px solid var(--koala-bg-secondary)', borderRadius: 10, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ width: 16, height: 16, borderRadius: 3, background: 'var(--koala-bg-secondary)', animation: 'skeletonPulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '70%', height: 12, borderRadius: 4, background: 'var(--koala-bg-secondary)', animation: 'skeletonPulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.05}s` }} />
                  <div style={{ width: '40%', height: 10, borderRadius: 4, background: 'var(--koala-bg-secondary)', marginTop: 6, animation: 'skeletonPulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.1}s` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <p style={{ fontSize: 12, color: 'var(--koala-text-disabled)', textAlign: 'center', padding: '20px 0', fontFamily: 'var(--font-family-primary)', fontStyle: 'italic' }}>
            {error}
          </p>
        )}

        {!isLoading && !error && scored.map((comp, i) => (
          <CompetitorCard key={comp.url + i} competitor={comp} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
};

export default CompetitorOutlinesPanel;
