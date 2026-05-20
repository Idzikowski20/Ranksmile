import React, { useEffect, useMemo, useState } from 'react';
import { ScoreData, NlpTerm, countOccurrences } from '../../lib/contentScore';

interface Props {
  plainText: string;
  wordCount: number;
  headingCount: number;
  scoreData: ScoreData;
  internalLinksCount?: number;
  onAutoOptimize?: () => void;
  isAutoOptimizing?: boolean;
  onResearchOutline?: () => void;
  onInternalLinks?: () => void;
}

function computeScore(plainText: string, wordCount: number, headingCount: number, paragraphCount: number, scoreData: ScoreData, internalLinksCount?: number): number {
  if (!scoreData?.terms?.length) return 0;

  const wordScore = Math.min(wordCount / Math.max(scoreData.words_target, 1), 1) * 30;
  const headingScore = Math.min(headingCount / Math.max(scoreData.headings_target, 1), 1) * 20;

  let paraScore = 0;
  let termsWeight = 50;
  if (scoreData.paragraphs_target) {
    paraScore = Math.min(paragraphCount / Math.max(scoreData.paragraphs_target, 1), 1) * 15;
    termsWeight = 35;
  }

  const termsRatio = scoreData.terms.reduce((sum, t) => {
    const actual = countOccurrences(plainText, t.term);
    return sum + Math.min(actual / Math.max(t.target_count, 1), 1);
  }, 0) / scoreData.terms.length;
  const termsScore = termsRatio * termsWeight;

  let linksScore = 0;
  if (internalLinksCount !== undefined && internalLinksCount > 0) {
    const bonus = Math.min(internalLinksCount, 5);
    const penalty = internalLinksCount > 10 ? (internalLinksCount - 10) : 0;
    linksScore = Math.max(0, bonus - penalty);
  }

  return Math.round(wordScore + headingScore + paraScore + termsScore + linksScore);
}

