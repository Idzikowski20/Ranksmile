import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { optimizeStore } from './optimizeStore';
import { sanitizeArticleHtml } from '../../lib/sanitizeHtml';
import { wordDiffSegments, renderDiffHtml } from '../../lib/optimizeWordDiff';

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
  const { sectionId, status } = node.attrs as { sectionId: string; status: string };

  const r = optimizeStore.get(sectionId);
  const oldHtml = sanitizeArticleHtml(r?.oldHtml || '');
  const newHtml = sanitizeArticleHtml(r?.newHtml || '');

  const isActive = status === 'active';

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

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    borderLeft: `3px solid ${isActive ? '#783AFB' : '#E4E4E7'}`,
    padding: '8px 12px 8px 16px',
    margin: '4px 0',
    fontFamily: 'var(--font-family-primary)',
  };

  // Floating toolbar pinned to the LEFT of the wrapper (absolute, column layout)
  const toolbarStyle: React.CSSProperties = {
    position: 'absolute',
    top: 8,
    left: -14,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    zIndex: 10,
  };

  const btnBase: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
  };

  const acceptBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: '#18181B',
    color: '#fff',
  };

  const rejectBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: '#F4F4F5',
    color: '#18181B',
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
    <NodeViewWrapper as="div" contentEditable={false} style={wrapperStyle}>
      {/* Floating accept / reject toolbar — pinned left */}
      <div style={toolbarStyle}>
        <button
          type="button"
          aria-label="Accept new version"
          title="Accept"
          style={acceptBtnStyle}
          onClick={handleAccept}
        >
          {/* ✓ checkmark: m4.5 12.75 6 6 9-13.5 */}
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Reject — keep original"
          title="Reject"
          style={rejectBtnStyle}
          onClick={handleReject}
        >
          {/* ✗ X: M6 18 18 6M6 6l12 12 */}
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {diffBody}
    </NodeViewWrapper>
  );
};

export default ContentOptimizerNodeView;
