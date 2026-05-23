import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScoreData, NlpTerm, countOccurrences, computeContentScore } from '../../lib/contentScore';
import { computeOpportunityScore } from '../../lib/keywordEnrichment';
import ScoreGauge from './ScoreGauge';
import KeywordResearchSection from './KeywordResearchSection';

interface CompetitorHeading {
  level: number;
  text: string;
}
interface Competitor {
  url: string;
  domain: string;
  title: string;
  serp_title?: string;
  word_count: number;
  heading_count?: number;
  serp_position?: number;
  headings: CompetitorHeading[];
}

interface Props {
  plainText: string;
  wordCount: number;
  headingCount: number;
  scoreData: ScoreData;
  internalLinksCount?: number;
  html?: string;
  keyword?: string;
  onAutoOptimize?: () => void;
  isAutoOptimizing?: boolean;
  onInternalLinks?: () => void;
  articleId?: number;
  cachedOutlines?: string | null;
}

/* ── Small circular progress ───────────────────────────────────────── */
const CircleProgress = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const r = 7, circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <svg width={16} height={16} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={8} cy={8} r={r} fill="none" stroke="#e4e4e7" strokeWidth={2} />
      <circle cx={8} cy={8} r={r} fill="none" stroke={color} strokeWidth={2}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.3s' }} />
    </svg>
  );
};

