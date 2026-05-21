import React, { useCallback, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

/* ── Surfer-SEO-style image NodeView ──────────────────────────────────
   Renders images with:
   - Hover dark overlay + rounded corners
   - Bottom toolbar (AI prompt, Pixabay, Upload, delete) on hover
   - Alt text row below the image
   - Blue outline when selected (ProseMirror-selectednode)
   - Audio bar decoration (purely visual, matches Surfer's design)
   - Glow effect during AI image generation
   ─────────────────────────────────────────────────────────────────── */

const AUDIO_BARS = 5;
let _svgUid = 0;

const SurferImageNode: React.FC<NodeViewProps> = ({ node, updateAttributes, deleteNode, editor }) => {
  const { src, alt = '', title = '' } = node.attrs;
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgUid = useRef(`s_${++_svgUid}`);

  const handleAltChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAttributes({ alt: e.target.value });
    },
    [updateAttributes],
  );

  const handleClearAlt = useCallback(() => {
    updateAttributes({ alt: '' });
  }, [updateAttributes]);

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        updateAttributes({ src: reader.result as string });
      };
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate],
  );

  return (
    <NodeViewWrapper as="div" data-surfer-image="">
      <div className={`surfer-image-group group${isGenerating ? ' surfer-image-generating' : ''}`}>
        {/* ── Image container with hover overlay ─────────────────── */}
        <div className="surfer-image-container">
          {/* Dark overlay on hover */}
          <div className="surfer-image-overlay" />

          <img
            src={src}
            alt={alt || ''}
            title={title || ''}
            loading="lazy"
            referrerPolicy="same-origin"
            className="surfer-image-img"
          />

          {/* ── Bottom toolbar (appears on hover) ────────────────── */}
          <div className="surfer-image-toolbar">
            <div className="surfer-toolbar-inner">
              {/* Top row: AI prompt */}
              <div className="surfer-toolbar-prompt-row">
                <div className="surfer-toolbar-prompt-icon">
                  <svg width="20" height="21" viewBox="0 0 19 20" fill="none" style={{ flexShrink: 0, padding: 1 }}>
                    <path d="M1.92383 5.67187C1.92383 3.60081 3.60276 1.92188 5.67383 1.92188H14.3279C16.399 1.92188 18.0779 3.60081 18.0779 5.67188V14.326C18.0779 16.397 16.399 18.076 14.3279 18.076H5.67383C3.60276 18.076 1.92383 16.397 1.92383 14.326V5.67187Z" fill="white"></path>
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.30765 1.25C3.07817 1.25 1.29686 3.08974 1.29686 5.28846L1.25 14.7115C1.25 16.9551 3.07817 18.75 5.26306 18.75H14.6715C16.9009 18.75 18.75 16.9103 18.75 14.7115L18.7326 5.03212C18.5997 2.9097 16.8171 1.25 14.7161 1.25H5.30765ZM16.9876 5.18178C16.9316 3.97662 15.9303 3.04487 14.7606 3.04487H5.26306C4.05914 3 3.03358 4.03205 3.03358 5.28846L3.03098 14.7115H3.03358C3.03358 15.9679 4.05914 16.9551 5.26306 16.9551H14.6715C15.92 16.9551 16.9664 15.9231 16.9664 14.7115L16.9876 5.18178Z" fill={`url(#${svgUid.current}_g1)`}></path>
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.30765 1.25C3.07817 1.25 1.29686 3.08974 1.29686 5.28846L1.25 14.7115C1.25 16.9551 3.07817 18.75 5.26306 18.75H14.6715C16.9009 18.75 18.75 16.9103 18.75 14.7115L18.7326 5.03212C18.5997 2.9097 16.8171 1.25 14.7161 1.25H5.30765ZM16.9876 5.18178C16.9316 3.97662 15.9303 3.04487 14.7606 3.04487H5.26306C4.05914 3 3.03358 4.03205 3.03358 5.28846L3.03098 14.7115H3.03358C3.03358 15.9679 4.05914 16.9551 5.26306 16.9551H14.6715C15.92 16.9551 16.9664 15.9231 16.9664 14.7115L16.9876 5.18178Z" fill={`url(#${svgUid.current}_g2)`}></path>
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.30765 1.25C3.07817 1.25 1.29686 3.08974 1.29686 5.28846L1.25 14.7115C1.25 16.9551 3.07817 18.75 5.26306 18.75H14.6715C16.9009 18.75 18.75 16.9103 18.75 14.7115L18.7326 5.03212C18.5997 2.9097 16.8171 1.25 14.7161 1.25H5.30765ZM16.9876 5.18178C16.9316 3.97662 15.9303 3.04487 14.7606 3.04487H5.26306C4.05914 3 3.03358 4.03205 3.03358 5.28846L3.03098 14.7115H3.03358C3.03358 15.9679 4.05914 16.9551 5.26306 16.9551H14.6715C15.92 16.9551 16.9664 15.9231 16.9664 14.7115L16.9876 5.18178Z" fill={`url(#${svgUid.current}_g3)`}></path>
                    <path d="M6.15039 7.05909C6.15039 6.55062 6.15039 6.29639 6.30835 6.13843C6.46631 5.98047 6.72054 5.98047 7.22901 5.98047H7.56271C8.07118 5.98047 8.32541 5.98047 8.48337 6.13843C8.64133 6.29639 8.64133 6.55062 8.64133 7.05909V10.4451C8.64133 10.9535 8.64133 11.2078 8.48337 11.3657C8.32541 11.5237 8.07118 11.5237 7.56272 11.5237H7.22901C6.72054 11.5237 6.46631 11.5237 6.30835 11.3657C6.15039 11.2078 6.15039 10.9535 6.15039 10.4451V7.05909Z" fill="black"></path>
                    <path d="M11.3164 7.05909C11.3164 6.55062 11.3164 6.29639 11.4744 6.13843C11.6323 5.98047 11.8866 5.98047 12.395 5.98047H12.7287C13.2372 5.98047 13.4914 5.98047 13.6494 6.13843C13.8073 6.29639 13.8073 6.55062 13.8073 7.05909V10.4451C13.8073 10.9535 13.8073 11.2078 13.6494 11.3657C13.4914 11.5237 13.2372 11.5237 12.7287 11.5237H12.395C11.8866 11.5237 11.6323 11.5237 11.4744 11.3657C11.3164 11.2078 11.3164 10.9535 11.3164 10.4451V7.05909Z" fill="black"></path>
                    <defs>
                      <linearGradient id={`${svgUid.current}_g1`} x1="1.25" y1="18.75" x2="21.3089" y2="15.0232" gradientUnits="userSpaceOnUse"><stop stopColor="#FF4087"></stop><stop offset="1" stopColor="#FFC056"></stop></linearGradient>
                      <linearGradient id={`${svgUid.current}_g2`} x1="10" y1="10" x2="-1.24953" y2="15.9384" gradientUnits="userSpaceOnUse"><stop offset="0.631405" stopColor="#FF6DE8" stopOpacity="0"></stop><stop offset="1" stopColor="#DA6EA2"></stop></linearGradient>
                      <linearGradient id={`${svgUid.current}_g3`} x1="13.125" y1="7.5" x2="19.9999" y2="6.24946" gradientUnits="userSpaceOnUse"><stop offset="0.640157" stopColor="#FFE43E" stopOpacity="0"></stop><stop offset="1" stopColor="#FFE43E"></stop></linearGradient>
                    </defs>
                  </svg>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Describe the image you want to generate"
                  className="surfer-toolbar-prompt-input"
                  style={{ height: 28 }}
                />
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating}
                  className="surfer-toolbar-send-btn"
                >
                  {isGenerating ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 12L3.269 3.125A59.8 59.8 0 0 1 21.486 12a59.8 59.8 0 0 1-18.217 8.875zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Bottom row: actions */}
              <div className="surfer-toolbar-actions-row">
                <div className="surfer-toolbar-actions-left">
                  <button type="button" className="surfer-btn surfer-btn-ghost" onClick={handleGenerate} disabled={isGenerating}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                    </svg>
                    <span>Regenerate</span>
                  </button>
                  <button
                    type="button"
                    className="surfer-btn surfer-btn-ghost"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('surfer:open-pixabay', {
                        detail: {
                          onSelect: (img: { url: string; alt: string }) => {
                            updateAttributes({ src: img.url, alt: img.alt });
                          },
                        },
                      }));
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>Pixabay</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <button type="button" className="surfer-btn surfer-btn-ghost" onClick={handleUpload}>
                    <span>Upload</span>
                  </button>
                  <div className="surfer-toolbar-drag-text">
                    <span>or drag and drop an image here</span>
                  </div>
                </div>
                <div className="surfer-toolbar-actions-right">
                  {/* Audio bars — decorative, matches Surfer's design */}
                  <div className="surfer-audio-bars">
                    {Array.from({ length: AUDIO_BARS }).map((_, i) => (
                      <div key={i} className="surfer-audio-bar" />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="surfer-btn-delete"
                    aria-label="Remove image"
                    onClick={deleteNode}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21q.512.078 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48 48 0 0 0-3.478-.397m-12 .562q.51-.088 1.022-.165m0 0a48 48 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a52 52 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a49 49 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Alt text row ──────────────────────────────────────── */}
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
      </div>
    </NodeViewWrapper>
  );
};

export default SurferImageNode;
