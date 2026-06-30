import React, { useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

// React node-view for the contentOptimizer TipTap node.
// Shows the old (removed) and new (added) versions of a section side-by-side
// with floating Accept / Reject buttons. Accepting splices the new HTML back
// into the document as real editable content; Rejecting does the same with the
// old HTML.
//
// term-hl spans inside oldHtml / newHtml are intentionally preserved — they are
// decoration classes added by TermHighlight and should render as-is inside the
// static dangerouslySetInnerHTML blocks.

const ContentOptimizerNodeView: React.FC<NodeViewProps> = ({ node, editor, getPos }) => {
  const { status, oldHtml, newHtml } = node.attrs as {
    status: string;
    oldHtml: string;
    newHtml: string;
  };

  const [isHovered, setIsHovered] = useState(false);
  const isActive = status === 'active';

  // Replace this atom with parsed HTML content at its exact position.
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
    borderLeft: `3px solid ${isActive ? '#783AFB' : '#D4D4D8'}`,
    borderRadius: '0 8px 8px 0',
    margin: '12px 0',
    padding: '12px 16px 12px 20px',
    background: '#FAFAFA',
    fontFamily: 'var(--font-family-primary)',
  };

  const diffBlockStyle: React.CSSProperties = {
    margin: '8px 0',
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: 14,
    lineHeight: 1.6,
  };

  const removedStyle: React.CSSProperties = {
    ...diffBlockStyle,
    color: '#9f9fa9',
    textDecoration: 'line-through',
    opacity: 0.7,
    background: 'rgba(239,68,68,0.04)',
  };

  const addedStyle: React.CSSProperties = {
    ...diffBlockStyle,
    background: 'rgba(26,178,94,0.08)',
    color: '#18181B',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
    fontFamily: 'var(--font-family-primary)',
  };

  // Floating toolbar (left-anchored, mirrors SurferImageNode toolbar pattern)
  const toolbarStyle: React.CSSProperties = {
    position: 'absolute',
    top: 12,
    right: 16,
    display: 'flex',
    gap: 6,
    opacity: isHovered ? 1 : 0,
    transform: isHovered ? 'translateY(0)' : 'translateY(-4px)',
    transition: 'opacity 0.15s ease, transform 0.15s ease',
    pointerEvents: isHovered ? 'auto' : 'none',
    zIndex: 10,
  };

  const btnBase: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'var(--font-family-primary)',
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

  return (
    <NodeViewWrapper
      as="div"
      contentEditable={false}
      style={wrapperStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Floating accept / reject toolbar */}
      <div style={toolbarStyle}>
        <button
          type="button"
          aria-label="Accept new version"
          title="Accept"
          style={acceptBtnStyle}
          onClick={handleAccept}
        >
          {/* Checkmark */}
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Reject — keep original"
          title="Reject"
          style={rejectBtnStyle}
          onClick={handleReject}
        >
          {/* X */}
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Old version — shown as removed */}
      <div>
        <div style={{ ...labelStyle, color: '#9f9fa9' }}>Original</div>
        <div
          data-diff-type="removed"
          style={removedStyle}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: oldHtml }}
        />
      </div>

      {/* New version — shown as added */}
      <div style={{ marginTop: 12 }}>
        <div style={{ ...labelStyle, color: '#1AB25E' }}>Suggested</div>
        <div
          data-diff-type="added"
          style={addedStyle}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: newHtml }}
        />
      </div>
    </NodeViewWrapper>
  );
};

export default ContentOptimizerNodeView;