/* ── Score Gauge (SurferSEO-style SVG) ─────────────────────────────── */
const ScoreGauge = ({ score }: { score: number }) => {
  // Animate displayScore from previous value to target using rAF
  const [displayScore, setDisplayScore] = React.useState(0);
  const animRef = React.useRef<number | null>(null);
  const startTimeRef = React.useRef<number | null>(null);
  const fromRef = React.useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = score;
    if (from === to) return;

    // Slower on first paint (0→N), gentle for live edits
    const duration = from === 0 ? 2800 : 900;

    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    startTimeRef.current = null;

    const animate = (ts: number) => {
      if (startTimeRef.current === null) startTimeRef.current = ts;
      const t = Math.min((ts - startTimeRef.current) / duration, 1);
      // Ease-out quint — very gentle, decelerates smoothly
      const eased = 1 - Math.pow(1 - t, 5);
      setDisplayScore(Math.round(from + (to - from) * eased));
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = to;
        animRef.current = null;
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current !== null) { cancelAnimationFrame(animRef.current); animRef.current = null; } };
  }, [score]);

  const cx = 250, cy = 190, r = 120, sw = 25;
  const totalArc = Math.PI * r;
  const gap = 10;
  const capR = sw / 2;

  // Segment boundaries
  const seg1End = (33 / 100) * totalArc;
  const seg2End = (66 / 100) * totalArc;
  const seg1Len = seg1End - gap / 2 - capR;
  const seg2Start = seg1End + gap / 2 + capR;
  const seg2Len = (seg2End - gap / 2 - capR) - seg2Start;
  const seg3Start = seg2End + gap / 2 + capR;
  const seg3Len = totalArc - capR - seg3Start;

  const ds = Math.max(0, Math.min(displayScore, 100));
  const dsArcPos = (ds / 100) * totalArc;

  // Filled portions — grow from 0 as displayScore increases
  const redFillLen   = Math.max(0, Math.min(dsArcPos - capR, seg1Len));
  const yellowFillLen = dsArcPos > seg2Start ? Math.max(0, Math.min(dsArcPos - seg2Start, seg2Len)) : 0;
  const greenFillLen  = dsArcPos > seg3Start ? Math.max(0, Math.min(dsArcPos - seg3Start, seg3Len)) : 0;

  // Needle follows displayScore
  const fraction = ds / 100;
  const angleRad = -Math.PI + fraction * Math.PI;
  const innerR = r - sw / 2 - 2;
  const outerR = r + sw / 2 + 3;
  const nx1 = cx + Math.cos(angleRad) * innerR;
  const ny1 = cy + Math.sin(angleRad) * innerR;
  const nx2 = cx + Math.cos(angleRad) * outerR;
  const ny2 = cy + Math.sin(angleRad) * outerR;

  const scoreColor = ds >= 66 ? '#1ab25e' : ds >= 33 ? '#efa00d' : '#d70028';
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <svg
      viewBox="0 0 500 200"
      style={{ width: 300, height: 116, marginLeft: -18, marginTop: -24, marginBottom: -8 }}
    >
      {/* Faded tracks */}
      <path d={arcPath} fill="none" stroke="#ef4444" strokeWidth={sw}
        strokeLinecap="round" strokeDasharray={`${seg1Len} 9999`} strokeDashoffset={0} opacity={0.18} />
      <path d={arcPath} fill="none" stroke="#efa00d" strokeWidth={sw}
        strokeLinecap="round" strokeDasharray={`${seg2Len} 9999`} strokeDashoffset={-seg2Start} opacity={0.18} />
      <path d={arcPath} fill="none" stroke="#1ab25e" strokeWidth={sw}
        strokeLinecap="round" strokeDasharray={`${seg3Len} 9999`} strokeDashoffset={-seg3Start} opacity={0.18} />

      {/* Animated fills growing from left */}
      {redFillLen > 0 && (
        <path d={arcPath} fill="none" stroke="#ef4444" strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={`${redFillLen} 9999`} strokeDashoffset={0} />
      )}
      {yellowFillLen > 0 && (
        <path d={arcPath} fill="none" stroke="#efa00d" strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={`${yellowFillLen} 9999`} strokeDashoffset={-seg2Start} />
      )}
      {greenFillLen > 0 && (
        <path d={arcPath} fill="none" stroke="#1ab25e" strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={`${greenFillLen} 9999`} strokeDashoffset={-seg3Start} />
      )}

      {/* Needle */}
      <line x1={nx1} y1={ny1} x2={nx2} y2={ny2} stroke="#09090b" strokeWidth={3} strokeLinecap="round" />

      {/* Score text */}
      <g transform={`translate(${cx}, ${cy - 6})`}>
        <text textAnchor="middle" fontFamily="var(--font-family-primary)">
          <tspan fontSize={48} fontWeight={500} fill={scoreColor} letterSpacing="0.02em">{displayScore}</tspan>
          <tspan fontSize={24} fontWeight={400} fill="#3f3f47"> / 100</tspan>
        </text>
      </g>
    </svg>
  );
};

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
    <span style={{ fontSize: 12, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)', textAlign: 'center' }}>{range}</span>
  </div>
);

/* ── Action row ─────────────────────────────────────────────────────── */
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

