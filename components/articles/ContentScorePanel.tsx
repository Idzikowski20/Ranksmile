import React, { useEffect, useMemo, useRef, useState } from 'react';
import Confetti from './Confetti';
import { ScoreData, NlpTerm, countOccurrences, computeContentScore, computeContentScoreBreakdown } from '../../lib/contentScore';
import { computeOpportunityScore } from '../../lib/keywordEnrichment';
import { useArticleKeywords } from '../../services/articleKeywords';
import KeywordResearchSection from './KeywordResearchSection';
import WriteOptimizePanel from './WriteOptimizePanel';
import PublishExportPanel from './PublishExportPanel';
import PrePublishPanel from './PrePublishPanel';
import type { AiReadabilityResult } from './PrePublishPanel';
import ScoreTrio from './ScoreTrio';
import { AiVisibilitySummary, computeAiSearchScore } from '../../lib/aiSearchScore';

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
  highlightTerms?: boolean;
  onHighlightTermsChange?: (on: boolean) => void;
  initialPlagiarism?: any;
  initialAiReadability?: any;
  onAutoOptimize?: () => void;
  isAutoOptimizing?: boolean;
  /** Drives the 3-state Auto-Optimize control: button → running → completed box. */
  optimizeState?: 'idle' | 'optimizing' | 'reviewing';
  onCancelOptimize?: () => void;
  onSaveOptimize?: () => void;
  optimizeSaving?: boolean;
  saveState?: 'saved' | 'saving' | 'unsaved';
  onInternalLinks?: () => void;
  articleId?: number;
  cachedOutlines?: string | null;
  /** Stored content_score — shown when there are no competitor terms to compute a live score. */
  fallbackScore?: number;
  /** Publish or Export panel */
  title?: string;
  metaTitle?: string;
  metaDescription?: string;
  onMetaTitleChange?: (v: string) => void;
  onMetaDescriptionChange?: (v: string) => void;
  featuredImage?: { url: string; alt: string } | null;
  onFeaturedImageChange?: (img: { url: string; alt: string } | null) => void;
  isDone?: boolean;
  onMarkDone?: () => void;
  /** Pre-Publish Review panel */
  aiVisibilitySummary?: AiVisibilitySummary | null;
  isRunningAiVisibility?: boolean;
  onRunAiVisibility?: () => void;
  /** AI Readability "Apply All" — runs the structure-only optimize on the page. */
  onApplyReadability?: (result: AiReadabilityResult) => void;
  /** Plagiarism panel → editor red highlights (active sentences + focused one). */
  onPlagiarismHighlight?: (sentences: string[], focused: string | null) => void;
  /** Bumped when a readability optimize is Accepted → mark its suggestions done. */
  readabilityAccepted?: number;
  /** Shared/preview mode — disables every mutating action. */
  readOnly?: boolean;
  /** AO-8b: live "↑N" content-score deltas — non-undefined ONLY during Auto-Optimize review. */
  scoreDeltas?: { seo?: number; overall?: number };
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

