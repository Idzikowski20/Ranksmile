import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { optimizeStore } from './optimizeStore';
import { sanitizeArticleHtml } from '../../lib/sanitizeHtml';
import { WHOLE_ARTICLE_ID } from '../../lib/optimizeWholeArticle';
import { renderStructuredDiffHtml } from '../../lib/optimizeWordDiff';
import { useEntrance } from '../../lib/motion/useEntrance';

// React node-view for the contentOptimizer TipTap node.
// Queued/scanning: original section while the stream runs.
// Improved: inline word/block diff only — no green chrome / result chips.
// Save (bottom bar) splices final HTML — not done here.

const ContentOptimizerNodeView: React.FC<NodeViewProps> = ({ node }) => {
  const entranceRef = useEntrance<HTMLDivElement>();
  const { sectionId, status } = node.attrs as { sectionId: string; status: string };

  const r = optimizeStore.get(sectionId);
  const oldHtml = sanitizeArticleHtml(r?.oldHtml || '');
  const newHtml = sanitizeArticleHtml(r?.newHtml || '');

  const isScanning = status === 'scanning';
  const isQueued = status === 'queued';

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
    color: '#18181B',
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

  return (
    <NodeViewWrapper as="div" ref={entranceRef} contentEditable={false} style={wrapperStyle}>
      {body}
    </NodeViewWrapper>
  );
};

export default ContentOptimizerNodeView;
