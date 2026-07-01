import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOpenReveal } from '../../lib/motion/useOpenReveal';
import { createPortal } from 'react-dom';
import { NlpTerm, Coverage, termCoverage, termUsageHint } from '../../lib/contentScore';
import { AiVisibilitySummary } from '../../lib/aiSearchScore';
import type { CoverageItem, BucketScore, CoverageSnapshot } from '../../lib/aiCoverage';
import { buildGuidelines, groupGuidelines } from '../../lib/recommendationEngine';
import type { Guideline, GuidelineEffort } from '../../lib/recommendationEngine';
import ScoreTrio from './ScoreTrio';
import { TIP_BUBBLE_BASE } from './tipBubble';

const F = 'var(--font-family-primary)';

/** useState that persists to localStorage so panel settings survive reloads. */
function usePersist<T>(key: string, fallback: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [val, setVal] = useState<T>(() => {
    if (typeof window === 'undefined') return fallback;
    try { const v = window.localStorage.getItem(key); return v == null ? fallback : (JSON.parse(v) as T); } catch { return fallback; }
  });
  useEffect(() => { try { window.localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } }, [key, val]);
  return [val, setVal];
}

interface Props {
  terms: NlpTerm[];
  wordCount: number;
  headingCount: number;
  paragraphCount: number;
  wordsRange: string;
  headingsRange: string;
  parasRange: string;
  aiSummary?: AiVisibilitySummary | null;
  seo: number;
  ai: number;
  hasAi: boolean;
  /** Coverage Engine snapshot — drives the bucket badges, Intent, and Info-to-cover cards. */
  coverageItems?: CoverageItem[];
  coverageBuckets?: BucketScore[];
  /** The parsed CoverageSnapshot (NOT reconstructed) — drives the AI Search Guidelines (Priority strip + groups). */
  coverageSnapshot?: CoverageSnapshot | null;
  onAutoOptimize?: () => void;
  isAutoOptimizing?: boolean;
  readOnly?: boolean;
  onBack: () => void;
  /** Toggles term highlighting in the editor (drives the TipTap decoration). */
  highlightTerms?: boolean;
  onHighlightTermsChange?: (on: boolean) => void;
  /** Which section to expand + scroll to on open (driven by clicking a score gauge). */
  initialSection?: 'seo' | 'ai';
}

/* ── Coverage status ───────────────────────────────────────────────── */
const TINT: Record<Coverage, string> = { red: '#FCE9E9', yellow: '#FBEFD6', green: '#E4F5EA' };

/* ── Reusable: hover tooltip (portal → never clipped by the panel overflow) ── */
const Tip = ({ text, children, block }: { text: string; children: React.ReactNode; block?: boolean }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const open = () => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    const half = 145; // keep the bubble (max 280 wide) on-screen
    const x = Math.min(Math.max(r.left + r.width / 2, 12 + half), window.innerWidth - 12 - half);
    const below = r.top < 60;
    setPos({ x, y: below ? r.bottom + 8 : r.top - 8, below });
  };
  return (
    <span ref={ref} style={{ display: block ? 'block' : 'inline-flex', alignItems: 'center', maxWidth: '100%' }} onMouseEnter={open} onMouseLeave={() => setPos(null)}>
      {children}
      {pos && createPortal(
        <div style={{ ...TIP_BUBBLE_BASE, left: pos.x, top: pos.y, transform: `translate(-50%, ${pos.below ? '0' : '-100%'})`, width: 'max-content', maxWidth: 280, textAlign: 'left' }}>
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
};

/* ── Reusable: header icon popover (settings / copy) ───────────────── */
const Popover = ({ iconD, title, fillIcon, children }: { iconD: string; title: string; fillIcon?: boolean; children: (close: () => void) => React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button" title={title} onClick={() => setOpen((v) => !v)}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: 'none', background: open ? '#f4f4f5' : 'transparent', cursor: 'pointer', color: '#52525c' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = open ? '#f4f4f5' : 'transparent'; }}
      >
        <svg viewBox="0 0 24 24" width={18} height={18}><path {...(fillIcon ? { fill: 'currentColor' } : { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const })} d={iconD} /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(24,26,34,0.16), 0 2px 6px rgba(24,26,34,0.08)', padding: '8px 0', minWidth: 224, zIndex: 350, fontFamily: F, animation: 'growOut 0.16s cubic-bezier(0.16,1,0.3,1)' }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};

const SecLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: '#9f9fa9', textTransform: 'uppercase' }}>{children}</div>
);

const Toggle = ({ on }: { on: boolean }) => (
  <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? '#783afb' : '#d4d4d8', position: 'relative', flexShrink: 0, transition: 'background 0.15s', display: 'inline-block' }}>
    <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
  </span>
);
const ToggleRow = ({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) => (
  <button type="button" onClick={onChange} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: F }}>
    <Toggle on={on} />
    <span style={{ fontSize: 14, color: '#18181b' }}>{label}</span>
  </button>
);

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ color: '#18181b', flexShrink: 0 }}><path d="M16.7 5.2 8.7 15.7l-4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const MenuItem = ({ label, onClick, checked }: { label: string; onClick: () => void; checked?: boolean }) => (
  <button type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: F, fontSize: 14, color: '#18181b', textAlign: 'left' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
    <span>{label}</span>{checked && <Check />}
  </button>
);

