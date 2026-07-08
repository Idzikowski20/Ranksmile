import React, { useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { optimizeStore } from './optimizeStore';
import { sanitizeArticleHtml } from '../../lib/sanitizeHtml';
import { wordDiffSegments, renderDiffHtml } from '../../lib/optimizeWordDiff';
import { useEntrance } from '../../lib/motion/useEntrance';
import { sectionResultLabel } from '../../lib/optimizeMessaging';

// React node-view for the contentOptimizer TipTap node.
// Queued/scanning: original section while the stream runs.
// Improved: inline diff + Accept/Reject.
// Accepted/Rejected: resolved content + Undo to return to diff.
// Save (bottom bar) splices final HTML — not done here.

const stripTags = (html: string) => html.replace(/<[^>]+>/g, '');

const ContentOptimizerNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const entranceRef = useEntrance<HTMLDivElement>();
  const { sectionId, status } = node.attrs as { sectionId: string; status: string };
  const [undoHover, setUndoHover] = useState(false);

  const r = optimizeStore.get(sectionId);
  const oldHtml = sanitizeArticleHtml(r?.oldHtml || '');
  const newHtml = sanitizeArticleHtml(r?.newHtml || '');
  const { focus, mode, reason } = r || {};

  const isImproved = status === 'improved' || status === 'active' || status === 'pending';
  const isScanning = status === 'scanning';
  const isQueued = status === 'queued';
  const isAccepted = status === 'accepted';
  const isRejected = status === 'rejected';
  const isResolved = isAccepted || isRejected;

  const handleAccept = () => { updateAttributes({ status: 'accepted' }); optimizeStore.notifyDocChange(); };
  const handleReject = () => { updateAttributes({ status: 'rejected' }); optimizeStore.notifyDocChange(); };
  const handleUndo = () => { updateAttributes({ status: 'improved' }); optimizeStore.notifyDocChange(); };

  const bordered = isImproved || isScanning || isQueued || isResolved;
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
  const undoBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: undoHover ? '#F4F4F5' : '#fff',
    color: '#18181B',
    boxShadow: 'inset 0 0 0 1px #E4E4E7',
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

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    right: 'calc(100% + 8px)',
    top: '50%',
    transform: 'translateY(-50%)',
    padding: '6px 10px',
    borderRadius: 8,
    background: '#18181B',
    color: '#fff',
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-family-primary)',
    pointerEvents: 'none',
  };

  const inlineDiffHtml = renderDiffHtml(wordDiffSegments(stripTags(oldHtml), stripTags(newHtml)));

  let body: React.ReactNode;
  if (isQueued) {
    body = (
      <div style={{ opacity: 0.5, transition: 'opacity 0.2s ease' }} dangerouslySetInnerHTML={{ __html: oldHtml }} />
    );
  } else if (isScanning) {
    body = (
      <div className="ao-text-shimmer" dangerouslySetInnerHTML={{ __html: oldHtml }} />
    );
  } else if (isResolved) {
    body = (
      <div dangerouslySetInnerHTML={{ __html: isAccepted ? newHtml : oldHtml }} />
    );
  } else {
    body = (
      <div dangerouslySetInnerHTML={{ __html: inlineDiffHtml }} />
    );
  }

  return (
    <NodeViewWrapper as="div" ref={entranceRef} contentEditable={false} style={wrapperStyle}>
      {isImproved && (
        <div style={toolbarStyle}>
          <button type="button" aria-label="Accept new version" title="Accept" style={acceptBtnStyle} onClick={handleAccept}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--purple-base)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--gray-base)'; }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </button>
          <button type="button" aria-label="Reject — keep original" title="Reject" style={rejectBtnStyle} onClick={handleReject}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-20)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--gray-10)'; }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {isResolved && (
        <div style={toolbarStyle}>
          <button
            type="button"
            aria-label="Undo changes"
            title="Undo changes"
            style={undoBtnStyle}
            onClick={handleUndo}
            onMouseEnter={() => setUndoHover(true)}
            onMouseLeave={() => setUndoHover(false)}
          >
            {undoHover && <span style={tooltipStyle}>Undo changes</span>}
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
          </button>
        </div>
      )}

      {isImproved && (focus || mode || reason) && (
        <span style={resultChipStyle}>{sectionResultLabel({ focus, mode, reason })}</span>
      )}

      {body}
    </NodeViewWrapper>
  );
};

export default ContentOptimizerNodeView;