/* ── Bottom structure metric (Surfer-style: label over value + range) ── */
const MetricBottom = ({ label, value, range }: { label: string; value: number; range: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 2 }}>
    <span style={{ fontSize: 11, fontWeight: 400, lineHeight: '14px', color: '#3f3f47', fontFamily: 'var(--font-family-primary)' }}>{label}</span>
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, lineHeight: '14px', color: '#000', fontFamily: 'var(--font-family-primary)' }}>{value.toLocaleString()}</span>
      <span style={{ fontSize: 11, fontWeight: 400, lineHeight: '14px', color: '#52525c', fontFamily: 'var(--font-family-primary)' }}>{range}</span>
    </span>
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
const ActionRow = ({ num, label, onClick, disabled }: { num: number; label: string; onClick?: () => void; disabled?: boolean }) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    style={{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', background: 'transparent',
      border: 'none', borderTop: '1px solid #f4f4f5', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      transition: 'opacity 0.15s', fontFamily: 'var(--font-family-primary)',
    }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = '0.7'; }}
    onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
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
  optimizeState = 'idle',
  onCancelOptimize,
  onSaveOptimize,
  optimizeSaving,
  saveState,
  onInternalLinks,
  articleId,
  cachedOutlines,
  fallbackScore,
  title,
  metaTitle,
  metaDescription,
  onMetaTitleChange,
  onMetaDescriptionChange,
  featuredImage,
  onFeaturedImageChange,
  isDone,
  onMarkDone,
  aiVisibilitySummary,
  isRunningAiVisibility,
  onRunAiVisibility,
  onApplyReadability,
  onPlagiarismHighlight,
  readabilityAccepted,
  readOnly,
  highlightTerms,
  onHighlightTermsChange,
  initialPlagiarism,
  initialAiReadability,
  scoreDeltas,
}: Props) => {
  const [terms, setTerms] = useState<NlpTerm[]>([]);
  const [score, setScore] = useState(0);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const wasOptimizingRef = useRef(false);
  // Fire confetti when an auto-optimize run finishes (true → false).
  useEffect(() => {
    if (wasOptimizingRef.current && !isAutoOptimizing) setCelebrateKey((k) => k + 1);
    wasOptimizingRef.current = !!isAutoOptimizing;
  }, [isAutoOptimizing]);
  const [view, setView] = useState<'main' | 'write' | 'publish' | 'prepublish'>('main');
  // Which Write & Optimize section to expand when opened via a score gauge.
  const [writeSection, setWriteSection] = useState<'seo' | 'ai' | null>(null);
  // Auto-Optimize surfaces the Write & Optimize view automatically — that's where the live
  // ↑N score deltas and the "Auto-Optimize completed / Save" summary live (instead of leaving
  // the user on the score grid). Fires when a run starts; the view stays after it finishes.
  useEffect(() => {
    if (isAutoOptimizing) { setWriteSection(null); setView('write'); }
  }, [isAutoOptimizing]);
  const [nlpOpen, setNlpOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [competitorOpen, setCompetitorOpen] = useState(false);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isLoadingCompetitors, setIsLoadingCompetitors] = useState(false);

  // Keyword research state
  const [keywords, setKeywords] = useState<any[]>([]);
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
    // No analysis data at all → show the stored score. Otherwise compute live — structural signals
    // are scored even when competitor terms are absent, so the gauge updates as you edit.
    if (!scoreData) {
      setScore(fallbackScore ?? 0);
      return undefined;
    }
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
  }, [plainText, wordCount, headingCount, scoreData, internalLinksCount, html, keyword, keywords, fallbackScore]);

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

  // Article keywords — shared/deduped fetch, loaded when the NLP section opens
  // (or already warm from the editor's breadcrumb fetch). Seeded into local
  // state because it's mutated afterwards (enrich / suggest / toggle covered).
  const { data: keywordRows, isFetching: isLoadingKeywords } = useArticleKeywords(articleId, nlpOpen);
  useEffect(() => {
    if (!keywordRows) return;
    setKeywords(keywordRows.map((k) => ({
      ...k,
      is_covered: !!k.is_covered,
      opportunity_score: computeOpportunityScore({
        gsc_position: k.gsc_position ?? null,
        ads_monthly_volume: k.ads_monthly_volume ?? null,
        ads_competition: k.ads_competition ?? null,
        is_covered: !!k.is_covered,
      }),
    })));
  }, [keywordRows]);

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

  const parasMin = scoreData?.paragraphs_min ?? Math.round((scoreData?.headings_min || 10) * 2.5);
  const wordsRange = scoreData ? `${(scoreData.words_min / 1000).toFixed(1)}K-${(scoreData.words_max / 1000).toFixed(1)}K` : '–';
  const headingsRange = scoreData ? `${scoreData.headings_min}-${scoreData.headings_max}` : '–';
  const parasRange = scoreData ? `${parasMin}+` : '–';

  // Per-slot gaps — what's still costing points, biggest opportunities first.
  const scoreGaps = useMemo(() => {
    if (!scoreData) return [];
    const paraCount = plainText.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
    const kwCov = keywords.map((k: any) => ({ keyword: k.keyword, is_covered: k.is_covered }));
    const { slots } = computeContentScoreBreakdown(plainText, wordCount, headingCount, scoreData, paraCount, html, keyword, kwCov);
    return slots
      .filter((s) => s.missingPoints > 0)
      .sort((a, b) => b.missingPoints - a.missingPoints);
  }, [plainText, wordCount, headingCount, scoreData, html, keyword, keywords]);

  if (view === 'write') {
    return (
      <WriteOptimizePanel
        terms={terms}
        wordCount={wordCount}
        headingCount={headingCount}
        paragraphCount={paragraphCount}
        wordsRange={wordsRange}
        headingsRange={headingsRange}
        parasRange={parasRange}
        aiSummary={aiVisibilitySummary}
        seo={score}
        ai={aiVisibilitySummary && aiVisibilitySummary.prompts_total > 0 ? computeAiSearchScore(aiVisibilitySummary) : 0}
        hasAi={!!(aiVisibilitySummary && aiVisibilitySummary.prompts_total > 0)}
        onAutoOptimize={onAutoOptimize}
        isAutoOptimizing={isAutoOptimizing}
        readOnly={readOnly}
        onBack={() => { setView('main'); setWriteSection(null); }}
        highlightTerms={highlightTerms}
        onHighlightTermsChange={onHighlightTermsChange}
        initialSection={writeSection ?? undefined}
      />
    );
  }

  if (view === 'publish') {
    return (
      <PublishExportPanel
        articleId={articleId}
        score={score}
        html={html || ''}
        plainText={plainText}
        title={title || ''}
        metaTitle={metaTitle || ''}
        metaDescription={metaDescription || ''}
        onMetaTitleChange={onMetaTitleChange || (() => {})}
        onMetaDescriptionChange={onMetaDescriptionChange || (() => {})}
        saveState={saveState}
        keyword={keyword || ''}
        featuredImage={featuredImage || null}
        onFeaturedImageChange={onFeaturedImageChange}
        isDone={!!isDone}
        onMarkDone={() => { onMarkDone?.(); }}
        readOnly={readOnly}
        onBack={() => setView('main')}
      />
    );
  }

  if (view === 'prepublish') {
    return (
      <PrePublishPanel
        score={score}
        aiScore={aiVisibilitySummary && aiVisibilitySummary.prompts_total > 0 ? computeAiSearchScore(aiVisibilitySummary) : 0}
        hasAi={!!(aiVisibilitySummary && aiVisibilitySummary.prompts_total > 0)}
        plainText={plainText}
        articleId={articleId}
        readOnly={readOnly}
        onBack={() => setView('main')}
        initialPlagiarism={initialPlagiarism}
        initialAiReadability={initialAiReadability}
        onApplyReadability={onApplyReadability}
        onPlagiarismHighlight={onPlagiarismHighlight}
        readabilityAccepted={readabilityAccepted}
      />
    );
  }

  // SEO (= content score) on the left, AI Search on the right; center = blend.
  const hasAi = !!(aiVisibilitySummary && aiVisibilitySummary.prompts_total > 0);
  const aiScore = hasAi ? computeAiSearchScore(aiVisibilitySummary) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Score header + gauge + Avg/Top (one tour target) ── */}
      <div data-tour="content-score">
      <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#18181b', fontFamily: 'var(--font-family-primary)' }}>
          Content Score
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="#9f9fa9" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" />
          </svg>
        </div>
      </div>

      {/* ── SEO · Content Score · AI Search gauges (click → Write & Optimize) ── */}
      <ScoreTrio
        seo={score} ai={aiScore} hasAi={hasAi}
        deltas={scoreDeltas}
        onSeoClick={() => { setWriteSection('seo'); setView('write'); }}
        onAiClick={() => { setWriteSection('ai'); setView('write'); }}
      />

      </div>

      <Confetti runKey={celebrateKey} />

      {/* ── Auto-Optimize control — 3 states: button → running → completed box (Surfer) ── */}
      <div data-tour="auto-optimize" style={{ padding: '12px 16px', borderTop: '1px solid #f4f4f5', fontFamily: 'var(--font-family-primary)' }}>
        {optimizeState === 'reviewing' ? (
          // Completed box (1:1 from reference)
          <div className="bg-gray-10 px-base py-xs flex items-center justify-between rounded-md">
            <div className="gap-sm flex items-center">
              <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" className="inline-block shrink-0 align-sub size-[20px] text-gray-base">
                <path fill="currentColor" fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12m13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094z" clipRule="evenodd" />
              </svg>
              <span className="text-md">Auto-Optimize completed</span>
            </div>
            <button
              type="button" onClick={onSaveOptimize} disabled={optimizeSaving}
              className="relative inline-flex cursor-pointer items-center justify-center border-none font-sans font-semibold transition-[color] text-sm rounded-none bg-transparent p-0 text-gray-100 gap-xs hover:text-gray-120 active:text-gray-160"
            >
              <span>{optimizeSaving ? 'Saving…' : 'Save'}</span>
            </button>
          </div>
        ) : optimizeState === 'optimizing' ? (
          // Running row (spinner + label · Cancel)
          <div className="flex items-center justify-between">
            <span className="gap-sm flex items-center text-md" style={{ color: 'var(--gray-100)' }}>
              <span style={{ width: 14, height: 14, border: '2px solid var(--gray-40)', borderTopColor: 'var(--gray-base)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
              Running Auto-Optimize
            </span>
            <button
              type="button" onClick={onCancelOptimize}
              className="cursor-pointer border-none bg-transparent p-0 text-sm font-semibold text-gray-100 transition-[color] hover:text-gray-120 active:text-gray-160"
            >
              Cancel
            </button>
          </div>
        ) : (
          // Idle button
          <button
            onClick={readOnly ? undefined : onAutoOptimize}
            disabled={readOnly}
            style={{
              width: '100%', padding: '9px 0', borderRadius: 6, fontSize: 13, fontWeight: 600,
              background: '#18181b', color: '#fff', border: 'none',
              cursor: readOnly ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-family-primary)', transition: 'background 0.15s',
              opacity: readOnly ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!readOnly) e.currentTarget.style.background = '#630de3'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#18181b'; }}
          >
            Auto-Optimize
          </button>
        )}
      </div>

      {/* ── Scrollable action area ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        className="styled-scrollbar">

        {/* ── What's missing to improve the score ── */}
        {scoreGaps.length > 0 && (
          <div data-tour="whats-missing">
            <button
              type="button" onClick={() => setMissingOpen((v) => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '14px 16px', background: 'transparent', border: 'none', borderTop: '1px solid #f4f4f5', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', transition: 'opacity 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 400, color: '#9f9fa9' }}>#1</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>What&apos;s missing</span>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#9f9fa9' }}>+{Math.min(100 - score, scoreGaps.reduce((s, g) => s + g.missingPoints, 0))} pts available</span>
                <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor" style={{ color: '#9f9fa9', flexShrink: 0, transform: missingOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                  <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
                </svg>
              </span>
            </button>
            {missingOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 16px 12px' }}>
                {scoreGaps.map((g) => (
                  <div key={g.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, minWidth: 34, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#000', background: 'rgb(224 241 227)', borderRadius: 6, padding: '2px 4px', fontFamily: 'var(--font-family-primary)' }}>+{g.missingPoints}</span>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>{g.label}</span>
                      <span style={{ fontSize: 12, color: '#71717b', fontFamily: 'var(--font-family-primary)' }}> — {g.hint}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* #2 Competitors — expandable */}
        <div data-tour="competitors">
          <SectionRow
            num={2} label="Competitors" open={competitorOpen}
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

        {/* #3 Keywords & Terms — opens the Write & Optimize view */}
        <div data-tour="keywords">
          <SectionRow num={3} label="Write & Optimize" open={false} onToggle={() => { setWriteSection(null); setView('write'); }} />

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

        <div data-tour="internal-links"><ActionRow num={4} label="Internal Links" onClick={onInternalLinks} disabled={readOnly} /></div>
        <div data-tour="pre-publish"><ActionRow num={5} label="Pre-Publish Review" onClick={() => setView('prepublish')} /></div>
        <div data-tour="publish-export"><ActionRow num={6} label="Publish or Export" onClick={() => setView('publish')} /></div>
      </div>

      {/* ── Structure metrics (pinned footer, Surfer-style) ── */}
      <div data-tour="metrics" style={{ borderTop: '1px solid #f4f4f5', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <MetricBottom label="Words" value={wordCount} range={wordsRange} />
        <MetricBottom label="Headings" value={headingCount} range={headingsRange} />
        <MetricBottom label="Paragraphs" value={paragraphCount} range={parasRange} />
      </div>
    </div>
  );
};

export default ContentScorePanel;