const InfoDot = ({ tip }: { tip: string }) => (
  <Tip text={tip}>
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="#9f9fa9" strokeWidth={1.5} style={{ cursor: 'help' }}><path d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </Tip>
);

const copy = (text: string) => { try { navigator.clipboard?.writeText(text); } catch { /* ignore */ } };

/** Legacy fallback (pre-Coverage-Engine): one row per LLM prompt from AI-visibility citations.
 *  Used only when coverageItems has no 'paa'/'fact' rows (older articles / AI-visibility-only runs).
 *  Shape mirrors the CoverageItem fields the render actually reads, so both sources render identically. */
type LegacyInfoItem = { id: string; label: string; covered: boolean; missing?: readonly string[]; domains: string[] };
const buildInfoToCover = (summary?: AiVisibilitySummary | null): LegacyInfoItem[] => {
  if (!summary?.citations?.length) return [];
  const byPrompt = new Map<string, LegacyInfoItem>();
  for (const c of summary.citations) {
    if (!c.prompt) continue;
    const item = byPrompt.get(c.prompt) || { id: c.prompt, label: c.prompt, covered: (c.answer_readiness_score ?? 0) >= 60, domains: [] };
    if (c.cited_domain && !item.domains.includes(c.cited_domain)) item.domains.push(c.cited_domain);
    byPrompt.set(c.prompt, item);
  }
  return [...byPrompt.values()];
};

