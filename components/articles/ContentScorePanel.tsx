import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../koala/core';
import { KoalaPanelHeader } from '../koala/layout';
import { ScoreData, NlpTerm, countOccurrences } from '../../lib/contentScore';
import { scoreArticleHtml } from '../../lib/scoreArticleHtml';
import { computeOpportunityScore } from '../../lib/keywordEnrichment';
import { useArticleKeywords } from '../../services/articleKeywords';
import type { KeywordItem } from './KeywordResearchSection';
import KeywordResearchSection from './KeywordResearchSection';
import DomainFavicon from '../common/DomainFavicon';
import WriteOptimizePanel from './WriteOptimizePanel';
import DeepAnalysisProgressPanel from './DeepAnalysisProgressPanel';
import type { DeepAnalysisUiState } from '../../lib/deepAnalysisProgress';
import PublishExportPanel from './PublishExportPanel';
import PrePublishPanel from './PrePublishPanel';
import type { AiReadabilityResult } from './PrePublishPanel';
import type { PlagiarismResult } from './PlagiarismPanel';
import ScoreTrio from './ScoreTrio';
import { AiVisibilitySummary, computeOverallContentScore, resolveAiScore } from '../../lib/aiSearchScore';
import type { CoverageItem, BucketScore, CoverageSnapshot } from '../../lib/aiCoverage';
import { useCompetitors } from '../../services/competitors';
import { Gauge } from '../koala/core';
import { useCoverageHistoryDelta } from '../../hooks/articles/useCoverageHistoryDelta';
import PipelineStatusStrip from './PipelineStatusStrip';

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
  seoScore?: number;
}

const stripWww = (host: string): string => host.replace(/^www\./, '');

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
  initialPlagiarism?: PlagiarismResult | null;
  initialAiReadability?: AiReadabilityResult | null;
  onAutoOptimize?: () => void;
  /** Surgical Priority Apply. */
  onOptimizeAction?: (action: import('../../lib/primitives/types').Action) => void;
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
  /** Coverage Engine snapshot (parsed from ai_info_to_cover) — preferred over the legacy citation score when present. */
  coverageItems?: CoverageItem[];
  coverageBuckets?: BucketScore[];
  aiCoverageScore?: number | null;
  /** The parsed CoverageSnapshot itself (not reconstructed) — needed by WriteOptimizePanel to build AI Search Guidelines. */
  coverageSnapshot?: CoverageSnapshot | null;
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
  /** Workspace slug — loads SEO scores from the shared competitors store. */
  domainSlug?: string;
  /** AO-8b: live "↑N" content-score deltas — non-undefined ONLY during Auto-Optimize review.
   *  Task 11 adds `ai` (from the live coverage re-score) alongside the existing seo/overall. */
  scoreDeltas?: { seo?: number; overall?: number; ai?: number };
  /** Live scores from optimize re-score — overrides gauge values during a run. */
  /** AO-8b: live post-optimize scores — seo, ai, and overall from one synchronous pass. */
  optimizeLiveScores?: { seo?: number; ai?: number; overall?: number };
  /** Background deep analysis (import flow) — replaces panel with progress UI. */
  isDeepAnalyzing?: boolean;
  deepAnalysisUi?: DeepAnalysisUiState | null;
  /** Bump from editor chrome to open Publish or Export (toolbar Publish button). */
  openPublishSignal?: number;
}

/* ── Small circular progress ───────────────────────────────────────── */
const CircleProgress = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const r = 7, circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <svg width={16} height={16} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={8} cy={8} r={r} fill="none" stroke="var(--koala-border-primary)" strokeWidth={2} />
      <circle cx={8} cy={8} r={r} fill="none" stroke={color} strokeWidth={2}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.3s' }} />
    </svg>
  );
};

/* ── Bottom structure metric ─────────────────────────────────────────── */
const MetricBottom = ({ label, value, range }: { label: string; value: number; range: string }) => (
  <div className="editor-side-metric">
    <span className="editor-side-metric-label">{label}</span>
    <span className="editor-side-metric-value">
      <span className="editor-side-metric-num">{value.toLocaleString()}</span>
      <span className="editor-side-metric-range">{range}</span>
    </span>
  </div>
);

