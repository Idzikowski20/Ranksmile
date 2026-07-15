import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOpenReveal } from '../../lib/motion/useOpenReveal';
import { createPortal } from 'react-dom';
import { NlpTerm, Coverage, termCoverage, termUsageHint } from '../../lib/contentScore';
import { AiVisibilitySummary } from '../../lib/aiSearchScore';
import type { CoverageItem, BucketScore, CoverageSnapshot } from '../../lib/aiCoverage';
import { buildInfoToCoverTopics, type InfoFact, type InfoSource, type InfoTopicGroup } from '../../lib/infoToCoverTopics';
import { faviconUrl } from '../../lib/faviconUrl';
import DomainFavicon from '../common/DomainFavicon';
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
  /** Live content score — same as Content Score panel centre gauge. */
  content?: number;
  hasAi: boolean;
  /** Coverage Engine snapshot — drives info-to-cover topic groups. */
  coverageItems?: CoverageItem[];
  coverageBuckets?: BucketScore[];
  /** Parsed coverage snapshot (passed through for parent compat). */
  coverageSnapshot?: CoverageSnapshot | null;
  /** Competitor outline cache JSON — groups AI facts into topical accordions. */
  competitorOutlinesCache?: string | null;
  onBack: () => void;
  /** Toggles term highlighting in the editor (drives the TipTap decoration). */
  highlightTerms?: boolean;
  onHighlightTermsChange?: (on: boolean) => void;
  /** Which section to expand + scroll to on open (driven by clicking a score gauge). */
  initialSection?: 'seo' | 'ai';
  /** Live ↑N deltas during Auto-Optimize. */
  scoreDeltas?: { seo?: number; overall?: number; ai?: number };
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
  <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? '#f29964' : '#d4d4d8', position: 'relative', flexShrink: 0, transition: 'background 0.15s', display: 'inline-block' }}>
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
  title: string; badge?: string; items: Array<{ text: string; covered: boolean; domains?: string[]; missing?: readonly string[]; sources?: InfoSource[] }>; defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: '#f4f4f5', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: F }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#18181b', textAlign: 'left' }}>{title}</span>
        {badge && (
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 6px', borderRadius: 4, border: '1px solid #F5C4A0', color: '#F29964', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{badge}</span>
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
                {it.sources && it.sources.length > 0 ? (
                  <SourceRow sources={it.sources} muted={it.covered} />
                ) : it.domains && it.domains.length > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, alignSelf: 'center' }}>
                    {it.domains.slice(0, 2).map((d) => (
                      <DomainFavicon key={d} domain={d} size={14} style={{ borderRadius: 3 }} />
                    ))}
                  </span>
                ) : null}
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

const AiOverviewIcon = () => (
  <svg width={14} height={14} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M9.00005 16.1739C9.00005 15.1815 8.80875 14.2489 8.42614 13.3761C8.05548 12.5033 7.54734 11.744 6.90169 11.0984C6.25604 10.4527 5.49682 9.94457 4.62399 9.5739C3.75116 9.1913 2.81856 8.99999 1.82617 8.99999C2.81856 8.99999 3.75116 8.81466 4.62399 8.44402C5.49682 8.06142 6.25604 7.54727 6.90169 6.90162C7.54734 6.25598 8.05548 5.49673 8.42614 4.62392C8.80875 3.7511 9.00005 2.8185 9.00005 1.82611C9.00005 2.8185 9.18539 3.7511 9.55602 4.62392C9.93863 5.49673 10.4528 6.25598 11.0984 6.90162C11.7441 7.54727 12.5033 8.06142 13.3761 8.44402C14.2489 8.81466 15.1816 8.99999 16.1739 8.99999C15.1816 8.99999 14.2489 9.1913 13.3761 9.5739C12.5033 9.94457 11.7441 10.4527 11.0984 11.0984C10.4528 11.744 9.93863 12.5033 9.55602 13.3761C9.18539 14.2489 9.00005 15.1815 9.00005 16.1739Z" fill="#3179ED" />
  </svg>
);

