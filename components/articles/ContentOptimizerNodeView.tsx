import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { sanitizeArticleHtml } from '@/src/infrastructure/http/sanitizeHtml';
import { WHOLE_ARTICLE_ID } from '@/src/infrastructure/ao/optimizeWholeArticle';
import { renderStructuredDiffHtml } from '@/src/infrastructure/ao/optimizeWordDiff';
import { useEntrance } from '@/components/motion/useEntrance';
import { resolveNodeOp } from './resolveNodeOp';
import { optimizeStore } from './optimizeStore';

// React node-view for the contentOptimizer TipTap node.
// Queued/scanning: original section while the stream runs.
// Improved: inline word/block diff only — no green chrome / result chips.
// Save (bottom bar) splices final HTML — not done here.

const ContentOptimizerNodeView: React.FC<NodeViewProps> = ({ node, editor, getPos }) => {
  const entranceRef = useEntrance<HTMLDivElement>();
  const { sectionId, status } = node.attrs as { sectionId: string; status: string };

  const r = optimizeStore.get(sectionId);
  const oldHtml = sanitizeArticleHtml(r?.oldHtml || '');
  const newHtml = sanitizeArticleHtml(r?.newHtml || '');

  const isScanning = status === 'scanning';
  const isQueued = status === 'queued';

  // Surfer-parity per-suggestion controls: each changed section carries its own Add /
  // Undo, so a single weak edit no longer forces Cancel on the whole run. Resolving
  // splices the chosen HTML in place of this node; when the last node resolves, the
  // existing review-completion effect returns the editor to idle, and Save still
  // resolves whatever the reviewer left untouched.
  const resolveTo = (html: string) => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos == null) return;
    const range = { from: pos, to: pos + node.nodeSize };
    // An empty chosen side removes the node (accept a deletion / undo an addition); any HTML
    // replaces it. See resolveNodeOp (unit-tested) — returning early stranded the node.
    if (resolveNodeOp(html) === 'insert') editor.chain().insertContentAt(range, html).run();
    else editor.chain().deleteRange(range).run();
    optimizeStore.notifyDocChange();
  };

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    margin: '8px 0',
    padding: 0,
    border: 'none',
    borderRadius: 0,
    background: 'transparent',
    fontFamily: 'var(--font-family-primary)',
    fontSize: 15,
    lineHeight: 1.6,
    color: 'var(--koala-text-primary)',
  };

  const isWholeArticle = sectionId === WHOLE_ARTICLE_ID;

  // Block-aware word diff — preserve H2/H3/P like the editor (not one flattened wall).
  const inlineDiffHtml = renderStructuredDiffHtml(oldHtml, newHtml);

  let body: React.ReactNode;
  if (isQueued) {
    body = (
      <div style={{ opacity: 0.5, transition: 'opacity 0.2s ease' }} dangerouslySetInnerHTML={{ __html: oldHtml }} />
    );
  } else if (isScanning) {
    body = (
      <div className="ao-text-shimmer" dangerouslySetInnerHTML={{ __html: oldHtml }} />
    );
  } else {
    body = (
      <div
        className={`ao-structured-diff${isWholeArticle ? ' ao-whole-article-preview' : ''}`}
        dangerouslySetInnerHTML={{ __html: inlineDiffHtml }}
      />
    );
  }

  // Review phase only (buildReviewDoc statuses). During streaming every frame rebuilds
  // the doc, so a mid-run click would be silently overwritten a moment later. Gate on the
  // changed result existing, not Boolean(newHtml): a section deletion has empty newHtml but
  // still needs Add/Undo so the reviewer can accept or reject the removal.
  const showControls = (status === 'active' || status === 'pending') && Boolean(r);

  return (
    <NodeViewWrapper as="div" ref={entranceRef} contentEditable={false} style={wrapperStyle}>
      {showControls && (
        <div
          contentEditable={false}
          style={{
            position: 'absolute', top: -4, right: 0, zIndex: 5,
            display: 'flex', gap: 6, alignItems: 'center',
            background: 'var(--koala-bg-primary)',
            border: '1px solid var(--koala-border-primary)',
            borderRadius: 10, padding: '3px 4px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
          }}
        >
          <button
            type="button"
            onClick={() => resolveTo(oldHtml)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--font-family-primary)', fontSize: 12, fontWeight: 600,
              color: 'var(--koala-text-secondary)', padding: '3px 8px', borderRadius: 8,
            }}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => resolveTo(newHtml)}
            style={{
              border: 'none', cursor: 'pointer',
              background: 'var(--koala-bg-brand)', color: 'var(--koala-text-on-brand, #fff)',
              fontFamily: 'var(--font-family-primary)', fontSize: 12, fontWeight: 600,
              padding: '3px 10px', borderRadius: 8,
            }}
          >
            Add
          </button>
        </div>
      )}
      {body}
    </NodeViewWrapper>
  );
};

export default ContentOptimizerNodeView;