const RowChevron = ({ open }: { open?: boolean }) => (
  <svg
    viewBox="0 0 20 20"
    width={16}
    height={16}
    fill="currentColor"
    className={`editor-workflow-chevron${open ? ' editor-workflow-chevron--open' : ''}`}
    aria-hidden="true"
  >
    <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
  </svg>
);

const WorkflowRow = ({
  num,
  label,
  onClick,
  disabled,
  trailing,
  open,
  badge,
}: {
  num: number;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
  open?: boolean;
  badge?: React.ReactNode;
}) => (
  <button
    type="button"
    className="editor-workflow-row"
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
  >
    <div className="editor-workflow-row-main">
      <span className="editor-workflow-num">#{num}</span>
      <span className="editor-workflow-label">{label}</span>
      {badge}
    </div>
    <div className="editor-workflow-row-trailing">
      {trailing}
      <RowChevron open={open} />
    </div>
  </button>
);

/* ── Competitor card (inline, read-only) ────────────────────────────── */
const CompetitorCard = ({ competitor, defaultOpen }: { competitor: Competitor; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const domain = competitor.domain || (() => {
    try { return new URL(competitor.url).hostname.replace(/^www\./, ''); } catch { return competitor.url; }
  })();
  const seoScore = competitor.seoScore ?? 0;

  return (
    <div style={{ border: '1px solid var(--koala-bg-secondary)', borderRadius: 8, overflow: 'hidden', background: 'var(--koala-bg-tertiary)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, flex: 1, minWidth: 0 }}>
          <span style={{ display: 'inline-flex', flexShrink: 0, width: 14, height: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
            <DomainFavicon domain={domain} size={14} style={{ borderRadius: 2 }} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {competitor.serp_title || competitor.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <span style={{ fontSize: 11, color: 'var(--koala-text-brand)', fontFamily: 'var(--font-family-primary)', fontWeight: 500 }}>{domain}</span>
              <span style={{ fontSize: 11, color: 'var(--koala-text-disabled)' }}>·</span>
              <span style={{ fontSize: 11, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>
                {competitor.word_count.toLocaleString()}w
              </span>
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
          {competitor.headings.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginLeft: (h.level - 1) * 8, marginBottom: 1 }}>
              <span style={{ fontSize: 10, color: 'var(--koala-text-disabled)', fontFamily: 'var(--font-family-primary)', flexShrink: 0, width: 14, textAlign: 'right' }}>h{h.level}</span>
              <span style={{
                fontSize: 11, color: h.level === 1 ? 'var(--koala-text-primary)' : 'var(--koala-text-secondary)',
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
  onOptimizeAction,
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
  coverageItems,
  coverageBuckets,
  aiCoverageScore,
  coverageSnapshot,
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
  optimizeLiveScores,
  domainSlug,
  isDeepAnalyzing,
  deepAnalysisUi,
  openPublishSignal,
}: Props) => {
  const [terms, setTerms] = useState<NlpTerm[]>([]);
  const [view, setView] = useState<'main' | 'write' | 'publish' | 'prepublish'>('main');
  // Which Write & Optimize section to expand when opened via a score gauge.
  const [writeSection, setWriteSection] = useState<'seo' | 'ai' | null>(null);
  // Auto-Optimize surfaces the Write & Optimize view automatically — that's where the live
  // ↑N score deltas and the "Auto-Optimize completed / Save" summary live (instead of leaving
  // the user on the score grid). Fires when a run starts; the view stays after it finishes.
  useEffect(() => {
    if (isAutoOptimizing) { setWriteSection(null); setView('write'); }
  }, [isAutoOptimizing]);
  useEffect(() => {
    if (openPublishSignal && openPublishSignal > 0) setView('publish');
  }, [openPublishSignal]);
  const [nlpOpen, setNlpOpen] = useState(false);
  const [competitorOpen, setCompetitorOpen] = useState(false);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isLoadingCompetitors, setIsLoadingCompetitors] = useState(false);
  const compQ = useCompetitors(domainSlug, competitorOpen ? keyword : undefined);

  const displayCompetitors = useMemo(() => {
    const apiList = compQ.data?.competitors || [];
    const byUrl = new Map(apiList.map((c) => [c.url.replace(/\/$/, ''), c]));
    const byDomain = new Map(apiList.map((c) => [stripWww(c.domain || ''), c]));
    return competitors.map((comp) => {
      const domain = comp.domain || (() => {
        try { return new URL(comp.url).hostname.replace(/^www\./, ''); } catch { return ''; }
      })();
      const api = byUrl.get(comp.url.replace(/\/$/, '')) || byDomain.get(stripWww(domain));
      return {
        ...comp,
        seoScore: api?.seoScore ?? comp.seoScore ?? peerSeoScore(comp, competitors),
      };
    });
  }, [competitors, compQ.data]);

  // Keyword research state
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [suggestedKeywords, setSuggestedKeywords] = useState<KeywordItem[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [gapKeywords, setGapKeywords] = useState<KeywordItem[]>([]);

  const paragraphCount = useMemo(() => {
    return plainText.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
  }, [plainText]);

  useEffect(() => {
    if (!scoreData?.terms) return;
    const updated = scoreData.terms.map((t) => ({
      ...t,
      current_count: countOccurrences(plainText, t.term),
    }));
    setTerms(updated);
  }, [plainText, scoreData]);

  // Synchronous live SEO score — same formula as parent liveContentScore / AO / Save.
  const score = useMemo(() => {
    if (!scoreData) return fallbackScore ?? 0;
    return scoreArticleHtml({
      html: html || '',
      scoreData,
      keyword: keyword || '',
      coverageItems,
      answersMainQuestionEarly: coverageSnapshot?.answersMainQuestionEarly,
      internalLinksCount,
    }).seo;
  }, [html, scoreData, internalLinksCount, keyword, coverageItems, coverageSnapshot, fallbackScore]);

  const coveredCount = terms.filter((t) => (t.current_count ?? 0) >= t.target_count).length;

  // Hydrate competitors when deep-analysis writes competitor_outlines_cache.
  useEffect(() => {
    if (!cachedOutlines) return;
    try {
      const parsed = JSON.parse(cachedOutlines);
      const list: Competitor[] = Array.isArray(parsed) ? parsed : (parsed.competitors || []);
      if (list.length > 0) {
        setCompetitors(list);
        setIsLoadingCompetitors(false);
      }
    } catch { /* ignore */ }
  }, [cachedOutlines]);

  // Load competitors on mount (editor setup), not only when accordion opens
  useEffect(() => {
    if (competitors.length > 0) return;

    if (cachedOutlines) {
      try {
        const parsed = JSON.parse(cachedOutlines);
        const list: Competitor[] = Array.isArray(parsed) ? parsed : (parsed.competitors || []);
        if (list.length > 0) {
          setCompetitors(list);
          setIsLoadingCompetitors(false);
          return;
        }
      } catch { /* fall through */ }
    }

    if (!keyword || !articleId) return;
    setIsLoadingCompetitors(true);
    fetch('/api/articles/competitor-outlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, num: 5, articleId }),
    })
      .then((r) => r.json())
      .then((d) => {
        const list: Competitor[] = Array.isArray(d) ? d : (d.competitors || []);
        setCompetitors(list);
      })
      .catch(() => {})
      .finally(() => setIsLoadingCompetitors(false));
  }, [keyword, articleId, cachedOutlines, competitors.length]);

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
    const hasEnriched = keywords.some((k) => k.ads_monthly_volume != null);
    if (!hasEnriched && plainText) {
      fetch(`/api/articles/${articleId}/keywords/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywords.map((k) => k.keyword),
          targetKeyword: keyword,
          plainText,
        }),
      }).then(r => r.json()).then(d => {
        if (d.keywords) {
          setKeywords(d.keywords.map((k: KeywordItem) => ({
            ...k,
            is_covered: !!k.is_covered,
            opportunity_score: computeOpportunityScore({
              gsc_position: k.gsc_position ?? null,
              ads_monthly_volume: k.ads_monthly_volume ?? null,
              ads_competition: k.ads_competition ?? null,
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
        setGapKeywords((d.gapKeywords || []).map((g: { keyword: string; frequency?: number }) => ({
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

  const handleAcceptSuggestion = async (kw: KeywordItem) => {
    setSuggestedKeywords(prev => prev.filter(k => k.keyword !== kw.keyword));
    const monthlyVol = kw.avgMonthlySearches ?? kw.ads_monthly_volume ?? 0;
    const competition = kw.ads_competition ?? null;
    setKeywords(prev => [...prev, {
      ...kw,
      keyword: kw.keyword,
      source: 'ads_suggestion',
      is_covered: false,
      ads_monthly_volume: monthlyVol,
      ads_competition: competition,
      opportunity_score: computeOpportunityScore({ gsc_position: null, ads_monthly_volume: monthlyVol, ads_competition: competition, is_covered: false }),
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

  const handleDismissSuggestion = (kw: KeywordItem) => {
    setSuggestedKeywords(prev => prev.filter(k => k.keyword !== kw.keyword));
  };

  const handleToggleCoverage = async (kw: KeywordItem) => {
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

  const hasAi = aiCoverageScore != null || !!(aiVisibilitySummary && aiVisibilitySummary.prompts_total > 0);
  const intentScore = coverageBuckets?.find((b) => b.key === 'intent')?.score;
  const resolvedAi = resolveAiScore({
    summary: aiVisibilitySummary,
    articleText: plainText,
    intentScore,
    answersMainQuestionEarly: coverageSnapshot?.answersMainQuestionEarly,
    coverageOverall: aiCoverageScore,
  });
  // Stored ai_score can be 0 from a facts-V2 miss while citation summary is healthy — never let 0 mask that.
  const baseAiScore = Math.max(scoreData?.ai_score ?? 0, resolvedAi);
  const displaySeo = optimizeLiveScores?.seo ?? score;
  const displayAi = optimizeLiveScores?.ai ?? baseAiScore;
  const displayContent = optimizeLiveScores?.overall
    ?? (hasAi ? computeOverallContentScore(displaySeo, displayAi) : displaySeo);

  const historyDelta = useCoverageHistoryDelta(articleId);
  const trioDeltas = scoreDeltas ?? (historyDelta ? { ai: historyDelta.delta } : undefined);

  if (isDeepAnalyzing) {
    return (
      <div className="editor-side-panel editor-side-panel--analyzing" style={{ height: '100%', boxSizing: 'border-box', padding: '16px' }}>
        <PipelineStatusStrip articleId={articleId} />
        <DeepAnalysisProgressPanel
          state={deepAnalysisUi ?? {
            aiSearch: [],
            googleSearch: [{ key: 'fetch_page', label: 'Starting analysis…', status: 'running' }],
            error: null,
            isComplete: false,
          }}
        />
      </div>
    );
  }

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
        seo={displaySeo}
        ai={displayAi}
        content={displayContent}
        hasAi={hasAi}
        scoreDeltas={trioDeltas}
        coverageItems={coverageItems}
        coverageBuckets={coverageBuckets}
        coverageSnapshot={coverageSnapshot}
        competitorOutlinesCache={cachedOutlines}
        html={html}
        keyword={keyword}
        paaQuestions={scoreData?.paa_questions}
        onBack={() => { setView('main'); setWriteSection(null); }}
        highlightTerms={highlightTerms}
        onHighlightTermsChange={onHighlightTermsChange}
        initialSection={writeSection ?? undefined}
        articleId={articleId}
        onAutoOptimize={onAutoOptimize}
        onOptimizeAction={onOptimizeAction}
        domainSlug={domainSlug}
        knowledgeGraph={scoreData?.knowledge_graph ?? null}
        knowledgeCoverageReport={scoreData?.knowledge_coverage_report ?? null}
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
        aiScore={displayAi}
        hasAi={aiCoverageScore != null || !!(aiVisibilitySummary && aiVisibilitySummary.prompts_total > 0)}
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

  return (
    <div className="editor-side-panel">
      <div style={{ padding: '12px 16px 0' }}>
        <PipelineStatusStrip articleId={articleId} />
      </div>
      <div data-tour="content-score" className="editor-side-panel-score">
        <KoalaPanelHeader
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Content Score
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="var(--koala-text-disabled)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" />
              </svg>
            </span>
          )}
        />
        <ScoreTrio
          seo={displaySeo}
          content={displayContent}
          ai={displayAi}
          hasAi={hasAi}
          deltas={trioDeltas}
          onSeoClick={() => { setWriteSection('seo'); setView('write'); }}
          onAiClick={() => { setWriteSection('ai'); setView('write'); }}
        />
      </div>

      {optimizeState === 'idle' && (
        <div data-tour="auto-optimize" className="editor-side-panel-cta">
          <Button
            variant="primary"
            size="sm"
            onClick={readOnly ? undefined : onAutoOptimize}
            disabled={readOnly}
            style={{ width: '100%' }}
          >
            Auto-Optimize
          </Button>
        </div>
      )}

      <div className="editor-side-panel-scroll styled-scrollbar">
        <div className="editor-workflow-list">
          <div data-tour="competitors">
            <WorkflowRow
              num={1}
              label="Competitors"
              open={competitorOpen}
              onClick={() => setCompetitorOpen((v) => !v)}
              badge={displayCompetitors.length > 0 ? (
                <span className="editor-workflow-badge">{displayCompetitors.length}</span>
              ) : undefined}
            />
            {competitorOpen && (
              <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {isLoadingCompetitors ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} style={{ border: '1px solid var(--koala-bg-secondary)', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 8 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 2, background: 'var(--koala-bg-secondary)', animation: 'editorSkeletonPulse 1.6s ease-in-out infinite' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ width: '65%', height: 11, borderRadius: 3, background: 'var(--koala-bg-secondary)', animation: 'editorSkeletonPulse 1.6s ease-in-out infinite', animationDelay: '0.05s' }} />
                        <div style={{ width: '40%', height: 9, borderRadius: 3, background: 'var(--koala-bg-secondary)', marginTop: 5, animation: 'editorSkeletonPulse 1.6s ease-in-out infinite', animationDelay: '0.1s' }} />
                      </div>
                    </div>
                  ))
                ) : displayCompetitors.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--koala-text-disabled)', textAlign: 'center', padding: '10px 0', fontStyle: 'italic' }}>
                    No competitor data yet. Re-run deep analysis.
                  </p>
                ) : (
                  displayCompetitors.map((comp, i) => (
                    <CompetitorCard key={comp.url + i} competitor={comp} defaultOpen={i === 0} />
                  ))
                )}
              </div>
            )}
          </div>

          <div data-tour="keywords">
            <WorkflowRow
              num={2}
              label="Write & Optimize"
              onClick={() => { setWriteSection(null); setView('write'); }}
            />
            {nlpOpen && (
              <>
                <div style={{ padding: '0 16px 8px' }}>
                  <div style={{ background: 'var(--koala-bg-secondary)', border: '1px solid var(--koala-bg-secondary)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CircleProgress value={coveredCount} max={terms.length} color={coveredCount / Math.max(terms.length, 1) > 0.5 ? 'var(--koala-status-success)' : 'var(--koala-status-danger)'} />
                    <span style={{ fontSize: 12, color: 'var(--koala-text-secondary)' }}>NLP terms: {coveredCount}/{terms.length} covered</span>
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

          <div data-tour="internal-links">
            <WorkflowRow num={3} label="Internal Links" onClick={onInternalLinks} disabled={readOnly} />
          </div>
          <div data-tour="pre-publish">
            <WorkflowRow num={4} label="Pre-Publish Review" onClick={() => setView('prepublish')} />
          </div>
          <div data-tour="publish-export">
            <WorkflowRow num={5} label="Publish or Export" onClick={() => setView('publish')} />
          </div>
        </div>
      </div>

      <div data-tour="metrics" className="editor-side-panel-metrics">
        <MetricBottom label="Words" value={wordCount} range={wordsRange} />
        <MetricBottom label="Headings" value={headingCount} range={headingsRange} />
        <MetricBottom label="Paragraphs" value={paragraphCount} range={parasRange} />
      </div>
    </div>
  );
};

export default ContentScorePanel;
