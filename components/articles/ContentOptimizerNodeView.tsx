import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { optimizeStore } from './optimizeStore';
import { sanitizeArticleHtml } from '../../lib/sanitizeHtml';
import { wordDiffSegments, renderDiffHtml } from '../../lib/optimizeWordDiff';
import { useEntrance } from '../../lib/motion/useEntrance';
import { sectionStatusLabel, sectionResultLabel } from '../../lib/optimizeMessaging';
import { prefersReducedMotion } from '../../lib/motion/gsap';

// React node-view for the contentOptimizer TipTap node.
// Shows the old (removed) and new (added) versions of a section with floating
// Accept / Reject buttons. HTML is read from optimizeStore (not node attrs) so
// the ProseMirror document stays light.
// Accepting splices newHtml back as real PM content; Rejecting does the same with oldHtml.

const BLOCK_COMPLEX_RE = /<(table|ul|ol|img|h2|h3)[\s>]/i;

/** Strip all HTML tags, returning plain text. */
const stripTags = (html: string) => html.replace(/<[^>]+>/g, '');

// Block tags safe to host an inline diff. Anything else (or no leading tag)
// falls back to <p> so the simple path can never emit a script/iframe/row tag.
const SAFE_INLINE_TAGS = new Set(['p', 'h1', 'h4', 'h5', 'h6', 'div', 'blockquote', 'pre', 'section', 'article']);

/** Extract the outermost tag name (e.g. "p", "h1") from an HTML string, allowlisted. */
const outerTag = (html: string): string => {
   const m = html.match(/^<([a-z][a-z0-9]*)/i);
   const tag = m ? m[1].toLowerCase() : 'p';
   return SAFE_INLINE_TAGS.has(tag) ? tag : 'p';
};

