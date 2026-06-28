import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { diffBlocks, DiffBlock, WordSeg } from '../../lib/wordDiff';

const F = 'var(--font-family-primary)';

interface Props {
  /** ORIGINAL article HTML (pre-optimize). */
  original: string;
  /** NEW article HTML (the optimized version currently in the editor). */
  updated: string;
  /** Optional NLP term / keyword phrases to underline when "Highlight terms" is on. */
  terms?: string[];
  onClose: () => void;
}

const tagStyle = (tag: string): React.CSSProperties => {
  switch (tag) {
    case 'h1': return { fontSize: 24, fontWeight: 800, color: '#09090b', margin: '14px 0 8px', lineHeight: 1.2 };
    case 'h2': return { fontSize: 19, fontWeight: 700, color: '#111827', margin: '14px 0 6px', lineHeight: 1.25 };
    case 'h3': return { fontSize: 16, fontWeight: 600, color: '#1f2937', margin: '12px 0 6px', lineHeight: 1.3 };
    case 'h4': return { fontSize: 15, fontWeight: 600, color: '#1f2937', margin: '10px 0 6px' };
    case 'blockquote': return { fontStyle: 'italic', color: '#6b7280', borderLeft: '3px solid #e5e7eb', padding: '4px 12px', margin: '10px 0', fontSize: 14, lineHeight: 1.7 };
    case 'li': return { fontSize: 14, lineHeight: 1.6, color: '#374151', margin: '4px 0 4px 20px', display: 'list-item', listStyleType: 'disc' };
    default: return { fontSize: 14, lineHeight: 1.7, color: '#374151', margin: '8px 0' };
  }
};

function buildTermRegex(terms?: string[]): RegExp | null {
  const parts = Array.from(new Set((terms || []).map((t) => (t || '').trim()).filter((t) => t.length >= 3)))
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!parts.length) return null;
  try { return new RegExp(`(${parts.join('|')})`, 'giu'); } catch { return null; }
}

function highlightTerms(text: string, regex: RegExp | null): React.ReactNode {
  if (!regex) return text;
  const out: React.ReactNode[] = [];
  let last = 0;
  regex.lastIndex = 0;
  let m: RegExpExecArray | null = regex.exec(text);
  let n = 0;
  while (m !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <span key={`t${n}`} style={{ textDecoration: 'underline', textDecorationColor: '#783AFB', textDecorationThickness: 2, textUnderlineOffset: 2 }}>{m[0]}</span>,
    );
    last = m.index + m[0].length;
    if (regex.lastIndex === m.index) regex.lastIndex += 1; // guard against zero-width matches
    n += 1;
    m = regex.exec(text);
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const renderSegs = (segs: WordSeg[], regex: RegExp | null): React.ReactNode => segs.map((seg, i) => {
  const style: React.CSSProperties | undefined = seg.type === 'removed'
    ? { background: 'rgba(239,68,68,0.12)', color: '#b91c1c', textDecoration: 'line-through' }
    : seg.type === 'added'
      ? { background: 'rgba(34,197,94,0.20)', color: '#15803d', borderRadius: 3 }
      : undefined;
  return <span key={i} style={style}>{highlightTerms(seg.text, regex)}</span>;
});

const Pane = ({ blocks, side, regex, innerRef, onScroll }: { blocks: DiffBlock[]; side: 'left' | 'right'; regex: RegExp | null; innerRef: React.RefObject<HTMLDivElement>; onScroll: () => void }) => (
  <div ref={innerRef} onScroll={onScroll} style={{ flex: 1, minWidth: 0, border: '1px solid #e4e4e7', borderRadius: 8, padding: '12px 16px', overflowY: 'auto' }} className="styled-scrollbar">
    {blocks.map((b, i) => {
      const segs = side === 'left' ? b.left : b.right;
      if (!segs) return null;
      return <div key={i} style={tagStyle(b.tag)}>{renderSegs(segs, regex)}</div>;
    })}
  </div>
);

const CompareVersionsModal = ({ original, updated, terms, onClose }: Props) => {
  const [highlight, setHighlight] = useState(true);
  const blocks = useMemo(() => diffBlocks(original, updated), [original, updated]);
  const regex = useMemo(() => (highlight ? buildTermRegex(terms) : null), [highlight, terms]);

  // Scroll the two panes together — scrolling either one drives the other (single gesture).
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const syncScroll = (from: 'left' | 'right') => {
    if (syncing.current) return;
    const src = (from === 'left' ? leftRef : rightRef).current;
    const dst = (from === 'left' ? rightRef : leftRef).current;
    if (!src || !dst) return;
    syncing.current = true;
    dst.scrollTop = src.scrollTop;
    requestAnimationFrame(() => { syncing.current = false; });
  };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: F }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 1100, maxHeight: '88vh', background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.35)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 12px' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#18181b' }}>Compare versions</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#52525c', display: 'inline-flex', padding: 0 }}>
            <svg viewBox="0 0 24 24" width={22} height={22}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Column labels + Highlight terms toggle */}
        <div style={{ display: 'flex', gap: 16, padding: '0 24px 10px' }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: '#9f9fa9' }}>ORIGINAL</span>
          <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: '#9f9fa9' }}>
            <span>NEW</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: '#52525c', fontSize: 13 }}>
              <span
                role="switch"
                aria-checked={highlight}
                onClick={() => setHighlight((v) => !v)}
                style={{ position: 'relative', width: 34, height: 20, borderRadius: 999, background: highlight ? '#783afb' : '#d4d4d8', transition: 'background 0.15s', flexShrink: 0 }}
              >
                <span style={{ position: 'absolute', top: 2, left: highlight ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }} />
              </span>
              Highlight terms
            </label>
          </span>
        </div>

        {/* Diff panes */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: '0 24px 16px' }}>
          <Pane blocks={blocks} side="left" regex={regex} innerRef={leftRef} onScroll={() => syncScroll('left')} />
          <Pane blocks={blocks} side="right" regex={regex} innerRef={rightRef} onScroll={() => syncScroll('right')} />
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #f4f4f5', padding: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#18181b', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#783afb'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#18181b'; }}>
            <svg viewBox="0 0 20 20" width={18} height={18}><path fill="currentColor" fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0" clipRule="evenodd" /></svg>
            Back
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CompareVersionsModal;
