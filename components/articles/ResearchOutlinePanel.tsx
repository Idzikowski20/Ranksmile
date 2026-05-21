import React, { useEffect, useState } from 'react';

/* ── Types ─────────────────────────────────────────────────────────── */
export interface CompetitorOutline {
  url: string;
  title: string;
  favicon: string;
  headings: Array<{ level: number; text: string }>;
  heading_count: number;
  word_count?: number;
}

interface Props {
  keyword: string;
  articleId?: number;
  language?: string;
  onClose: () => void;
  onInsertOutline: (headings: Array<{ level: number; text: string }>) => void;
  onAiActivity?: (active: boolean) => void;
}

/* ── Per-competitor content score (relative to peer group) ────────── */
/**
 * Score 0-100 for a competitor article based on how it compares
 * to the median word count and heading count of all competitors.
 * Higher = more comprehensive / better structured.
 */
function competitorScore(comp: CompetitorOutline, allComps: CompetitorOutline[]): number {
  if (allComps.length === 0) return 0;

  const words = allComps.map((c) => c.word_count ?? 0).filter((n) => n > 0);
  const headings = allComps.map((c) => c.heading_count).filter((n) => n > 0);

  const medianWords = words.length ? words.slice().sort((a, b) => a - b)[Math.floor(words.length / 2)] : 1;
  const medianHeadings = headings.length ? headings.slice().sort((a, b) => a - b)[Math.floor(headings.length / 2)] : 1;

  // Word score: 1 = at median, diminishing returns above, penalised below
  const wordScore = comp.word_count && comp.word_count > 0
    ? Math.min((comp.word_count / medianWords) * 100, 100)
    : 0;

  // Heading score: 1 = at median
  const headingScore = comp.heading_count > 0
    ? Math.min((comp.heading_count / medianHeadings) * 100, 100)
    : 0;

  // 70% word count, 30% heading structure
  return Math.round(wordScore * 0.7 + headingScore * 0.3);
}

/* ── Mini semi-circle gauge (same style as main ScoreGauge) ────────── */
const MiniGauge = ({ score }: { score: number }) => {
  const [display, setDisplay] = React.useState(0);
  const animRef = React.useRef<number | null>(null);
  const fromRef = React.useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = score;
    if (from === to) return;
    const duration = from === 0 ? 900 : 500;
    let startTs: number | null = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const animate = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 5);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) { animRef.current = requestAnimationFrame(animate); }
      else { fromRef.current = to; animRef.current = null; }
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [score]);

  // Same math as ScoreGauge but scaled for 60×30 viewBox
  const cx = 30, cy = 26, r = 18, sw = 5;
  const totalArc = Math.PI * r;
  const gap = 6, capR = sw / 2;

  const seg1End = (33 / 100) * totalArc;
  const seg2End = (66 / 100) * totalArc;
  const seg1Len = seg1End - gap / 2 - capR;
  const seg2Start = seg1End + gap / 2 + capR;
  const seg2Len = (seg2End - gap / 2 - capR) - seg2Start;
  const seg3Start = seg2End + gap / 2 + capR;
  const seg3Len = totalArc - capR - seg3Start;

  const ds = Math.max(0, Math.min(display, 100));
  const dsArcPos = (ds / 100) * totalArc;

  const redFill    = Math.max(0, Math.min(dsArcPos - capR, seg1Len));
  const yellowFill = dsArcPos > seg2Start ? Math.max(0, Math.min(dsArcPos - seg2Start, seg2Len)) : 0;
  const greenFill  = dsArcPos > seg3Start ? Math.max(0, Math.min(dsArcPos - seg3Start, seg3Len)) : 0;

  const fraction = ds / 100;
  const angleRad = -Math.PI + fraction * Math.PI;
  const innerR = r - sw / 2 - 1, outerR = r + sw / 2 + 1;
  const nx1 = cx + Math.cos(angleRad) * innerR, ny1 = cy + Math.sin(angleRad) * innerR;
  const nx2 = cx + Math.cos(angleRad) * outerR, ny2 = cy + Math.sin(angleRad) * outerR;

  const scoreColor = ds >= 66 ? '#1ab25e' : ds >= 33 ? '#efa00d' : '#d70028';
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <svg viewBox="0 0 60 30" style={{ width: 64, height: 32, overflow: 'visible' }}>
        {/* Tracks */}
        <path d={arcPath} fill="none" stroke="#ef4444" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${seg1Len} 9999`} strokeDashoffset={0} opacity={0.18} />
        <path d={arcPath} fill="none" stroke="#efa00d" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${seg2Len} 9999`} strokeDashoffset={-seg2Start} opacity={0.18} />
        <path d={arcPath} fill="none" stroke="#1ab25e" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${seg3Len} 9999`} strokeDashoffset={-seg3Start} opacity={0.18} />
        {/* Fills */}
        {redFill > 0 && <path d={arcPath} fill="none" stroke="#ef4444" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${redFill} 9999`} strokeDashoffset={0} />}
        {yellowFill > 0 && <path d={arcPath} fill="none" stroke="#efa00d" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${yellowFill} 9999`} strokeDashoffset={-seg2Start} />}
        {greenFill > 0 && <path d={arcPath} fill="none" stroke="#1ab25e" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${greenFill} 9999`} strokeDashoffset={-seg3Start} />}
        {/* Needle */}
        <line x1={nx1} y1={ny1} x2={nx2} y2={ny2} stroke="#09090b" strokeWidth={1.5} strokeLinecap="round" />
        {/* Score */}
        <text x={cx} y={cy + 1} textAnchor="middle" fontSize={9} fontWeight={700} fill={scoreColor}
          fontFamily="var(--font-family-primary)">{display}</text>
      </svg>
    </div>
  );
};

