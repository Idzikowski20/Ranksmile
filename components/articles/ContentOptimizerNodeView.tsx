import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { optimizeStore } from './optimizeStore';
import { sanitizeArticleHtml } from '../../lib/sanitizeHtml';
import { WHOLE_ARTICLE_ID } from '../../lib/optimizeWholeArticle';
import { wordDiffSegments, renderDiffHtml } from '../../lib/optimizeWordDiff';
import { useEntrance } from '../../lib/motion/useEntrance';
import { sectionResultLabel } from '../../lib/optimizeMessaging';

// React node-view for the contentOptimizer TipTap node.
// Queued/scanning: original section while the stream runs.
// Improved: inline diff only — Save/Cancel bar applies changes globally.
// Save (bottom bar) splices final HTML — not done here.

const stripTags = (html: string) => html.replace(/<[^>]+>/g, '');

const ContentOptimizerNodeView: React.FC<NodeViewProps> = ({ node }) => {
  const entranceRef = useEntrance<HTMLDivElement>();
  const { sectionId, status } = node.attrs as { sectionId: string; status: string };

  const r = optimizeStore.get(sectionId);
  const oldHtml = sanitizeArticleHtml(r?.oldHtml || '');
  const newHtml = sanitizeArticleHtml(r?.newHtml || '');
  const { focus, mode, reason } = r || {};

  const isImproved = status === 'improved' || status === 'active' || status === 'pending';
  const isScanning = status === 'scanning';
  const isQueued = status === 'queued';

  const bordered = isImproved || isScanning || isQueued;
  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    margin: '8px 0',
    padding: bordered ? '12px 16px' : 0,
    border: bordered ? '1px solid #E4E4E7' : 'none',
    borderRadius: bordered ? 12 : 0,
    background: '#fff',
    fontFamily: 'var(--font-family-primary)',
    fontSize: 15,
    lineHeight: 1.6,
    color: '#18181B',
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
    marginBottom: 6,
  };

  const isWholeArticle = sectionId === WHOLE_ARTICLE_ID;

  const inlineDiffHtml = isWholeArticle
    ? newHtml
    : renderDiffHtml(wordDiffSegments(stripTags(oldHtml), stripTags(newHtml)));

  let body: React.ReactNode;
  if (isQueued) {
    body = (
      <div style={{ opacity: 0.5, transition: 'opacity 0.2s ease' }} dangerouslySetInnerHTML={{ __html: oldHtml }} />
    );
  } else if (isScanning) {
    body = (
      <div className="ao-text-shimmer" dangerouslySetInnerHTML={{ __html: oldHtml }} />
    );
  } else if (isWholeArticle) {
    body = (
      <div className="ao-whole-article-preview" dangerouslySetInnerHTML={{ __html: newHtml }} />
    );
  } else {
    body = (
      <div dangerouslySetInnerHTML={{ __html: inlineDiffHtml }} />
    );
  }

  return (
    <NodeViewWrapper as="div" ref={entranceRef} contentEditable={false} style={wrapperStyle}>
      {isImproved && (focus || mode || reason) && (
        <span style={resultChipStyle}>{sectionResultLabel({ focus, mode, reason })}</span>
      )}
      {body}
    </NodeViewWrapper>
  );
};

export default ContentOptimizerNodeView;