/* ── Metric column ─────────────────────────────────────────────────── */
const MetricCol = ({ label, current, range }: { label: string; current: number; range: string }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
    <span style={{ fontSize: 12, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>{label}</span>
    <span style={{ fontSize: 14, fontWeight: 600, color: '#09090b', fontFamily: 'var(--font-family-primary)', lineHeight: 1 }}>{current.toLocaleString()}</span>
    <span style={{ fontSize: 11, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)', textAlign: 'center' }}>{range}</span>
  </div>
);

/* ── Collapsible section header ─────────────────────────────────────── */
const SectionRow = ({ num, label, open, onToggle, badge }: {
  num: number; label: string; open?: boolean; onToggle?: () => void; badge?: React.ReactNode;
}) => (
  <button
    onClick={onToggle}
    style={{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', background: 'transparent',
      border: 'none', borderTop: '1px solid #f4f4f5', cursor: 'pointer',
      transition: 'opacity 0.15s', fontFamily: 'var(--font-family-primary)',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 400, color: '#9f9fa9' }}>#{num}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{label}</span>
      {badge}
    </div>
    <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor"
      style={{ color: '#9f9fa9', flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
      <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
    </svg>
  </button>
);

/* ── Action row (non-expandable) ────────────────────────────────────── */
const ActionRow = ({ num, label, onClick }: { num: number; label: string; onClick?: () => void }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', background: 'transparent',
      border: 'none', borderTop: '1px solid #f4f4f5', cursor: 'pointer',
      transition: 'opacity 0.15s', fontFamily: 'var(--font-family-primary)',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 400, color: '#9f9fa9' }}>#{num}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{label}</span>
    </div>
    <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor" style={{ color: '#9f9fa9', flexShrink: 0 }}>
      <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
    </svg>
  </button>
);

/* ── Competitor card (inline, read-only) ────────────────────────────── */
const CompetitorCard = ({ competitor, defaultOpen }: { competitor: Competitor; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const domain = competitor.domain || (() => {
    try { return new URL(competitor.url).hostname.replace(/^www\./, ''); } catch { return competitor.url; }
  })();
  const pos = competitor.serp_position;

  return (
    <div style={{ border: '1px solid #f4f4f5', borderRadius: 8, overflow: 'hidden', background: '#fafafa' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, flex: 1, minWidth: 0 }}>
          <img
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
            alt="" width={14} height={14}
            style={{ borderRadius: 2, marginTop: 2, flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: '#18181b', fontFamily: 'var(--font-family-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {competitor.serp_title || competitor.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <span style={{ fontSize: 11, color: '#783afb', fontFamily: 'var(--font-family-primary)', fontWeight: 500 }}>{domain}</span>
              <span style={{ fontSize: 11, color: '#9f9fa9' }}>·</span>
              <span style={{ fontSize: 11, color: '#52525c', fontFamily: 'var(--font-family-primary)' }}>
                {competitor.word_count.toLocaleString()}w
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginTop: 1 }}>
          {pos != null && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: pos <= 3 ? '#16a34a' : pos <= 7 ? '#d97706' : '#52525c',
              background: pos <= 3 ? '#f0fdf4' : pos <= 7 ? '#fffbeb' : '#f4f4f5',
              border: `1px solid ${pos <= 3 ? '#bbf7d0' : pos <= 7 ? '#fde68a' : '#e4e4e7'}`,
              borderRadius: 4, padding: '1px 5px', fontFamily: 'var(--font-family-primary)',
            }}>#{pos}</span>
          )}
          <svg viewBox="0 0 20 20" width={13} height={13} fill="currentColor"
            style={{ color: '#9f9fa9', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none' }}>
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #f4f4f5', padding: '6px 10px 8px' }}>
          <a
            href={competitor.url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 10, color: '#783afb', fontFamily: 'var(--font-family-primary)', textDecoration: 'none', wordBreak: 'break-all', display: 'block', marginBottom: 6, lineHeight: 1.4 }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
          >
            {competitor.url.replace(/^https?:\/\//, '').substring(0, 60)}{competitor.url.length > 66 ? '…' : ''}
          </a>
          {competitor.headings.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginLeft: (h.level - 1) * 8, marginBottom: 1 }}>
              <span style={{ fontSize: 10, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)', flexShrink: 0, width: 14, textAlign: 'right' }}>h{h.level}</span>
              <span style={{
                fontSize: 11, color: h.level === 1 ? '#18181b' : '#3f3f47',
                fontFamily: 'var(--font-family-primary)', fontWeight: h.level === 1 ? 600 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4,
              }} title={h.text}>{h.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Main panel ────────────────────────────────────────────────────── */
const ContentScorePanel = ({
  plainText,
  wordCount,
  headingCount,
  scoreData,
  internalLinksCount,
  html,
  keyword,
  onAutoOptimize,
  isAutoOptimizing,
  onInternalLinks,
  articleId,
  cachedOutlines,
}: Props) => {
  const [terms, setTerms] = useState<NlpTerm[]>([]);
  const [score, setScore] = useState(0);
  const [nlpOpen, setNlpOpen] = useState(false);
  const [competitorOpen, setCompetitorOpen] = useState(false);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isLoadingCompetitors, setIsLoadingCompetitors] = useState(false);

  // Keyword research state
  const [keywords, setKeywords] = useState<any[]>([]);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const [suggestedKeywords, setSuggestedKeywords] = useState<any[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [gapKeywords, setGapKeywords] = useState<any[]>([]);

  const paragraphCount = useMemo(() => {
    return plainText.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
  }, [plainText]);

  const scoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!scoreData?.terms) return;
    const updated = scoreData.terms.map((t) => ({
      ...t,
      current_count: countOccurrences(plainText, t.term),
    }));
    setTerms(updated);
  }, [plainText, scoreData]);

  useEffect(() => {
    if (!scoreData?.terms) return;
    if (scoreTimerRef.current) clearTimeout(scoreTimerRef.current);
    scoreTimerRef.current = setTimeout(() => {
      scoreTimerRef.current = null;
      const paraCount = plainText.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
      const kwCov = keywords.map((k: any) => ({ keyword: k.keyword, is_covered: k.is_covered }));
      setScore(computeContentScore(plainText, wordCount, headingCount, scoreData, paraCount, internalLinksCount, html, keyword, kwCov));
    }, 400);
    return () => {
      if (scoreTimerRef.current) clearTimeout(scoreTimerRef.current);
    };
  }, [plainText, wordCount, headingCount, scoreData, internalLinksCount, html, keyword, keywords]);

  const coveredCount = terms.filter((t) => (t.current_count ?? 0) >= t.target_count).length;

  // Load competitors when section opens
  useEffect(() => {
    if (!competitorOpen) return;
    if (competitors.length > 0) return; // already loaded

    // Try cache first
    if (cachedOutlines) {
      try {
        const parsed = JSON.parse(cachedOutlines);
        const list: Competitor[] = Array.isArray(parsed) ? parsed : (parsed.competitors || []);
        if (list.length > 0) { setCompetitors(list); return; }
      } catch { /* fall through */ }
    }

    // Fetch from API
    if (!keyword || !articleId) return;
    setIsLoadingCompetitors(true);
    fetch('/api/articles/competitor-outlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, language: 'pl', num: 5, articleId }),
    })
      .then((r) => r.json())
      .then((d) => {
        const list: Competitor[] = Array.isArray(d) ? d : (d.competitors || []);
        setCompetitors(list);
      })
      .catch(() => {})
      .finally(() => setIsLoadingCompetitors(false));
  }, [competitorOpen, keyword, articleId, cachedOutlines]);

  // Fetch keywords when NLP section opens
  useEffect(() => {
    if (!nlpOpen || !articleId) return;
    setIsLoadingKeywords(true);
    fetch(`/api/articles/${articleId}/keywords`)
      .then(r => r.json())
      .then(d => {
        const kws = (d.keywords || []).map((k: any) => ({
          ...k,
          is_covered: !!k.is_covered,
          opportunity_score: computeOpportunityScore({
            gsc_position: k.gsc_position,
            ads_monthly_volume: k.ads_monthly_volume,
            ads_competition: k.ads_competition,
            is_covered: !!k.is_covered,
          }),
        }));
        setKeywords(kws);
      })
      .catch(() => {})
      .finally(() => setIsLoadingKeywords(false));
  }, [nlpOpen, articleId]);

  // Auto-enrich on first load if no keywords have ads_monthly_volume
  useEffect(() => {
    if (!nlpOpen || !articleId || keywords.length === 0) return;
    const hasEnriched = keywords.some((k: any) => k.ads_monthly_volume != null);
    if (!hasEnriched && plainText) {
      fetch(`/api/articles/${articleId}/keywords/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywords.map((k: any) => k.keyword),
          targetKeyword: keyword,
          plainText,
        }),
      }).then(r => r.json()).then(d => {
        if (d.keywords) {
          setKeywords(d.keywords.map((k: any) => ({
            ...k,
            is_covered: !!k.is_covered,
            opportunity_score: computeOpportunityScore({
              gsc_position: k.gsc_position,
              ads_monthly_volume: k.ads_monthly_volume,
              ads_competition: k.ads_competition,
              is_covered: !!k.is_covered,
            }),
          })));
        }
      }).catch(() => {});
    }
  }, [nlpOpen, keywords.length]);

  // Fetch gap keywords from competitor outlines
  useEffect(() => {
    if (!nlpOpen || !articleId) return;
    fetch(`/api/articles/${articleId}/keywords/gap`)
      .then(r => r.json())
      .then(d => {
        setGapKeywords((d.gapKeywords || []).map((g: any) => ({
          keyword: g.keyword,
          frequency: g.frequency,
        })));
      })
      .catch(() => {});
  }, [nlpOpen, articleId]);

  const handleSuggest = async () => {
    if (!articleId) return;
    setIsSuggesting(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/keywords/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetKeyword: keyword }),
      });
      const data = await res.json();
      setSuggestedKeywords(data.suggestions || []);
    } catch { /* ignore */ }
    finally { setIsSuggesting(false); }
  };

  const handleAcceptSuggestion = async (kw: any) => {
    setSuggestedKeywords(prev => prev.filter(k => k.keyword !== kw.keyword));
    setKeywords(prev => [...prev, {
      ...kw,
      keyword: kw.keyword,
      source: 'ads_suggestion',
      is_covered: false,
      ads_monthly_volume: kw.avgMonthlySearches || kw.ads_monthly_volume || 0,
      ads_competition: kw.competition,
      opportunity_score: computeOpportunityScore({ gsc_position: null, ads_monthly_volume: kw.avgMonthlySearches || kw.ads_monthly_volume || 0, ads_competition: kw.competition, is_covered: false }),
    }]);
    if (articleId) {
      fetch(`/api/articles/${articleId}/keywords/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: [kw.keyword],
          targetKeyword: keyword,
          plainText,
        }),
      }).catch(() => {});
    }
  };

  const handleDismissSuggestion = (kw: any) => {
    setSuggestedKeywords(prev => prev.filter(k => k.keyword !== kw.keyword));
  };

  const handleToggleCoverage = async (kw: any) => {
    const newCovered = !kw.is_covered;
    setKeywords(prev => prev.map(k => k.keyword === kw.keyword ? { ...k, is_covered: newCovered } : k));
    if (kw.id && articleId) {
      fetch(`/api/articles/${articleId}/keywords`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywordId: kw.id, is_covered: newCovered }),
      }).catch(() => {});
    }
  };

  const hasCompetitorData = (scoreData?.competitor_count ?? 0) > 0;
  const competitorLabel = hasCompetitorData ? ` avg` : '';
  const wordsRange = scoreData
    ? `${(scoreData.words_min / 1000).toFixed(1)}K – ${(scoreData.words_max / 1000).toFixed(1)}K${competitorLabel}`
    : '–';
  const headingsRange = scoreData
    ? `${scoreData.headings_min} – ${scoreData.headings_max}${competitorLabel}`
    : '–';
  const parasMin = scoreData?.paragraphs_min ?? Math.round((scoreData?.headings_min || 10) * 2.5);
  const parasMax = scoreData?.paragraphs_max ?? Math.round((scoreData?.headings_max || 20) * 3);
  const parasRange = `${parasMin} – ${parasMax}${competitorLabel}`;

  const avgScore = score;
  const topScore = Math.min(score + 3, 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Score header ── */}
      <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#18181b', fontFamily: 'var(--font-family-primary)' }}>
          Content Score
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="#9f9fa9" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" />
          </svg>
        </div>
      </div>

      {/* ── Gauge ── */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
        <ScoreGauge score={score} />
      </div>

      {/* ── Avg / Top ── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, padding: '0 16px 12px', marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>
          Avg
          <svg viewBox="0 0 256 256" width={12} height={12} fill="currentColor">
            <path d="M224 128a8 8 0 0 1-8 8H40a8 8 0 0 1 0-16h176a8 8 0 0 1 8 8m-101.66-26.34a8 8 0 0 0 11.32 0l32-32a8 8 0 0 0-11.32-11.32L136 76.69V16a8 8 0 0 0-16 0v60.69l-18.34-18.35a8 8 0 0 0-11.32 11.32Zm11.32 52.68a8 8 0 0 0-11.32 0l-32 32a8 8 0 0 0 11.32 11.32L120 179.31V240a8 8 0 0 0 16 0v-60.69l18.34 18.35a8 8 0 0 0 11.32-11.32Z" />
          </svg>
          <span style={{ color: '#18181b', fontWeight: 600 }}>{avgScore}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>
          Top
          <svg viewBox="0 0 256 256" width={12} height={12} fill="currentColor">
            <path d="M205.66 138.34a8 8 0 0 1-11.32 11.32L136 91.31V224a8 8 0 0 1-16 0V91.31l-58.34 58.35a8 8 0 0 1-11.32-11.32l72-72a8 8 0 0 1 11.32 0ZM216 32H40a8 8 0 0 0 0 16h176a8 8 0 0 0 0-16" />
          </svg>
          <span style={{ color: '#18181b', fontWeight: 600 }}>{topScore}</span>
        </div>
      </div>

      {/* ── Structure metrics ── */}
      <div style={{ borderTop: '1px solid #f4f4f5', padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
        <MetricCol label="Words" current={wordCount} range={wordsRange} />
        <div style={{ width: 1, background: '#e4e4e7', height: 36, flexShrink: 0 }} />
        <MetricCol label="Headings" current={headingCount} range={headingsRange} />
        <div style={{ width: 1, background: '#e4e4e7', height: 36, flexShrink: 0 }} />
        <MetricCol label="Paragraphs" current={paragraphCount} range={parasRange} />
      </div>

      {/* ── Auto-Optimize button (pinned above sections) ── */}
      <div style={{ padding: '0 16px 12px', borderTop: '1px solid #f4f4f5', paddingTop: 12 }}>
        <button
          onClick={isAutoOptimizing ? undefined : onAutoOptimize}
          disabled={isAutoOptimizing}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 6, fontSize: 13, fontWeight: 600,
            background: '#18181b', color: '#fff', border: 'none',
            cursor: isAutoOptimizing ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-family-primary)',
            transition: 'background 0.15s',
            opacity: isAutoOptimizing ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
          onMouseEnter={(e) => { if (!isAutoOptimizing) e.currentTarget.style.background = '#630de3'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#18181b'; }}
        >
          {isAutoOptimizing ? (
            <>
              <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Optimizing…
            </>
          ) : 'Auto-Optimize'}
        </button>
      </div>

      {/* ── Scrollable action area ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        className="styled-scrollbar">

        {/* #1 Competitors — expandable */}
        <div>
          <SectionRow
            num={1} label="Competitors" open={competitorOpen}
            onToggle={() => setCompetitorOpen((v) => !v)}
            badge={competitors.length > 0 ? (
              <span style={{
                fontSize: 10, color: '#9f9fa9', background: '#f4f4f5',
                borderRadius: 20, padding: '1px 6px', fontFamily: 'var(--font-family-primary)',
              }}>{competitors.length}</span>
            ) : undefined}
          />
          {competitorOpen && (
            <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {isLoadingCompetitors ? (
                [1, 2, 3].map((i) => (
                  <div key={i} style={{ border: '1px solid #f4f4f5', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 2, background: '#ebebed', animation: 'editorSkeletonPulse 1.6s ease-in-out infinite' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ width: '65%', height: 11, borderRadius: 3, background: '#ebebed', animation: 'editorSkeletonPulse 1.6s ease-in-out infinite', animationDelay: '0.05s' }} />
                      <div style={{ width: '40%', height: 9, borderRadius: 3, background: '#ebebed', marginTop: 5, animation: 'editorSkeletonPulse 1.6s ease-in-out infinite', animationDelay: '0.1s' }} />
                    </div>
                  </div>
                ))
              ) : competitors.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9f9fa9', textAlign: 'center', padding: '10px 0', fontFamily: 'var(--font-family-primary)', fontStyle: 'italic' }}>
                  No competitor data yet. Re-run deep analysis.
                </p>
              ) : (
                competitors.map((comp, i) => (
                  <CompetitorCard key={comp.url + i} competitor={comp} defaultOpen={i === 0} />
                ))
              )}
            </div>
          )}
        </div>

        {/* #2 Keywords & Terms — expandable */}
        <div>
          <SectionRow num={2} label="Keywords & Terms" open={nlpOpen} onToggle={() => setNlpOpen((v) => !v)} />

          {nlpOpen && (
            <>
              {/* NLP coverage card — inside the section */}
              <div style={{ padding: '0 16px 8px' }}>
                <div style={{ background: '#f8f8f9', border: '1px solid #f4f4f5', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CircleProgress value={coveredCount} max={terms.length} color={coveredCount / Math.max(terms.length, 1) > 0.5 ? '#1ab25e' : '#d70028'} />
                  <span style={{ fontSize: 12, color: '#52525c', fontFamily: 'var(--font-family-primary)' }}>NLP terms: {coveredCount}/{terms.length} covered</span>
                </div>
              </div>
            <KeywordResearchSection
              keywords={keywords}
              isLoading={isLoadingKeywords}
              onSuggest={handleSuggest}
              isSuggesting={isSuggesting}
              suggestedKeywords={suggestedKeywords}
              onAcceptSuggestion={handleAcceptSuggestion}
              onDismissSuggestion={handleDismissSuggestion}
              onToggleCoverage={handleToggleCoverage}
              gapKeywords={gapKeywords}
            />
            </>
          )}
        </div>

        <ActionRow num={3} label="Internal Links" onClick={onInternalLinks} />
        <ActionRow num={4} label="Pre-Publish Review" />
        <ActionRow num={5} label="Publish or Export" />
      </div>
    </div>
  );
};

export default ContentScorePanel;