const SourceIcon = ({ source }: { source: InfoSource }) => {
  const tip = source.url || source.domain || source.key;
  if (source.kind === 'ai_overview') {
    return (
      <Tip text="Google AI Overviews">
        <span style={{ display: 'flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '2px solid #fff', background: '#fff', marginRight: -5 }}>
          <AiOverviewIcon />
        </span>
      </Tip>
    );
  }
  if (source.kind === 'ai_mode' || source.kind === 'google') {
    return (
      <Tip text={tip}>
        <span style={{ display: 'flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '2px solid #fff', background: '#fff', marginRight: -5, fontSize: 10, fontWeight: 700, color: '#3086FF' }}>G</span>
      </Tip>
    );
  }
  if (source.kind === 'openai') {
    return (
      <Tip text="ChatGPT / OpenAI">
        <span style={{ display: 'flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '2px solid #fff', background: '#fff', marginRight: -5, fontSize: 9, fontWeight: 700, color: '#18181b' }}>AI</span>
      </Tip>
    );
  }
  if (source.kind === 'gemini') {
    return (
      <Tip text="Google Gemini">
        <span style={{ display: 'flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '2px solid #fff', background: '#fff', marginRight: -5, fontSize: 9, fontWeight: 700, color: '#3086FF' }}>G</span>
      </Tip>
    );
  }
  if (source.kind === 'perplexity') {
    return (
      <Tip text="Perplexity">
        <span style={{ display: 'flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '2px solid #fff', background: '#1a1a2e', marginRight: -5, fontSize: 8, fontWeight: 700, color: '#20B8CD' }}>P</span>
      </Tip>
    );
  }
  if (source.kind === 'reddit') {
    return (
      <Tip text="Reddit">
        <span style={{ display: 'flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '2px solid #fff', background: '#FF4500', marginRight: -5, fontSize: 8, fontWeight: 700, color: '#fff' }}>R</span>
      </Tip>
    );
  }
  const href = source.url || (source.domain ? `https://${source.domain}` : undefined);
  const img = source.domain ? faviconUrl(source.domain) : undefined;
  const inner = img
    ? <img alt="" width={14} height={14} src={img} style={{ display: 'block' }} />
    : <span style={{ fontSize: 9, color: '#52525c' }}>•</span>;
  if (href) {
    return (
      <Tip text={tip}>
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 9999, border: '2px solid #fff', background: '#fff', marginRight: -5, textDecoration: 'none' }}>
          {inner}
        </a>
      </Tip>
    );
  }
  return (
    <Tip text={tip}>
      <span style={{ display: 'flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '2px solid #fff', background: '#fff', marginRight: -5 }}>
        {inner}
      </span>
    </Tip>
  );
};

const SourceRow = ({ sources, muted }: { sources: InfoSource[]; muted?: boolean }) => {
  if (!sources.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', opacity: muted ? 0.55 : 1, filter: muted ? 'grayscale(0.4)' : 'none' }}>
      {sources.slice(0, 8).map((s) => <SourceIcon key={s.key} source={s} />)}
    </div>
  );
};

const FactRow = ({ fact }: { fact: InfoFact }) => (
  <div
    style={{ display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer' }}
    onMouseEnter={(e) => { const btn = e.currentTarget.querySelector('[data-copy]') as HTMLElement | null; if (btn) btn.style.opacity = '1'; }}
    onMouseLeave={(e) => { const btn = e.currentTarget.querySelector('[data-copy]') as HTMLElement | null; if (btn) btn.style.opacity = '0'; }}
  >
    <span style={{ fontSize: 14, lineHeight: '19px', color: fact.covered ? '#9f9fa9' : '#18181b', textDecoration: fact.covered ? 'line-through' : 'none' }}>{fact.text}</span>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <SourceRow sources={fact.sources} muted={fact.covered} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <button
          type="button"
          data-copy
          onClick={() => copy(fact.text)}
          style={{ opacity: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#52525c', fontFamily: F, padding: 0, transition: 'opacity 0.15s ease' }}
        >
          Copy
        </button>
        {fact.covered && <span style={{ fontSize: 12, color: '#9f9fa9', flexShrink: 0 }}>Covered</span>}
      </div>
    </div>
  </div>
);

const TopicGroupCard = ({ group, defaultOpen = true }: { group: InfoTopicGroup; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: '#f4f4f5', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: F }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#18181b', textAlign: 'left', flex: 1 }}>{group.title}</span>
        <Chevron open={open} color="#18181b" />
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {group.facts.map((fact, idx) => (
            <React.Fragment key={fact.id}>
              {idx > 0 && <div style={{ borderTop: '1px solid #e4e4e7' }} />}
              <FactRow fact={fact} />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

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
  seo, ai, content, hasAi, coverageItems, competitorOutlinesCache,
  onBack, highlightTerms, onHighlightTermsChange,
  initialSection, scoreDeltas,
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

  // Phrase-level entities (2+ words) — Surfer "Headings" tab; single tokens stay under All.
  const headingTerms = useMemo(
    () => terms.filter((t) => t.term.trim().split(/\s+/).length >= 2),
    [terms],
  );
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

  const infoTopics = useMemo(
    () => buildInfoToCoverTopics({
      aiSummary,
      coverageItems,
      competitorOutlinesCache,
    }),
    [aiSummary, coverageItems, competitorOutlinesCache],
  );
  const hasTopicAccordions = infoTopics.intent.length > 0 || infoTopics.topics.some((t) => t.facts.length > 0);

  const allInfoFacts = useMemo(() => [
    ...infoTopics.intent.map((f) => ({ text: f.text, covered: f.covered })),
    ...infoTopics.topics.flatMap((g) => g.facts.map((f) => ({ text: f.text, covered: f.covered }))),
  ], [infoTopics]);

  // Copy helpers
  const copyTerms = (src: NlpTerm[], which: 'all' | 'missing' | 'covered') => {
    const sel = src.filter((t) => which === 'all' || (which === 'missing' && termCoverage(t) === 'red') || (which === 'covered' && termCoverage(t) === 'green'));
    copy(sel.map((t) => t.term).join('\n'));
  };
  const copyFacts = (which: 'all' | 'missing' | 'covered') => {
    const sel = allInfoFacts.filter((i) => which === 'all' || (which === 'missing' && !i.covered) || (which === 'covered' && i.covered));
    copy(sel.map((i) => i.text).join('\n'));
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

      {/* Gauge trio */}
      <div style={{ paddingTop: 8, paddingBottom: 14 }}>
        <ScoreTrio seo={seo} ai={ai} content={content} hasAi={hasAi} onSeoClick={expandSeo} onAiClick={expandAi} deltas={scoreDeltas} />
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
                borderBottom: on ? '2px solid #f29964' : '2px solid transparent', marginBottom: -1,
              }}>
                {label}
                <span style={{ background: on ? '#f29964' : '#52525c', color: '#fff', fontSize: 11, fontWeight: 500, borderRadius: 4, padding: '1px 6px' }}>{count}</span>
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

            {hasTopicAccordions ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {infoTopics.intent.length > 0 && (
                  <InfoCard
                    title="Upfront Intent Alignment"
                    badge="NEW"
                    items={infoTopics.intent.map((f) => ({ text: f.text, covered: f.covered, sources: f.sources }))}
                  />
                )}
                {infoTopics.topics.map((group) => (
                  <TopicGroupCard key={group.id} group={group} />
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: '#9f9fa9', fontFamily: F, fontStyle: 'italic' }}>
                Run a deep analysis or AI-visibility check to populate this list.
              </p>
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
