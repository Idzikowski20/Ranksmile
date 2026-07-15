import React, { useEffect, useState } from 'react';
import DomainFavicon from '../common/DomainFavicon';

interface Heading {
  level: number;
  text: string;
}

interface Competitor {
  url: string;
  domain: string;
  title: string;
  serp_title?: string;
  snippet?: string;
  word_count: number;
  heading_count?: number;
  serp_position?: number;
  headings: Heading[];
}

interface Props {
  articleId: number;
  keyword: string;
  cachedOutlines: string | null;
  onClose: () => void;
}

/* ── Single competitor card ────────────────────────────────────────── */
const CompetitorCard = ({ competitor, defaultOpen }: { competitor: Competitor; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const domain = competitor.domain || (() => {
    try { return new URL(competitor.url).hostname.replace(/^www\./, ''); } catch { return competitor.url; }
  })();
  const pos = competitor.serp_position;

  return (
    <div style={{
      border: '1px solid #F4F4F5', borderRadius: 10, overflow: 'hidden',
      background: '#fff',
    }}>
      {/* Header row — click to expand */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer',
          gap: 10, textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ display: 'inline-flex', flexShrink: 0, width: 16, height: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
            <DomainFavicon domain={domain} size={16} style={{ borderRadius: 3 }} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Title */}
            <div style={{
              fontSize: 12, fontWeight: 600, color: '#18181b',
              fontFamily: 'var(--font-family-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {competitor.serp_title || competitor.title}
            </div>
            {/* Domain + stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#f29964', fontFamily: 'var(--font-family-primary)', fontWeight: 500 }}>
                {domain}
              </span>
              <span style={{ fontSize: 11, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>·</span>
              <span style={{ fontSize: 11, color: '#52525c', fontFamily: 'var(--font-family-primary)' }}>
                {competitor.word_count.toLocaleString()} words
              </span>
              {competitor.heading_count != null && (
                <>
                  <span style={{ fontSize: 11, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>·</span>
                  <span style={{ fontSize: 11, color: '#52525c', fontFamily: 'var(--font-family-primary)' }}>
                    {competitor.heading_count}h
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 1 }}>
          {/* SERP position badge */}
          {pos != null && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: pos <= 3 ? '#16a34a' : pos <= 7 ? '#d97706' : '#52525c',
              background: pos <= 3 ? '#f0fdf4' : pos <= 7 ? '#fffbeb' : '#f4f4f5',
              border: `1px solid ${pos <= 3 ? '#bbf7d0' : pos <= 7 ? '#fde68a' : '#e4e4e7'}`,
              borderRadius: 5, padding: '1px 5px', fontFamily: 'var(--font-family-primary)',
            }}>
              #{pos}
            </span>
          )}
          {/* Chevron */}
          <svg viewBox="0 0 20 20" width={14} height={14} fill="currentColor"
            style={{ color: '#9f9fa9', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {/* Heading outline — shown when expanded */}
      {open && (
        <div style={{ borderTop: '1px solid #f4f4f5' }}>
          {/* URL link */}
          <div style={{ padding: '6px 12px 4px' }}>
            <a
              href={competitor.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: 11, color: '#f29964', fontFamily: 'var(--font-family-primary)',
                textDecoration: 'none', wordBreak: 'break-all',
                display: 'block', lineHeight: 1.4,
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
            >
              {competitor.url.replace(/^https?:\/\//, '')}
            </a>
          </div>

          {/* Headings */}
          {competitor.headings.length > 0 ? (
            <div style={{ padding: '4px 12px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {competitor.headings.map((h, i) => {
                const indent = (h.level - 1) * 10;
                const isH1 = h.level === 1;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginLeft: indent }}>
                    <span style={{
                      fontSize: 10, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)',
                      flexShrink: 0, width: 16, textAlign: 'right', lineHeight: '18px',
                    }}>
                      h{h.level}
                    </span>
                    <span style={{
                      fontSize: 12, color: isH1 ? '#18181b' : '#3f3f47',
                      fontFamily: 'var(--font-family-primary)',
                      fontWeight: isH1 ? 600 : 400,
                      lineHeight: 1.4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={h.text}>
                      {h.text}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#9f9fa9', textAlign: 'center', padding: '8px 12px', fontFamily: 'var(--font-family-primary)', fontStyle: 'italic' }}>
              No headings found
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Main panel ────────────────────────────────────────────────────── */
const CompetitorOutlinesPanel: React.FC<Props> = ({ articleId, keyword, cachedOutlines, onClose }) => {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefHeadings, setBriefHeadings] = useState<Array<{ level: number; text: string }> | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const handleGenerateBrief = async () => {
    if (!keyword || briefLoading) return;
    setBriefLoading(true);
    setBriefHeadings(null);
    try {
      const mapped = competitors.map((c) => ({
        url: c.url,
        title: c.title,
        favicon: '',
        headings: c.headings,
        heading_count: c.heading_count ?? c.headings.length,
        word_count: c.word_count,
      }));
      const res = await fetch('/api/articles/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, competitors: mapped, articleId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed');
      setBriefHeadings(data.headings || []);
    } catch {
      setError('Could not generate brief from competitors.');
    } finally {
      setBriefLoading(false);
    }
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #f4f4f5', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 6, border: 'none',
              background: 'transparent', cursor: 'pointer', color: '#52525c',
              padding: 0, transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            title="Back"
          >
            <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0" clipRule="evenodd" />
            </svg>
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b', fontFamily: 'var(--font-family-primary)' }}>
            Competitors
          </span>
          {competitors.length > 0 && (
            <span style={{
              fontSize: 11, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)',
              background: '#f4f4f5', borderRadius: 20, padding: '1px 7px',
            }}>
              {competitors.length}
            </span>
          )}
        </div>
        {competitors.length > 0 && (
          <button
            type="button"
            disabled={briefLoading}
            onClick={handleGenerateBrief}
            style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: briefLoading ? 'wait' : 'pointer',
              background: '#18181b', color: '#fff', fontSize: 12, fontWeight: 600,
              fontFamily: 'var(--font-family-primary)', opacity: briefLoading ? 0.7 : 1,
            }}
          >
            {briefLoading ? 'Generating…' : 'Generate brief'}
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}
        className="styled-scrollbar">

        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                border: '1px solid #f4f4f5', borderRadius: 10, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ width: 16, height: 16, borderRadius: 3, background: '#ebebed', animation: 'editorSkeletonPulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '70%', height: 12, borderRadius: 4, background: '#ebebed', animation: 'editorSkeletonPulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.05}s` }} />
                  <div style={{ width: '40%', height: 10, borderRadius: 4, background: '#ebebed', marginTop: 6, animation: 'editorSkeletonPulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.1}s` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <p style={{ fontSize: 12, color: '#9f9fa9', textAlign: 'center', padding: '20px 0', fontFamily: 'var(--font-family-primary)', fontStyle: 'italic' }}>
            {error}
          </p>
        )}

        {!isLoading && !error && competitors.map((comp, i) => (
          <CompetitorCard key={comp.url + i} competitor={comp} defaultOpen={i === 0} />
        ))}

        {briefHeadings && briefHeadings.length > 0 && (
          <div style={{ marginTop: 8, padding: 12, border: '1px solid #f4f4f5', borderRadius: 12, background: '#fff' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#18181b', marginBottom: 8, fontFamily: 'var(--font-family-primary)' }}>
              Generated brief · {briefHeadings.length} headings
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {briefHeadings.map((h, idx) => (
                <div key={`${h.level}-${idx}`} style={{ fontSize: 13, color: '#52525c', paddingLeft: (h.level - 1) * 12, fontFamily: 'var(--font-family-primary)' }}>
                  H{h.level}: {h.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitorOutlinesPanel;