/* ── Term chip ─────────────────────────────────────────────────────── */
const TermChip = ({ term, showCount, showRange }: { term: NlpTerm; showCount: boolean; showRange: boolean }) => {
  const cur = term.current_count ?? 0;
  const tint = TINT[termCoverage(term)];
  return (
    <Tip text={termUsageHint(term)}>
      <div style={{ display: 'inline-flex', alignItems: 'stretch', borderRadius: 9999, background: tint, fontFamily: F, maxWidth: '100%' }}>
        <span style={{ padding: showCount ? '5px 8px 5px 12px' : '5px 12px', fontSize: 13, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{term.term}</span>
        {showCount && (
          <span style={{ display: 'inline-flex', alignItems: 'center', background: '#fff', borderRadius: 9999, margin: 2, padding: '2px 10px', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#18181b' }}>{cur}</span>
            {showRange && <span style={{ fontSize: 13, color: '#9f9fa9' }}>/{term.target_count}</span>}
          </span>
        )}
      </div>
    </Tip>
  );
};

const Chevron = ({ open, size = 16, color = '#9f9fa9' }: { open: boolean; size?: number; color?: string }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} style={{ color, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
    <path fill="currentColor" fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
  </svg>
);

/* Status dot — covered (#1AB25E) / uncovered (muted #D4D4D8), per design.md delta/checklist tokens. */
const StatusDot = ({ covered }: { covered: boolean }) => (
  <span style={{ width: 8, height: 8, borderRadius: 9999, background: covered ? '#1AB25E' : '#D4D4D8', flexShrink: 0 }} />
);

/* Grouped accordion card inside AI Search (e.g. "Upfront Intent Alignment"). */
const InfoCard = ({ title, badge, items, defaultOpen = true }: {
  title: string; badge?: string; items: Array<{ text: string; covered: boolean; domains?: string[]; missing?: readonly string[] }>; defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: '#f4f4f5', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: F }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#18181b', textAlign: 'left' }}>{title}</span>
        {badge && (
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 6px', borderRadius: 4, border: '1px solid #AA93FD', color: '#783AFB', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{badge}</span>
        )}
        <span style={{ marginLeft: 'auto' }}><Chevron open={open} color="#18181b" /></span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <StatusDot covered={it.covered} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: '19px', color: it.covered ? '#9f9fa9' : '#18181b', textDecoration: it.covered ? 'line-through' : 'none' }}>{it.text}</span>
                </span>
                {it.domains && it.domains.length > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, alignSelf: 'center' }}>
                    {it.domains.slice(0, 2).map((d) => (
                      <img key={d} alt="" width={14} height={14} style={{ borderRadius: 3 }} src={`https://www.google.com/s2/favicons?domain=${d}&sz=32`} />
                    ))}
                  </span>
                )}
                <span style={{ flexShrink: 0, fontSize: 12, color: it.covered ? '#9f9fa9' : '#52525c' }}>{it.covered ? 'Covered' : 'To cover'}</span>
              </div>
              {!it.covered && it.missing && it.missing.length > 0 && (
                <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {it.missing.map((m, k) => (
                    <li key={k} style={{ fontSize: 12, lineHeight: '16px', color: '#52525c' }}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── AI Search Guidelines (Recommendation Engine UI) ──────────────────
 * Priority strip (top ~3-5 guidelines by projectedLift across all groups) + value-ordered
 * groups (weakest score first), each with sorted guideline rows. Reuses StatusDot, pill
 * (borderRadius:9999) and card-border (#F4F4F5) conventions already used above. */
const EFFORT_TINT: Record<GuidelineEffort, string> = { Easy: '#E4F5EA', Medium: '#FBEFD6', Large: '#FCE9E9' };
const EFFORT_TEXT: Record<GuidelineEffort, string> = { Easy: '#0F7A3D', Medium: '#8A6116', Large: '#B23A3A' };

const EffortChip = ({ effort }: { effort: GuidelineEffort }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, borderRadius: 9999, background: EFFORT_TINT[effort], color: EFFORT_TEXT[effort], fontSize: 11, fontWeight: 600, padding: '2px 8px', fontFamily: F }}>
    {effort}
  </span>
);

const EasyWinBadge = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, height: 18, padding: '0 6px', borderRadius: 4, border: '1px solid #AA93FD', color: '#783AFB', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: F }}>
    Easy win
  </span>
);

/** Splits a Guideline's `instruction` into a leading non-bulleted sentence (if any) plus the
 *  `• `-prefixed checklist lines (rendered as a real <ul>). */
const splitInstruction = (instruction: string): { lead: string | null; bullets: string[] } => {
  const lines = instruction.split('\n');
  const bullets: string[] = [];
  const lead: string[] = [];
  for (const line of lines) {
    if (line.startsWith('• ')) bullets.push(line.slice(2));
    else if (line.trim()) lead.push(line);
  }
  return { lead: lead.length ? lead.join(' ') : null, bullets };
};

const GuidelineRow = ({ guideline, covered }: { guideline: Guideline; covered: boolean }) => {
  const { lead, bullets } = splitInstruction(guideline.instruction);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0', borderTop: '1px solid #F4F4F5' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <StatusDot covered={covered} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: '19px', fontWeight: 500, color: '#18181b' }}>{guideline.title}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1AB25E' }}>+{guideline.projectedLift}</span>
          <EffortChip effort={guideline.effort} />
          {guideline.easyWin && <EasyWinBadge />}
        </span>
      </div>
      {lead && <p style={{ margin: 0, marginLeft: 16, fontSize: 12, lineHeight: '16px', color: '#52525c' }}>{lead}</p>}
      {bullets.length > 0 && (
        <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {bullets.map((b, k) => (
            <li key={k} style={{ fontSize: 12, lineHeight: '16px', color: '#52525c' }}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Top ~3-5 guidelines across ALL groups, sorted by projectedLift desc. */
const PriorityStrip = ({ groups, coveredById }: { groups: import('../../lib/recommendationEngine').GuidelineGroup[]; coveredById: Map<string, boolean> }) => {
  const top = useMemo(() => (
    groups
      .flatMap((g) => g.guidelines)
      .slice()
      .sort((a, b) => b.projectedLift - a.projectedLift)
      .slice(0, 5)
  ), [groups]);
  if (top.length === 0) return null;
  return (
    <div style={{ background: '#f4f4f5', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#18181b' }}>Priority</span>
      <div>
        {top.map((g) => (
          <GuidelineRow key={g.id} guideline={g} covered={coveredById.get(g.coverageItemId) ?? false} />
        ))}
      </div>
    </div>
  );
};

/** One value-ordered group (weakest score first): header (label + score% pill + covered/total) + rows. */
const GuidelineGroupCard = ({ group, coveredById }: { group: import('../../lib/recommendationEngine').GuidelineGroup; coveredById: Map<string, boolean> }) => (
  <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, background: '#fff', padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#18181b' }}>{group.label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 9999, background: '#f4f4f5', padding: '2px 10px', fontSize: 12, fontWeight: 500, color: '#18181b', fontFamily: F }}>{group.score}%</span>
      <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9f9fa9' }}>{group.covered}/{group.total} covered</span>
    </div>
    {group.guidelines.length === 0 ? (
      <p style={{ fontSize: 13, color: '#9f9fa9', textAlign: 'center', padding: '8px 0', margin: 0 }}>—</p>
    ) : (
      <div>
        {group.guidelines.map((g) => (
          <GuidelineRow key={g.id} guideline={g} covered={coveredById.get(g.coverageItemId) ?? false} />
        ))}
      </div>
    )}
  </div>
);

/* ── Bottom metric ─────────────────────────────────────────────────── */
const MetricBottom = ({ label, value, range }: { label: string; value: number; range: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 2 }}>
    <span style={{ fontSize: 11, fontWeight: 400, lineHeight: '14px', color: '#3f3f47', fontFamily: F }}>{label}</span>
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, lineHeight: '14px', color: '#000', fontFamily: F }}>{value.toLocaleString()}</span>
      <span style={{ fontSize: 11, fontWeight: 400, lineHeight: '14px', color: '#52525c', fontFamily: F }}>{range}</span>
    </span>
  </div>
);

const ICON_SLIDERS = 'M3 8L15 8M15 8C15 9.65686 16.3431 11 18 11C19.6569 11 21 9.65685 21 8C21 6.34315 19.6569 5 18 5C16.3431 5 15 6.34315 15 8ZM9 16L21 16M9 16C9 17.6569 7.65685 19 6 19C4.34315 19 3 17.6569 3 16C3 14.3431 4.34315 13 6 13C7.65685 13 9 14.3431 9 16Z';
const ICON_COPY = 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2M10 8h10c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H10c-1.1 0-2-.9-2-2V10c0-1.1.9-2 2-2Z';

type AiSort = 'missing' | 'alpha';

const WriteOptimizePanel = ({
  terms, wordCount, headingCount, paragraphCount, wordsRange, headingsRange, parasRange, aiSummary,
  seo, ai, hasAi, coverageItems, coverageBuckets, coverageSnapshot, onAutoOptimize, isAutoOptimizing, readOnly, onBack, highlightTerms, onHighlightTermsChange,
  initialSection,
}: Props) => {
  const [tab, setTab] = useState<'all' | 'headings'>('all');
  const [seoOpen, setSeoOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Score-gauge shortcuts: expand a section and scroll it into view. The SEO block
  // sits at the top of the scroll area; the AI block lives further down.
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<HTMLDivElement>(null);
  // Height + fade reveal when a section opens (close is instant — the block unmounts).
  const seoRevealRef = useOpenReveal<HTMLDivElement>(seoOpen);
  const aiRevealRef = useOpenReveal<HTMLDivElement>(aiOpen);
  // Opening one section collapses the other (mutually exclusive focus).
  const expandSeo = () => { setSeoOpen(true); setAiOpen(false); requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })); };
  const expandAi = () => { setAiOpen(true); setSeoOpen(false); requestAnimationFrame(() => aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  // Honour the section requested when the panel was opened from a score gauge.
  useEffect(() => {
    if (initialSection === 'ai') expandAi();
    else if (initialSection === 'seo') expandSeo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SEO entity display settings (mirrors Surfer's settings popover) — persisted.
  const [countRanges, setCountRanges] = usePersist('wo:countRanges', true);
  const [showOptimized, setShowOptimized] = usePersist('wo:showOptimized', true);
  const [showPartial, setShowPartial] = usePersist('wo:showPartial', true);
  const [showUnused, setShowUnused] = usePersist('wo:showUnused', true);
  const [showRanges, setShowRanges] = usePersist('wo:showRanges', true);
  const [hlTerms, setHlTerms] = usePersist('wo:highlight', highlightTerms ?? true);
  const [autoSuggest, setAutoSuggest] = usePersist('wo:autoSuggest', true);

  // AI Search settings — persisted.
  const [aiGrouping, setAiGrouping] = usePersist('wo:aiGrouping', true);
  const [aiSort, setAiSort] = usePersist<AiSort>('wo:aiSort', 'missing');

  // Highlighting is active only while this panel is open (Write & Optimize view),
  // following the toggle; cleared when the panel unmounts.
  useEffect(() => { onHighlightTermsChange?.(hlTerms); }, [hlTerms, onHighlightTermsChange]);
  useEffect(() => () => { onHighlightTermsChange?.(false); }, [onHighlightTermsChange]);

  const intentRows = useMemo(() => (coverageItems ?? []).filter((i) => i.category === 'intent'), [coverageItems]);
  const coverageKnowledgeRows = useMemo(() => (coverageItems ?? []).filter((i) => i.type === 'paa' || i.type === 'fact'), [coverageItems]);
  // Backward compat: older articles (or AI-visibility-only runs) have no coverage snapshot, so
  // coverageKnowledgeRows is empty — fall back to the legacy AI-visibility citations list so
  // "Information to cover" still populates for them.
  const legacyKnowledgeRows = useMemo(() => buildInfoToCover(aiSummary), [aiSummary]);
  const knowledgeRows = coverageKnowledgeRows.length > 0 ? coverageKnowledgeRows : legacyKnowledgeRows;
  const bucketBadges = useMemo(() => (coverageBuckets ?? []).filter((b) => b.items > 0), [coverageBuckets]);
  const headingTerms = useMemo(() => terms.filter((t) => t.target_count >= 6), [terms]);
  const tabList = tab === 'headings' ? headingTerms : terms;
  const q = query.trim().toLowerCase();
  const list = useMemo(() => tabList.filter((t) => {
    if (q && !t.term.toLowerCase().includes(q)) return false;
    const c = termCoverage(t);
    if (c === 'green' && !showOptimized) return false;
    if (c === 'yellow' && !showPartial) return false;
    if (c === 'red' && !showUnused) return false;
    return true;
  }), [tabList, q, showOptimized, showPartial, showUnused]);

  const knowledgeSorted = useMemo(() => {
    const arr = [...knowledgeRows];
    if (aiSort === 'alpha') arr.sort((a, b) => a.label.localeCompare(b.label));
    else arr.sort((a, b) => Number(a.covered) - Number(b.covered)); // missing first
    return arr;
  }, [knowledgeRows, aiSort]);

  // AI Search Guidelines — built from the real parsed CoverageSnapshot (never reconstructed; see
  // task-4 cross-task resolution). Groups are ordered weakest-score-first so the highest-value
  // work surfaces first; empty groups still render (muted "—").
  const guidelineGroups = useMemo(
    () => (coverageSnapshot ? groupGuidelines(buildGuidelines(coverageSnapshot), coverageSnapshot) : []),
    [coverageSnapshot],
  );
  const orderedGuidelineGroups = useMemo(
    () => [...guidelineGroups].sort((a, b) => a.score - b.score),
    [guidelineGroups],
  );
  const coveredById = useMemo(() => {
    const map = new Map<string, boolean>();
    (coverageSnapshot?.items ?? []).forEach((item) => map.set(item.id, item.covered));
    return map;
  }, [coverageSnapshot]);

  // Copy helpers
  const copyTerms = (src: NlpTerm[], which: 'all' | 'missing' | 'covered') => {
    const sel = src.filter((t) => which === 'all' || (which === 'missing' && termCoverage(t) === 'red') || (which === 'covered' && termCoverage(t) === 'green'));
    copy(sel.map((t) => t.term).join('\n'));
  };
  const copyFacts = (which: 'all' | 'missing' | 'covered') => {
    const sel = knowledgeRows.filter((i) => which === 'all' || (which === 'missing' && !i.covered) || (which === 'covered' && i.covered));
    copy(sel.map((i) => i.label).join('\n'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: F }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes growOut { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={onBack} title="Back" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid #e4e4e7', background: '#fff', cursor: 'pointer', color: '#18181b' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8f8f9'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}>
            <svg viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="m15 18l-6-6l6-6" /></svg>
          </button>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#18181b' }}>Write &amp; Optimize</span>
        </div>
      </div>

      {/* Gauge trio + Auto-Optimize */}
      <div style={{ paddingTop: 8 }}>
        <ScoreTrio seo={seo} ai={ai} hasAi={hasAi} onSeoClick={expandSeo} onAiClick={expandAi} />
      </div>
      <div style={{ padding: '0 16px 14px' }}>
        <button
          type="button" onClick={(isAutoOptimizing || readOnly) ? undefined : onAutoOptimize} disabled={isAutoOptimizing || readOnly}
          style={{ width: '100%', padding: '9px 0', borderRadius: 6, fontSize: 13, fontWeight: 600, background: '#18181b', color: '#fff', border: 'none', cursor: (isAutoOptimizing || readOnly) ? 'not-allowed' : 'pointer', fontFamily: F, opacity: (isAutoOptimizing || readOnly) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s' }}
          onMouseEnter={(e) => { if (!isAutoOptimizing && !readOnly) e.currentTarget.style.background = '#630de3'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#18181b'; }}
        >
          {isAutoOptimizing ? (
            <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Optimizing…</>
          ) : 'Auto-Optimize'}
        </button>
      </div>

      {/* SEO Entities subheader */}
      <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" onClick={() => setSeoOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: F }}>
          <Chevron open={seoOpen} color="#18181b" />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#18181b' }}>SEO</span>
          <span style={{ fontSize: 15, color: '#9f9fa9', display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Entities to cover
            <InfoDot tip="Based on top-ranking pages, these are the entities to include to optimize for SEO" />
          </span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {/* Settings */}
          <Popover iconD={ICON_SLIDERS} title="Display settings">
            {() => (
              <>
                <ToggleRow label="Count ranges" on={countRanges} onChange={() => setCountRanges((v) => !v)} />
                <SecLabel>Terms visibility</SecLabel>
                <ToggleRow label="Optimized terms" on={showOptimized} onChange={() => setShowOptimized((v) => !v)} />
                <ToggleRow label="Partially optimized terms" on={showPartial} onChange={() => setShowPartial((v) => !v)} />
                <ToggleRow label="Unused terms" on={showUnused} onChange={() => setShowUnused((v) => !v)} />
                <SecLabel>Display options</SecLabel>
                <ToggleRow label="Show ranges" on={showRanges} onChange={() => setShowRanges((v) => !v)} />
                <ToggleRow label="Highlight terms" on={hlTerms} onChange={() => setHlTerms((v) => !v)} />
                <ToggleRow label="Auto suggestions" on={autoSuggest} onChange={() => setAutoSuggest((v) => !v)} />
              </>
            )}
          </Popover>
          {/* Copy */}
          <Popover iconD={ICON_COPY} title="Copy entities">
            {(close) => (
              <>
                <SecLabel>All entities</SecLabel>
                <MenuItem label="Copy all" onClick={() => { copyTerms(terms, 'all'); close(); }} />
                <MenuItem label="Copy missing" onClick={() => { copyTerms(terms, 'missing'); close(); }} />
                <MenuItem label="Copy covered" onClick={() => { copyTerms(terms, 'covered'); close(); }} />
                <SecLabel>Entities in headings</SecLabel>
                <MenuItem label="Copy all" onClick={() => { copyTerms(headingTerms, 'all'); close(); }} />
                <MenuItem label="Copy missing" onClick={() => { copyTerms(headingTerms, 'missing'); close(); }} />
                <MenuItem label="Copy covered" onClick={() => { copyTerms(headingTerms, 'covered'); close(); }} />
              </>
            )}
          </Popover>
        </div>
      </div>

      {/* Search entities */}
      {seoOpen && (
        <div style={{ padding: '10px 16px 0' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg viewBox="0 0 24 24" width={18} height={18} style={{ position: 'absolute', left: 12, color: '#52525c', pointerEvents: 'none' }}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607" /></svg>
            <input
              value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search entities"
              style={{ width: '100%', boxSizing: 'border-box', height: 40, padding: '0 12px 0 38px', borderRadius: 8, border: '1px solid #d4d4d8', outline: 'none', fontSize: 14, fontFamily: F, color: '#18181b' }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      {seoOpen && (
        <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'flex-end', gap: 16, borderBottom: '1px solid #f4f4f5' }}>
          {([['all', 'All', terms.length], ['headings', 'Headings', headingTerms.length]] as const).map(([key, label, count]) => {
            const on = tab === key;
            return (
              <button key={key} type="button" onClick={() => setTab(key)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 0 10px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, color: on ? '#18181b' : '#52525c', fontFamily: F,
                borderBottom: on ? '2px solid #783afb' : '2px solid transparent', marginBottom: -1,
              }}>
                {label}
                <span style={{ background: on ? '#783afb' : '#52525c', color: '#fff', fontSize: 11, fontWeight: 500, borderRadius: 4, padding: '1px 6px' }}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Scrollable area */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px' }} className="styled-scrollbar">
        {seoOpen && (
          <div ref={seoRevealRef}>
            {terms.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9f9fa9', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>No terms yet — run deep analysis.</p>
          ) : list.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9f9fa9', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>No terms match the current filters.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {list.map((t) => <TermChip key={t.term} term={t} showCount={countRanges} showRange={showRanges} />)}
            </div>
          )}
          </div>
        )}

        {/* AI Search collapsible */}
        <div ref={aiRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '14px 0 4px', marginTop: 8, borderTop: '1px solid #f4f4f5' }}>
          <button type="button" onClick={() => setAiOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: F }}>
            <svg viewBox="0 0 20 20" width={16} height={16} style={{ flexShrink: 0, color: '#9f9fa9', transform: aiOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}><path fill="currentColor" fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" /></svg>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#18181b', whiteSpace: 'nowrap' }}>AI Search</span>
            <span style={{ fontSize: 15, color: '#9f9fa9', display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Info to cover
              <InfoDot tip="Based on LLM answers, this is the information that drives citations. Cover it to appear in AI search." />
            </span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {/* AI settings */}
          <Popover iconD={ICON_SLIDERS} title="Grouping & sorting">
            {() => (
              <>
                <SecLabel>Grouping</SecLabel>
                <MenuItem label="Disabled" onClick={() => setAiGrouping(false)} checked={!aiGrouping} />
                <MenuItem label="Enabled" onClick={() => setAiGrouping(true)} checked={aiGrouping} />
                <SecLabel>Sorting</SecLabel>
                <MenuItem label="Missing First" onClick={() => setAiSort('missing')} checked={aiSort === 'missing'} />
                <MenuItem label="Alphabetical" onClick={() => setAiSort('alpha')} checked={aiSort === 'alpha'} />
              </>
            )}
          </Popover>
          {/* AI copy */}
          <Popover iconD={ICON_COPY} title="Copy facts">
            {(close) => (
              <>
                <MenuItem label="Copy all facts" onClick={() => { copyFacts('all'); close(); }} />
                <MenuItem label="Copy missing facts" onClick={() => { copyFacts('missing'); close(); }} />
                <MenuItem label="Copy covered facts" onClick={() => { copyFacts('covered'); close(); }} />
              </>
            )}
          </Popover>
          </div>
        </div>
        {aiOpen && (
          <div ref={aiRevealRef} style={{ padding: '6px 0 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12, color: '#71717b', margin: 0, fontFamily: F, lineHeight: '17px' }}>
              Based on LLM answers, this is the information that drives citations. Cover it to appear in AI search.
            </p>

            {/* Bucket badges — populated coverage buckets only */}
            {bucketBadges.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {bucketBadges.map((b) => (
                  <span key={b.key} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 9999, background: '#f4f4f5', padding: '2px 10px', fontSize: 12, fontWeight: 500, color: '#18181b', fontFamily: F }}>
                    {b.label} {b.score}%
                  </span>
                ))}
              </div>
            )}

            {coverageSnapshot ? (
              /* AI Search Guidelines — Priority strip + value-ordered groups (weakest score first). */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <PriorityStrip groups={guidelineGroups} coveredById={coveredById} />
                {orderedGuidelineGroups.map((group) => (
                  <GuidelineGroupCard key={group.key} group={group} coveredById={coveredById} />
                ))}
              </div>
            ) : (
              /* Legacy fallback (pre-Coverage-Engine / un-analyzed articles) — keeps the old
               * intent + info-to-cover cards driven by the raw citations list. */
              <>
                {intentRows.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#9f9fa9', fontFamily: F, fontStyle: 'italic' }}>
                    Run a deep analysis to check intent alignment.
                  </p>
                ) : (
                  <InfoCard
                    title="Upfront Intent Alignment" badge="NEW"
                    items={intentRows.map((item) => ({ text: item.label, covered: item.covered, missing: item.missing }))}
                  />
                )}

                {knowledgeSorted.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#9f9fa9', fontFamily: F, fontStyle: 'italic' }}>
                    Run a deep analysis or AI-visibility check to populate this list.
                  </p>
                ) : aiGrouping ? (
                  <InfoCard
                    title="Information to cover"
                    items={knowledgeSorted.map((item) => ({ text: item.label, covered: item.covered, missing: item.missing }))}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {knowledgeSorted.map((it) => (
                      <div key={it.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <StatusDot covered={it.covered} />
                            <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: '19px', color: it.covered ? '#9f9fa9' : '#18181b', textDecoration: it.covered ? 'line-through' : 'none' }}>{it.label}</span>
                          </span>
                          <span style={{ flexShrink: 0, fontSize: 12, color: it.covered ? '#9f9fa9' : '#52525c' }}>{it.covered ? 'Covered' : 'To cover'}</span>
                        </div>
                        {!it.covered && it.missing && it.missing.length > 0 && (
                          <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {it.missing.map((m, k) => (
                              <li key={k} style={{ fontSize: 12, lineHeight: '16px', color: '#52525c' }}>{m}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom metrics */}
      <div style={{ borderTop: '1px solid #f4f4f5', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <MetricBottom label="Words" value={wordCount} range={wordsRange} />
        <MetricBottom label="Headings" value={headingCount} range={headingsRange} />
        <MetricBottom label="Paragraphs" value={paragraphCount} range={parasRange} />
      </div>
    </div>
  );
};

export default WriteOptimizePanel;