/* ── Main panel ────────────────────────────────────────────────────── */
const ContentScorePanel = ({ plainText, wordCount, headingCount, scoreData, internalLinksCount, onAutoOptimize, isAutoOptimizing, onResearchOutline, onInternalLinks }: Props) => {
  const [terms, setTerms] = useState<NlpTerm[]>([]);
  const [score, setScore] = useState(0);
  const [nlpOpen, setNlpOpen] = useState(false);
  const [termSearch, setTermSearch] = useState('');

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
    const paraCount = plainText.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
    setScore(computeScore(plainText, wordCount, headingCount, paraCount, scoreData, internalLinksCount));
  }, [plainText, wordCount, headingCount, scoreData, internalLinksCount]);

  const coveredCount = terms.filter((t) => (t.current_count ?? 0) >= t.target_count).length;

  const filteredTerms = useMemo(() => {
    if (!termSearch) return terms;
    return terms.filter((t) => t.term.toLowerCase().includes(termSearch.toLowerCase()));
  }, [terms, termSearch]);

  const wordsRange = scoreData ? `${(scoreData.words_min / 1000).toFixed(1)}K – ${(scoreData.words_max / 1000).toFixed(1)}K` : '–';
  const headingsRange = scoreData ? `${scoreData.headings_min} – ${scoreData.headings_max}` : '–';
  const parasMin = scoreData?.paragraphs_min ?? Math.round((scoreData?.headings_min || 10) * 2.5);
  const parasMax = scoreData?.paragraphs_max ?? Math.round((scoreData?.headings_max || 20) * 3);
  const parasRange = `${parasMin}+`;

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

      {/* ── Scrollable action area ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        className="styled-scrollbar">

        <ActionRow num={1} label="Research & Create Outline" onClick={onResearchOutline} />

        {/* #2 Write & Optimize — expandable, shows NLP terms */}
        <div>
          <button
            onClick={() => setNlpOpen((v) => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', background: 'transparent',
              border: 'none', borderTop: '1px solid #f4f4f5', cursor: 'pointer',
              fontFamily: 'var(--font-family-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 400, color: '#9f9fa9' }}>#2</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>Write & Optimize</span>
            </div>
            <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor"
              style={{ color: '#9f9fa9', flexShrink: 0, transform: nlpOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
            </svg>
          </button>

          {/* SEO / AI Search mini cards — always visible */}
          <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: '#f8f8f9', border: '1px solid #f4f4f5', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', fontFamily: 'var(--font-family-primary)', marginBottom: 6 }}>SEO</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CircleProgress value={coveredCount} max={terms.length} color={coveredCount / Math.max(terms.length, 1) > 0.5 ? '#1ab25e' : '#d70028'} />
                <span style={{ fontSize: 12, color: '#52525c', fontFamily: 'var(--font-family-primary)' }}>{coveredCount}/{terms.length}</span>
              </div>
            </div>
            <div style={{ flex: 1, background: '#f8f8f9', border: '1px solid #f4f4f5', borderRadius: 12, padding: '12px 14px', opacity: 0.6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', fontFamily: 'var(--font-family-primary)', marginBottom: 6 }}>AI Search</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CircleProgress value={0} max={1} color="#9f9fa9" />
                <span style={{ fontSize: 12, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>0/0</span>
              </div>
            </div>
          </div>

          {/* Auto-Optimize — always visible */}
          <div style={{ padding: '0 16px 12px' }}>
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

          {nlpOpen && (
            <div style={{ padding: '0 16px 16px' }}>
              {/* NLP Terms search */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search terms"
                  value={termSearch}
                  onChange={(e) => setTermSearch(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px 6px 28px', fontSize: 13, border: '1px solid #e4e4e7', borderRadius: 6, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box', fontFamily: 'var(--font-family-primary)' }}
                />
              </div>

              {/* Terms list */}
              {filteredTerms.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '12px 0', fontStyle: 'italic', fontFamily: 'var(--font-family-primary)' }}>
                  {terms.length === 0 ? 'No NLP terms available.' : 'No terms match.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {filteredTerms.map((t) => {
                    const current = t.current_count ?? 0;
                    const target = t.target_count;
                    const min = Math.max(1, Math.round(target * 0.7));
                    const max = Math.round(target * 1.5);
                    const covered = current >= min && current <= max;
                    const over = current > max;
                    const zero = current === 0;
                    const chip = covered
                      ? { bg: '#f0fdf4', text: '#15803d', metaText: '#16a34a' }
                      : over
                        ? { bg: '#fefce8', text: '#92400e', metaText: '#d97706' }
                        : zero
                          ? { bg: '#fff1f2', text: '#9f1239', metaText: '#dc2626' }
                          : { bg: '#fefce8', text: '#92400e', metaText: '#d97706' };
                    return (
                      <div key={t.term} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', borderRadius: 999, background: chip.bg, gap: 6 }}>
                        <span style={{ fontSize: 12, color: chip.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, fontFamily: 'var(--font-family-primary)' }} title={t.term}>{t.term}</span>
                        <span style={{ fontSize: 11, color: chip.metaText, flexShrink: 0, fontFamily: 'var(--font-family-primary)' }}>{current}/{min}–{max}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
