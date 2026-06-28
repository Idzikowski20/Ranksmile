import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import MiniGauge from './MiniGauge';
import PlagiarismScanningModal from './PlagiarismScanningModal';
import PlagiarismPanel from './PlagiarismPanel';

const F = 'var(--font-family-primary)';

type PlagiarismMatch = { text: string; url: string; title: string; domain: string; sources: number };
type PlagiarismResult = { available: boolean; checked: number; matched: number; uniqueness: number; matches: PlagiarismMatch[]; error?: string };

interface Props {
  /** SEO / content score. */
  score: number;
  /** AI Search score (0 when no AI visibility analysis has run). */
  aiScore?: number;
  /** Whether an AI visibility analysis exists, so the main score blends SEO + AI. */
  hasAi?: boolean;
  plainText: string;
  articleId?: number;
  readOnly?: boolean;
  onBack: () => void;
  /** Previously saved plagiarism result (restored from the article). */
  initialPlagiarism?: PlagiarismResult | null;
  /** Previously saved AI Readability rubric result (restored from the article). */
  initialAiReadability?: AiReadabilityResult | null;
  /** Apply All — hand the readability suggestions to the optimize pipeline (wired in a later step). */
  onApplyReadability?: (result: AiReadabilityResult) => void;
  /** Plagiarism panel → editor red highlights (active sentences + focused one). */
  onPlagiarismHighlight?: (sentences: string[], focused: string | null) => void;
}

/* ── Flesch–Kincaid grade level (approximate) ──────────────────────── */
const countSyllables = (word: string): number => {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return w ? 1 : 0;
  const groups = w.replace(/e$/, '').match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
};

const readability = (text: string): { score: number; grade: number } => {
  const clean = (text || '').trim();
  if (!clean) return { score: 0, grade: 0 };
  const words = clean.split(/\s+/).filter(Boolean);
  const sentences = Math.max(1, (clean.match(/[.!?]+/g) || []).length);
  const syllables = words.reduce((s, w) => s + countSyllables(w), 0);
  if (words.length === 0) return { score: 0, grade: 0 };
  const fk = 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
  const grade = Math.max(1, Math.min(16, Math.round(fk)));
  return { score: Math.max(0, Math.round(fk * 10) / 10), grade };
};

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" width={16} height={16} style={{ color: '#52525c', flexShrink: 0 }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" />
  </svg>
);

const Divider = () => <div style={{ minHeight: 1, height: 1, flexShrink: 0, background: '#f4f4f5', alignSelf: 'stretch' }} />;

