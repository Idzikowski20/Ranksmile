import React, { useCallback, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

/* ── Surfer-SEO-style image NodeView ──────────────────────────────────
   Hover model matches the featured image block:
   - Dark overlay fades in on hover
   - Bottom toolbar slides up from translateY(100%)
   - Inline styles throughout (no CSS class dependencies)
   ─────────────────────────────────────────────────────────────────── */

const SurferImageNode: React.FC<NodeViewProps> = ({ node, updateAttributes, deleteNode }) => {
  const { src, alt = '', title = '' } = node.attrs;
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [prompt, setPrompt] = useState('');
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

  const handleGenerate = useCallback(async () => {
    const text = prompt.trim() || alt?.trim();
    if (!text || isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/articles/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: text, title: text }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        updateAttributes({ src: data.url, alt: data.alt || text });
        setPrompt('');
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, alt, isGenerating, updateAttributes]);

  const actionBtnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 8px', borderRadius: 5, border: 'none',
    background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)',
    fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-family-primary)',
  };

  return (
    <NodeViewWrapper as="div" data-surfer-image="">
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

        {/* Bottom toolbar — slides up on hover */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(9,9,11,0.88)',
          transform: isHovered ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1)',
          borderRadius: '0 0 8px 8px',
          padding: '8px 10px',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {/* AI prompt row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Surfy icon */}
            <svg width="18" height="18" viewBox="0 0 19 20" fill="none" style={{ flexShrink: 0 }}>
              <path d="M1.92383 5.67187C1.92383 3.60081 3.60276 1.92188 5.67383 1.92188H14.3279C16.399 1.92188 18.0779 3.60081 18.0779 5.67188V14.326C18.0779 16.397 16.399 18.076 14.3279 18.076H5.67383C3.60276 18.076 1.92383 16.397 1.92383 14.326V5.67187Z" fill="white" />
              <path d="M6.15039 7.05909C6.15039 6.55062 6.15039 6.29639 6.30835 6.13843C6.46631 5.98047 6.72054 5.98047 7.22901 5.98047H7.56271C8.07118 5.98047 8.32541 5.98047 8.48337 6.13843C8.64133 6.29639 8.64133 6.55062 8.64133 7.05909V10.4451C8.64133 10.9535 8.64133 11.2078 8.48337 11.3657C8.32541 11.5237 8.07118 11.5237 7.56272 11.5237H7.22901C6.72054 11.5237 6.46631 11.5237 6.30835 11.3657C6.15039 11.2078 6.15039 10.9535 6.15039 10.4451V7.05909Z" fill="black" />
              <path d="M11.3164 7.05909C11.3164 6.55062 11.3164 6.29639 11.4744 6.13843C11.6323 5.98047 11.8866 5.98047 12.395 5.98047H12.7287C13.2372 5.98047 13.4914 5.98047 13.6494 6.13843C13.8073 6.29639 13.8073 6.55062 13.8073 7.05909V10.4451C13.8073 10.9535 13.8073 11.2078 13.6494 11.3657C13.4914 11.5237 13.2372 11.5237 12.7287 11.5237H12.395C11.8866 11.5237 11.6323 11.5237 11.4744 11.3657C11.3164 11.2078 11.3164 10.9535 11.3164 10.4451V7.05909Z" fill="black" />
            </svg>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
              placeholder="Describe the image you want to generate…"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', outline: 'none',
                borderRadius: 5, padding: '4px 8px', fontSize: 12, color: '#fff',
                fontFamily: 'var(--font-family-primary)',
              }}
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                width: 26, height: 26, borderRadius: 5, border: 'none',
                background: 'rgba(255,255,255,0.15)', color: '#fff',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              {isGenerating ? (
                <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              ) : (
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 12L3.269 3.125A59.8 59.8 0 0 1 21.486 12a59.8 59.8 0 0 1-18.217 8.875zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Pixabay */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('surfer:open-pixabay', {
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

            {/* Upload */}
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

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Delete */}
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
      </div>

      {/* Alt text row */}
      <div className="surfer-alt-row">
        <input
          className="surfer-alt-input"
          data-1p-ignore="true"
          placeholder="Type alt text"
          value={alt || ''}
          onChange={handleAltChange}
        />
        <button
          type="button"
          className="surfer-alt-clear-btn"
          aria-label="Remove alt text"
          onClick={handleClearAlt}
        >
          <span>Clear alt text</span>
        </button>
      </div>
    </NodeViewWrapper>
  );
};

export default SurferImageNode;
