import React, { useCallback, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

/* ── Ranksmile-SEO-style image NodeView ──────────────────────────────────
   Hover model matches the featured image block:
   - Dark overlay fades in on hover
   - Bottom toolbar slides up from translateY(100%)
   - Inline styles throughout (no CSS class dependencies)
   ─────────────────────────────────────────────────────────────────── */

const RanksmileImageNode: React.FC<NodeViewProps> = ({ node, updateAttributes, deleteNode }) => {
  const { src, alt = '', title = '' } = node.attrs;
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAltChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateAttributes({ alt: e.target.value }),
    [updateAttributes],
  );

  const handleClearAlt = useCallback(() => updateAttributes({ alt: '' }), [updateAttributes]);

  const handleUpload = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => updateAttributes({ src: reader.result as string });
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [updateAttributes],
  );

  const actionBtnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 8px', borderRadius: 5, border: 'none',
    background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)',
    fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-family-primary)',
  };

  return (
    <NodeViewWrapper as="div" data-ranksmile-image="">
      {/* Image container with hover overlay */}
      <div
        style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={src}
          alt={alt || ''}
          title={title || ''}
          loading="lazy"
          referrerPolicy="same-origin"
          style={{ width: '100%', display: 'block' }}
        />

        {/* Dark overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.2s',
          pointerEvents: isHovered ? 'auto' : 'none',
        }} />

        {/* Bottom toolbar — Pixabay + Upload only */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(9,9,11,0.88)',
          transform: isHovered ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1)',
          borderRadius: '0 0 8px 8px',
          padding: '8px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('ranksmile:open-pixabay', {
              detail: { onSelect: (img: { url: string; alt: string }) => updateAttributes({ src: img.url, alt: img.alt }) },
            }))}
            style={actionBtnStyle}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            Pixabay
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button type="button" onClick={handleUpload} style={actionBtnStyle}>
            Upload
          </button>

          <div style={{ flex: 1 }} />

          <button
            type="button"
            aria-label="Remove image"
            onClick={deleteNode}
            style={{
              width: 26, height: 26, borderRadius: 5, border: 'none',
              background: 'rgba(239,68,68,0.2)', color: '#fca5a5',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21q.512.078 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48 48 0 0 0-3.478-.397m-12 .562q.51-.088 1.022-.165m0 0a48 48 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a52 52 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a49 49 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* Alt text row */}
      <div className="ranksmile-alt-row">
        <input
          className="ranksmile-alt-input"
          data-1p-ignore="true"
          placeholder="Type alt text"
          value={alt || ''}
          onChange={handleAltChange}
        />
        <button
          type="button"
          className="ranksmile-alt-clear-btn"
          aria-label="Remove alt text"
          onClick={handleClearAlt}
        >
          <span>Clear alt text</span>
        </button>
      </div>
    </NodeViewWrapper>
  );
};

export default RanksmileImageNode;