const OutlineButton = ({ label, disabled, onClick }: { label: React.ReactNode; disabled?: boolean; onClick?: () => void }) => (
  <button type="button" disabled={disabled} onClick={onClick}
    style={{ width: '100%', padding: '9px 16px', borderRadius: 6, border: 'none', boxShadow: 'inset 0 0 0 1px #e4e4e7', background: 'transparent', color: '#3f3f47', fontSize: 14, fontWeight: 600, fontFamily: F, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'background 0.15s' }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = '#f4f4f5'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
    {label}
  </button>
);


const Spinner = () => (
  <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(63,63,71,0.25)', borderTopColor: '#3f3f47', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
);

const Busy = ({ label }: { label: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Spinner />{label}</span>
);

type AiReadabilityCriterion = { key: string; met: boolean; note?: string; suggestions?: string[] };
export type AiReadabilityResult = { score: number; criteria: AiReadabilityCriterion[] };

// A saved result is only usable by the new suggestions UI if it carries the `suggestions` shape.
// Old saved results (met/note only) are treated as "not analyzed" so the Analyze button shows.
const hasSuggestionShape = (r?: AiReadabilityResult | null): boolean => !!r?.criteria?.some((c) => Array.isArray(c.suggestions));

const AI_READABILITY_CRITERIA: Array<{ key: string; title: string; desc: string }> = [
  { key: 'introduction', title: 'Introduction Section', desc: "Clear, dedicated introduction that sets expectations (what's covered, who it's for, why it matters) and provides context." },
  { key: 'early_query', title: 'Early Query Confirmation', desc: 'Target query and core topic are clearly addressed within the first paragraph or visible screen area, giving users immediate confirmation of relevance.' },
  { key: 'search_intent', title: 'Search Intent Alignment', desc: 'Content directly addresses the implied search intent with relevant information prominently featured throughout the document.' },
  { key: 'concept_clarity', title: 'Concept Definition and Relationship Clarity', desc: 'Key concepts are explicitly defined and relationships between ideas are clearly stated, enabling both human readers and LLMs to understand how concepts connect and build upon each other.' },
  { key: 'progression', title: 'General-to-Specific Progression', desc: 'Content follows a clear educational progression from broad concepts to specific details, with each level building naturally on the previous understanding.' },
  { key: 'inter_section', title: 'Inter-Section Connectivity', desc: 'Each section connects logically to the next with clear transitions, creating a coherent narrative flow that guides readers naturally through the content.' },
  { key: 'self_sufficiency', title: 'Contextual Self-Sufficiency', desc: 'Content provides sufficient background context and foundational information for the target audience to understand the material without requiring external resources, while maintaining appropriate links to related topics.' },
  { key: 'top_headings', title: 'Top-Level Heading Structure', desc: 'All major sections have clear and consistently formatted top-level headings (h1 or h2) that accurately reflect the content, enabling easy navigation and comprehension.' },
  { key: 'subheadings', title: 'Subheading and Navigation Structure', desc: 'All content sections have clear, descriptive, and consistently formatted subheadings that enable quick scanning and navigation; sections are appropriately sized (3-5 sentences) and well-organized for optimal readability.' },
  { key: 'info_density', title: 'Information Density Optimization', desc: 'Complex information is systematically condensed into essential points that preserve meaning while eliminating redundancy, with content appropriately structured using the most effective format (clearly labeled sequential steps for procedures, bullet points for lists, tables for comparisons).' },
];

const AiReadabilityInfoModal = ({ onClose, result }: { onClose: () => void; result?: AiReadabilityResult | null }) => createPortal(
  <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: F }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 600, maxHeight: '85vh', background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 24px 16px' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#18181b' }}>How do we assess AI Readability?</h2>
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#52525c', display: 'inline-flex', padding: 0, marginLeft: 12 }}>
          <svg viewBox="0 0 24 24" width={22} height={22}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="styled-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {AI_READABILITY_CRITERIA.map((c) => {
          const r = result?.criteria?.find((x) => x.key === c.key);
          const analyzed = !!result;
          const met = !!r?.met;
          return (
            <div key={c.key} style={{ display: 'flex', gap: 12, background: '#f8f8f9', borderRadius: 12, padding: 16 }}>
              <span style={{ flexShrink: 0, marginTop: 2, width: 16, height: 16, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: !analyzed ? '#d4d4d8' : met ? '#1AB25E' : '#fff', border: analyzed && !met ? '2px solid #e4e4e7' : 'none' }}>
                {analyzed && met && (
                  <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M16.7 5.2 8.7 15.7l-4.5-4.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#18181b' }}>{c.title}</span>
                <span style={{ fontSize: 14, lineHeight: '20px', color: '#52525c' }}>{c.desc}</span>
                {r?.note && <span style={{ fontSize: 12, color: met ? '#1AB25E' : '#9f9fa9', fontStyle: 'italic' }}>{r.note}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ borderTop: '1px solid #f4f4f5', padding: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#18181b', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F, transition: 'background 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#783afb'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#18181b'; }}>
          Close
        </button>
      </div>
    </div>
  </div>,
  document.body,
);

const PrePublishPanel = ({ score, aiScore, hasAi, plainText, articleId, readOnly, onBack, initialPlagiarism, initialAiReadability, onApplyReadability, onPlagiarismHighlight }: Props) => {
  const r = readability(plainText);
  const mainScore = (hasAi && typeof aiScore === 'number') ? Math.round((score + aiScore) / 2) : score;
  const [scoreTip, setScoreTip] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showPlagPanel, setShowPlagPanel] = useState(false);
  const [showAiInfo, setShowAiInfo] = useState(false);
  const [plag, setPlag] = useState<PlagiarismResult | null>(initialPlagiarism ?? null);
  const [aiRead, setAiRead] = useState<AiReadabilityResult | null>(hasSuggestionShape(initialAiReadability) ? initialAiReadability! : null);
  const [analyzingRead, setAnalyzingRead] = useState(false);

  // Seed from saved results once they arrive (only the new suggestions-shaped result, and only
  // if not run yet this session).
  useEffect(() => { if (initialPlagiarism && plag === null) setPlag(initialPlagiarism); }, [initialPlagiarism, plag]);
  useEffect(() => { if (hasSuggestionShape(initialAiReadability) && aiRead === null) setAiRead(initialAiReadability!); }, [initialAiReadability, aiRead]);

  // "Analyze Content" runs ONLY the AI Readability rubric — it must never touch the AI Search
  // score (that's driven by the separate ai-visibility analysis). Decoupled on purpose, which
  // also stops the editor's AI glow ring (gated on isRunningAiVisibility) from firing here.
  const analyze = () => {
    if (!articleId || analyzingRead) return;
    setAnalyzingRead(true);
    fetch('/api/articles/ai-readability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ articleId }) })
      .then((res) => res.json())
      .then((d) => { if (d && Array.isArray(d.criteria)) setAiRead(d); })
      .catch(() => {})
      .finally(() => setAnalyzingRead(false));
  };

  const scanAbortRef = useRef<AbortController | null>(null);
  const runPlagiarism = async () => {
    if (!articleId || scanning) return;
    setScanning(true);
    setPlag(null);
    const controller = new AbortController();
    scanAbortRef.current = controller;
    try {
      const res = await fetch('/api/articles/plagiarism', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Scan failed');
      if (data.available === false) { toast.error('Plagiarism scan unavailable — SERP key not configured'); return; }
      setPlag(data);
      setShowPlagPanel(true);
      toast.success(`Scan complete — ${data.uniqueness}% unique`);
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // user cancelled — no toast
      toast.error(e?.message || 'Scan failed');
    } finally { scanAbortRef.current = null; setScanning(false); }
  };
  const cancelScan = () => { scanAbortRef.current?.abort(); setScanning(false); };

  // Plagiarism check replaces the panel with its own dedicated view (Close → back here).
  if (showPlagPanel && plag) {
    return (
      <>
        <PlagiarismPanel
          result={plag}
          onClose={() => setShowPlagPanel(false)}
          onRescan={runPlagiarism}
          rescanning={scanning}
          readOnly={readOnly}
          onHighlight={onPlagiarismHighlight}
        />
        {scanning && <PlagiarismScanningModal onCancel={cancelScan} />}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: F }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={onBack} title="Back"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: 'none', background: '#f4f4f5', cursor: 'pointer', color: '#18181b' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e4e4e7'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#f4f4f5'; }}>
            <svg viewBox="0 0 20 20" width={20} height={20}><path fill="currentColor" fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0" clipRule="evenodd" /></svg>
          </button>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#18181b' }}>Pre-Publish Review</span>
        </div>
        <div
          style={{ position: 'relative', display: 'inline-flex' }}
          onMouseEnter={() => setScoreTip(true)}
          onMouseLeave={() => setScoreTip(false)}
        >
          <MiniGauge score={mainScore} />
          {scoreTip && (
            <div style={{ position: 'absolute', top: '50%', right: 'calc(100% + 10px)', transform: 'translateY(-50%)', background: '#18181b', color: '#fff', borderRadius: 8, padding: '8px 12px', whiteSpace: 'nowrap', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', fontFamily: F }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: '#a1a1aa' }}>SEO</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{Math.round(score)}</span>
              </div>
              {hasAi && typeof aiScore === 'number' && (
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 6, paddingTop: 6, borderTop: '1px solid #3f3f47' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: '#a1a1aa' }}>AI SEARCH</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{aiScore}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 16 }} className="styled-scrollbar">
        {/* Readability Score */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: '#18181b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Readability Score <InfoIcon /></span>
            <span>{r.score || '—'}</span>
          </div>
          <span style={{ fontSize: 13, color: '#52525c' }}>
            {r.grade
              ? <>Your text can be read by people with at least grade {ordinal(r.grade)} education</>
              : 'Add content to compute readability'}
          </span>
        </div>

        <Divider />

        {/* Plagiarism Check */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#18181b' }}>Plagiarism Check</span>
          <OutlineButton
            disabled={scanning || !articleId || readOnly}
            onClick={runPlagiarism}
            label={scanning
              ? <Busy label="Scanning the web…" />
              : plag ? 'Re-run Plagiarism Checker' : 'Run Plagiarism Checker'}
          />
          {!plag && !scanning && (
            <span style={{ fontSize: 13, color: '#52525c' }}>Checks representative passages against the web for verbatim matches.</span>
          )}
        </div>

        <Divider />

        {/* AI Readability */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#18181b' }}>
              AI Readability
              <button type="button" onClick={() => setShowAiInfo(true)} aria-label="How do we assess AI Readability?" title="How do we assess AI Readability?" style={{ display: 'inline-flex', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: '#52525c' }}>
                <InfoIcon />
              </button>
            </span>
            {aiRead && !analyzingRead && (
              <button type="button" onClick={analyze} disabled={readOnly} aria-label="Re-run analysis" title="Re-run analysis"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: readOnly ? 'not-allowed' : 'pointer', color: '#52525c' }}
                onMouseEnter={(e) => { if (!readOnly) e.currentTarget.style.background = '#f4f4f5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
              </button>
            )}
          </div>

          {analyzingRead ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '2px 0', fontSize: 13, lineHeight: '20px', color: '#52525c' }}>
              <span style={{ marginTop: 2, flexShrink: 0 }}><Spinner /></span>
              <span>Assessing how clearly your content is structured for AI models. This may take a minute or two.</span>
            </div>
          ) : !aiRead ? (
            <>
              <OutlineButton disabled={readOnly} onClick={analyze} label="Analyze Content" />
              <span style={{ fontSize: 13, color: '#52525c' }}>Checks how clearly your content is structured for AI models against 10 criteria.</span>
            </>
          ) : (() => {
            const cards = aiRead.criteria.filter((c) => (c.suggestions?.length ?? 0) > 0);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9f9fa9' }}>
                  <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx={10} cy={10} r={7} /></svg>
                  {cards.length === 0
                    ? <span style={{ color: '#1AB25E', fontWeight: 500 }}>All criteria met — nothing to improve.</span>
                    : <span>0/{cards.length} suggestions</span>}
                </div>
                {onApplyReadability && cards.length > 0 && (
                  <button type="button" disabled={readOnly} onClick={() => onApplyReadability(aiRead)}
                    style={{ width: '100%', padding: '9px 16px', borderRadius: 8, border: 'none', background: '#18181b', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: F, cursor: readOnly ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { if (!readOnly) e.currentTarget.style.background = '#783afb'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#18181b'; }}>
                    Apply All
                  </button>
                )}
                {cards.map((c) => {
                  const title = AI_READABILITY_CRITERIA.find((x) => x.key === c.key)?.title || c.key;
                  return (
                    <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, border: '1px solid #f4f4f5', borderRadius: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9f9fa9' }}>{title}</div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {(c.suggestions ?? []).map((s, i) => (
                          <span key={i} style={{ fontSize: 14, lineHeight: '20px', color: '#3f3f47', whiteSpace: 'pre-wrap', paddingTop: i === 0 ? 0 : 12, marginTop: i === 0 ? 0 : 12, borderTop: i === 0 ? 'none' : '1px solid #f4f4f5' }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {showAiInfo && <AiReadabilityInfoModal onClose={() => setShowAiInfo(false)} result={aiRead} />}
      {scanning && <PlagiarismScanningModal onCancel={cancelScan} />}
    </div>
  );
};

export default PrePublishPanel;