/* ── Component ─────────────────────────────────────────────────────── */
const ResearchOutlinePanel: React.FC<Props> = ({
  keyword,
  articleId,
  language = 'pl',
  onClose,
  onInsertOutline,
  onAiActivity,
}) => {
  const [tab, setTab] = useState<'competitors' | 'questions'>('competitors');
  const [competitors, setCompetitors] = useState<CompetitorOutline[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate Outline state
  const [generatedHeadings, setGeneratedHeadings] = useState<Array<{ level: number; text: string }> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    onAiActivity?.(loading || isGenerating);
  }, [loading, isGenerating]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!keyword) return;
    setLoading(true);
    setError(null);
    fetch('/api/articles/competitor-outlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, language, num: 5, articleId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCompetitors(data.competitors || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [keyword, articleId, language]);

  const handleGenerateOutline = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    setGeneratedHeadings(null);
    try {
      const res = await fetch('/api/articles/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, competitors, language }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed');
      setGeneratedHeadings(data.headings);
    } catch (err: any) {
      setGenerateError(err.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const headingIndent = (level: number) => ({ 1: '0px', 2: '8px', 3: '16px', 4: '24px' } as Record<number, string>)[level] || '0px';
  const headingTag = (level: number) => `h${Math.min(level, 4)}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#fff',
        color: '#09090b',
        fontFamily: 'var(--font-family-primary)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          flexShrink: 0,
          borderBottom: '1px solid #f4f4f5',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: '#f4f4f5', color: '#52525c', cursor: 'pointer', padding: 0, flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e4e4e7'; e.currentTarget.style.color = '#09090b'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.color = '#52525c'; }}
          >
            <svg viewBox="0 0 20 20" width={20} height={20} fill="currentColor">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0" clipRule="evenodd" />
            </svg>
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#09090b' }}>Research & Create Outline</span>
        </div>
        <div style={{ width: 32, height: 32, flexShrink: 0 }} />
      </div>

      {/* ── Tab switcher ──────────────────────────────────────────── */}
      <div style={{ padding: '12px 16px 0', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}>
        <div role="group" style={{ display: 'flex', background: '#f4f4f5', borderRadius: 10, padding: 3, position: 'relative' }}>
          <div
            style={{
              position: 'absolute', top: 3, left: tab === 'competitors' ? 3 : 'calc(50% + 3px)',
              width: 'calc(50% - 6px)', height: 28,
              background: '#fff', borderRadius: 8,
              transition: 'left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0px 4px 4px 0px rgba(24,26,34,0.02), 0px 1px 2px 0px rgba(24,26,34,0.08)',
            }}
          />
          {(['competitors', 'questions'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '4px 8px', height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                border: 'none', background: 'transparent', borderRadius: 8,
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                fontFamily: 'var(--font-family-primary)',
                color: tab === t ? '#09090b' : '#52525c',
                position: 'relative', zIndex: 1, transition: 'color 0.25s',
              }}
            >
              {tab === t && (
                <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12m13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094z" clipRule="evenodd" />
                </svg>
              )}
              <span style={{ textTransform: 'capitalize' }}>{t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Panel body ────────────────────────────────────────────── */}
      <div
        style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}
        className="styled-scrollbar"
      >
        {tab === 'competitors' && (
          <>
            {/* ── AI-Generated Outline section ──────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#09090b' }}>AI-Generated Outline</span>
              <span style={{ fontSize: 14, color: '#52525c' }}>
                Based on median structure from <strong>{competitors.length}</strong> competitor{competitors.length !== 1 ? 's' : ''}
              </span>

              <button
                type="button"
                onClick={handleGenerateOutline}
                disabled={isGenerating || loading || competitors.length === 0}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: 'transparent', color: '#52525c', fontSize: 14, fontWeight: 600,
                  cursor: isGenerating || loading || competitors.length === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-family-primary)',
                  boxShadow: 'inset 0 0 0 1px #e4e4e7',
                  opacity: isGenerating || loading || competitors.length === 0 ? 0.5 : 1,
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => { if (!isGenerating) { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.color = '#09090b'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#52525c'; }}
              >
                {isGenerating ? (
                  <div style={{ width: 14, height: 14, border: '2px solid #e4e4e7', borderTopColor: '#783afb', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                ) : (
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
                    <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5" clipRule="evenodd" />
                  </svg>
                )}
                {isGenerating ? 'Generating…' : 'Generate Outline'}
              </button>

              {/* Generate error */}
              {generateError && (
                <span style={{ fontSize: 12, color: '#ef4444' }}>{generateError}</span>
              )}

              {/* Generated outline preview */}
              {generatedHeadings && generatedHeadings.length > 0 && (
                <div
                  style={{
                    border: '1px solid #e4e4e7',
                    borderRadius: 8,
                    overflow: 'hidden',
                    marginTop: 4,
                  }}
                >
                  {/* Preview header */}
                  <div
                    style={{
                      padding: '10px 12px 8px',
                      background: '#f8f8f9',
                      borderBottom: '1px solid #f4f4f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#52525c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Generated outline · {generatedHeadings.length} headings
                    </span>
                    <button
                      type="button"
                      onClick={() => setGeneratedHeadings(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9f9fa9', padding: 2, lineHeight: 1 }}
                    >
                      <svg viewBox="0 0 20 20" width={14} height={14} fill="currentColor">
                        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>

                  {/* Heading list */}
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }} className="styled-scrollbar">
                    {generatedHeadings.map((h, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 6,
                          paddingLeft: headingIndent(h.level),
                          fontSize: 13, lineHeight: '18px',
                          color: h.level === 1 ? '#09090b' : '#3f3f47',
                          fontWeight: h.level <= 2 ? 500 : 400,
                        }}
                      >
                        <span style={{ color: '#9f9fa9', fontSize: 11, minWidth: 16, paddingTop: 3, flexShrink: 0 }}>
                          {headingTag(h.level)}
                        </span>
                        <span>{h.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Insert button */}
                  <div style={{ padding: '8px 12px', borderTop: '1px solid #f4f4f5', display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => {
                        onInsertOutline(generatedHeadings);
                        setGeneratedHeadings(null);
                      }}
                      style={{
                        flex: 1, padding: '6px 12px', borderRadius: 6, border: 'none',
                        background: '#18181b', color: '#fff',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'var(--font-family-primary)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#27272a'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#18181b'; }}
                    >
                      Insert into article
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateOutline}
                      style={{
                        padding: '6px 10px', borderRadius: 6, border: 'none',
                        background: 'transparent', color: '#52525c', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'var(--font-family-primary)',
                        boxShadow: 'inset 0 0 0 1px #e4e4e7', transition: 'background 0.15s',
                      }}
                      title="Regenerate"
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 4v6h6M23 20v-6h-6" />
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: '#f4f4f5', flexShrink: 0 }} />

            {/* ── Competitors' Outlines ──────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#09090b' }}>Competitors&rsquo; Outlines</span>
              <span style={{ fontSize: 14, color: '#52525c', paddingBottom: 4 }}>
                Outline examples sourced from your competitors
              </span>

              {/* Loading */}
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '24px 0', alignItems: 'center' }}>
                  <div style={{ width: 20, height: 20, border: '2px solid #e4e4e7', borderTopColor: '#783afb', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                  <span style={{ fontSize: 12, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>Analyzing SERP…</span>
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div style={{ padding: '16px 0', textAlign: 'center' }}>
                  <span style={{ fontSize: 13, color: '#ef4444', fontFamily: 'var(--font-family-primary)' }}>{error}</span>
                </div>
              )}

              {/* Empty */}
              {!loading && !error && competitors.length === 0 && (
                <div style={{ padding: '16px 0', textAlign: 'center' }}>
                  <span style={{ fontSize: 13, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>No competitors found. Try a different keyword.</span>
                </div>
              )}

              {/* Competitor list */}
              {!loading && competitors.map((comp, idx) => {
                const isExpanded = expandedIdx === idx;
                return (
                  <div
                    key={comp.url}
                    style={{ border: '1px solid #f4f4f5', borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.15s' }}
                    onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.borderColor = '#d4d4d8'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f4f4f5'; }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                      style={{
                        width: '100%', padding: '12px', border: 'none', background: 'transparent',
                        cursor: 'pointer', color: '#52525c', textAlign: 'left',
                        fontFamily: 'var(--font-family-primary)', transition: 'color 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#09090b'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#52525c'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, overflow: 'hidden', flex: 1, minWidth: 0 }}>
                          <img
                            alt=""
                            src={comp.favicon}
                            style={{ width: 20, height: 20, borderRadius: 4, marginTop: 2, flexShrink: 0 }}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: '#09090b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                                {comp.title}
                              </span>
                              {competitors.length > 0 && (
                                <MiniGauge score={competitorScore(comp, competitors)} />
                              )}
                            </div>
                            <a
                              href={comp.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: 13, color: '#783afb', textDecoration: 'underline', textUnderlineOffset: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {comp.url.length > 50 ? comp.url.slice(0, 50) + '…' : comp.url}
                            </a>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, background: '#f8f8f9', flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                            <path d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ height: 1, background: '#f4f4f5', marginBottom: 4 }} />
                        {comp.headings.slice(0, 40).map((h, hi) => (
                          <div
                            key={hi}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingLeft: headingIndent(h.level), fontSize: 14, lineHeight: '20px', color: h.level === 1 ? '#09090b' : '#52525c', fontWeight: h.level === 1 ? 500 : 400 }}
                          >
                            <span style={{ color: '#9f9fa9', fontSize: 13, minWidth: 14, textAlign: 'right', paddingTop: 2, flexShrink: 0 }}>
                              {headingTag(h.level)}
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.text}</span>
                          </div>
                        ))}
                        <div style={{ height: 1, background: '#f4f4f5', marginTop: 4 }} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', justifyContent: 'space-between' }}>
                          <button
                            type="button"
                            onClick={() => onInsertOutline(comp.headings)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              flex: 1, padding: '6px 12px', borderRadius: 6, border: 'none',
                              background: 'transparent', color: '#52525c', fontSize: 14, fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'var(--font-family-primary)',
                              boxShadow: 'inset 0 0 0 1px #e4e4e7', transition: 'background 0.15s, color 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.color = '#09090b'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#52525c'; }}
                          >
                            Insert outline
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const text = comp.headings.map((h) => `${'  '.repeat(h.level - 1)}${h.text}`).join('\n');
                              navigator.clipboard.writeText(text);
                            }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 32, height: 32, borderRadius: 6, border: 'none',
                              background: 'transparent', color: '#52525c', cursor: 'pointer', padding: 0,
                              boxShadow: 'inset 0 0 0 1px #e4e4e7', transition: 'background 0.15s, color 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.color = '#09090b'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#52525c'; }}
                          >
                            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === 'questions' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12 }}>
            <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="#9f9fa9" strokeWidth={1}>
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" />
              <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeWidth={2} />
            </svg>
            <span style={{ fontSize: 14, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>Questions coming soon</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearchOutlinePanel;