const ContentOptimizerNodeView: React.FC<NodeViewProps> = ({ node, editor, getPos }) => {
  // Entrance as each optimized section streams in.
  const entranceRef = useEntrance<HTMLDivElement>();
  const { sectionId, status } = node.attrs as { sectionId: string; status: string };

  const r = optimizeStore.get(sectionId);
  const oldHtml = sanitizeArticleHtml(r?.oldHtml || '');
  const newHtml = sanitizeArticleHtml(r?.newHtml || '');
  const { focus, mode, reason } = r || {};

  const isActive = status === 'active';
  const isImproved = status === 'improved';
  const reducedMotion = prefersReducedMotion();

  // Replace this atom with parsed HTML content at its exact position.
  // Accept/Reject always splice the canonical full newHtml/oldHtml — unchanged.
  const splice = (html: string) => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor
      .chain()
      .focus()
      .insertContentAt({ from: pos, to: pos + node.nodeSize }, html)
      .run();
  };

  const handleAccept = () => splice(newHtml);
  const handleReject = () => splice(oldHtml);

  // Rounded bordered box around the changed section (Surfer reference); purple border while active.
  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    border: `1px solid ${isActive ? 'var(--purple-40)' : 'var(--gray-20)'}`,
    borderRadius: 12,
    padding: '12px 20px',
    margin: '8px 0',
    background: '#fff',
    fontFamily: 'var(--font-family-primary)',
  };

  // Floating accept/reject toolbar — vertically centred just left of the box (Surfer reference).
  const toolbarStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: -44,
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 2,
  };

  const btnBase: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    transition: 'background-color 0.15s ease',
  };

  const acceptBtnStyle: React.CSSProperties = { ...btnBase, background: 'var(--gray-base)', color: 'var(--white-base)' };
  const rejectBtnStyle: React.CSSProperties = { ...btnBase, background: 'var(--gray-10)', color: 'var(--gray-base)' };

  // Active-state shimmer overlay — subtle gradient sweep band, non-interactive.
  // Reduced motion: static muted background, no sweep.
  const shimmerOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: 12,
    pointerEvents: 'none',
    background: reducedMotion
      ? 'rgba(120,58,251,0.04)'
      : 'linear-gradient(90deg, rgba(120,58,251,0) 0%, rgba(120,58,251,0.08) 50%, rgba(120,58,251,0) 100%)',
    backgroundSize: reducedMotion ? undefined : '200% 100%',
    animation: reducedMotion ? undefined : 'aoShimmer 1.6s linear infinite',
  };

  const statusLabelStyle: React.CSSProperties = {
    position: 'absolute',
    top: -9,
    left: 12,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 8px',
    borderRadius: 9999,
    background: '#fff',
    color: '#52525C',
    fontSize: 12,
    fontWeight: 500,
    lineHeight: '16px',
    fontFamily: 'var(--font-family-primary)',
    zIndex: 2,
  };

  const statusDotStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--purple-base, #783AFB)',
    flexShrink: 0,
    animation: reducedMotion ? undefined : 'aoPulseDot 1.4s ease-in-out infinite',
  };

  const improvedPillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 9999,
    background: 'rgba(26,178,94,0.10)',
    color: '#1AB25E',
    fontSize: 12,
    fontWeight: 600,
    lineHeight: '16px',
    fontFamily: 'var(--font-family-primary)',
  };

  const resultChipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 9999,
    background: 'var(--gray-10)',
    color: '#52525C',
    fontSize: 12,
    fontWeight: 500,
    lineHeight: '16px',
    fontFamily: 'var(--font-family-primary)',
  };

  const resultRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  };

  // Decide rendering mode:
  // - Simple (no block-complex markup): render ONE inline word-level diff line
  // - Complex (tables/lists/images/multi-heading): keep existing two-block removed+added render
  const isSimple = !BLOCK_COMPLEX_RE.test(oldHtml) && !BLOCK_COMPLEX_RE.test(newHtml);

  let diffBody: React.ReactNode;
  if (isSimple) {
    const tag = outerTag(newHtml || oldHtml);
    // renderDiffHtml escapes all text and emits only styled <span>s; oldHtml/newHtml
    // were already sanitized at read time, so no second sanitize pass is needed here.
    const inlineDiffHtml = renderDiffHtml(wordDiffSegments(stripTags(oldHtml), stripTags(newHtml)));
    diffBody = React.createElement(tag, {
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML: { __html: inlineDiffHtml },
    });
  } else {
    diffBody = (
      <>
        {/* Old version — shown as removed */}
        <div
          data-diff-type="removed"
          style={{ color: '#9f9fa9', textDecoration: 'line-through', opacity: 0.7 }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: oldHtml }}
        />

        {/* New version — shown as added */}
        <div
          data-diff-type="added"
          style={{ background: 'rgba(26,178,94,0.08)', borderRadius: 4 }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: newHtml }}
        />
      </>
    );
  }

  return (
    <NodeViewWrapper as="div" ref={entranceRef} contentEditable={false} style={wrapperStyle}>
      {/* Floating accept / reject toolbar — pinned left */}
      <div style={toolbarStyle}>
        <button
          type="button"
          aria-label="Accept new version"
          title="Accept"
          style={acceptBtnStyle}
          onClick={handleAccept}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--purple-base)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--gray-base)'; }}
        >
          {/* ✓ checkmark: m4.5 12.75 6 6 9-13.5 */}
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Reject — keep original"
          title="Reject"
          style={rejectBtnStyle}
          onClick={handleReject}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-20)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--gray-10)'; }}
        >
          {/* ✗ X: M6 18 18 6M6 6l12 12 */}
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {isActive && (
        <>
          <div aria-hidden="true" style={shimmerOverlayStyle} />
          <span style={statusLabelStyle}>
            <span aria-hidden="true" style={statusDotStyle} />
            {sectionStatusLabel({ focus, mode, reason })}
          </span>
        </>
      )}

      {isImproved && (
        <div style={resultRowStyle}>
          <span style={improvedPillStyle}>Improved</span>
          <span style={resultChipStyle}>{sectionResultLabel({ focus, mode, reason })}</span>
        </div>
      )}

      {diffBody}
    </NodeViewWrapper>
  );
};

export default ContentOptimizerNodeView;
