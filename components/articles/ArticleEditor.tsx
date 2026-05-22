import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp01Icon, ArrowDown01Icon } from 'hugeicons-react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import type { ScoreData } from '../../lib/contentScore';
import SurferImageNode from './SurferImageNode';

export interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

interface Props {
  content: string;
  keyword?: string;
  metaTitle?: string;
  metaDescription?: string;
  scoreData?: ScoreData;
  internalArticles?: Array<{ id: number; title: string; url: string }>;
  onChange: (html: string, plainText: string, wordCount: number, headingCount: number, paragraphCount: number) => void;
  onMetaTitleChange?: (v: string) => void;
  onMetaDescriptionChange?: (v: string) => void;
  onHeadingsChange?: (headings: HeadingItem[]) => void;
  initialFeaturedImage?: { url: string; alt: string } | null;
  onFeaturedImageChange?: (img: { url: string; alt: string } | null) => void;
  /** Prop-based ref — bypasses Next.js dynamic() which doesn't forward React refs */
  editorRef?: React.MutableRefObject<any>;
  /** When true, inserted links are highlighted purple for review */
  reviewMode?: boolean;
  /** Fired with true when Surfy is processing, false when done */
  onAiActivity?: (active: boolean) => void;
}

interface MenuBarProps {
  editor: any;
  keyword?: string;
  onAskSurfy: () => void;
}

/* ── Vertical separator ─────────────────────────────────────────────── */
const Sep = () => (
  <div style={{ padding: '0 0.25rem', display: 'flex', flexShrink: 0 }}>
    <div style={{ width: 1, height: 20, background: '#E4E4E7' }} />
  </div>
);

const MenuBar = ({ editor, keyword, onAskSurfy }: MenuBarProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  if (!editor) return null;

  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, padding: 0, borderRadius: 4,
    border: 'none', cursor: 'pointer', flexShrink: 0,
    background: 'transparent', color: '#18181B',
    transition: 'background-color 150ms',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 12px',
        height: 44,
        background: '#fff',
        flexShrink: 0,
        borderBottom: 'none',
        gap: 8,
        overflow: 'hidden',
      }}
    >
      {/* Formatting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>

        {/* Headings */}
        {([1, 2, 3] as const).map((lvl) => {
          const active = editor.isActive('heading', { level: lvl });
          return (
            <button
              key={lvl}
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: lvl }).run()}
              title={`Heading ${lvl}`}
              style={{ ...btnStyle, fontWeight: 600, fontSize: lvl === 1 ? 15 : lvl === 2 ? 14 : 13, color: active ? '#630DE3' : '#18181B', background: active ? '#F3EEFF' : 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = active ? '#F3EEFF' : '#F4F4F5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = active ? '#F3EEFF' : 'transparent'; }}
            >
              H{lvl}
            </button>
          );
        })}

        <Sep />

        {/* Bold */}
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} title="Bold" style={{ ...btnStyle, fontWeight: 700, color: editor.isActive('bold') ? '#630DE3' : '#18181B', background: editor.isActive('bold') ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.isActive('bold') ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.isActive('bold') ? '#F3EEFF' : 'transparent'; }}>
          <span style={{ fontSize: 14 }}>B</span>
        </button>
        {/* Italic */}
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic" style={{ ...btnStyle, fontStyle: 'italic', fontFamily: 'Georgia, serif', fontSize: 14, color: editor.isActive('italic') ? '#630DE3' : '#18181B', background: editor.isActive('italic') ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.isActive('italic') ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.isActive('italic') ? '#F3EEFF' : 'transparent'; }}>
          <span>I</span>
        </button>
        {/* Underline */}
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline" style={{ ...btnStyle, textDecoration: 'underline', fontSize: 14, color: editor.isActive('underline') ? '#630DE3' : '#18181B', background: editor.isActive('underline') ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.isActive('underline') ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.isActive('underline') ? '#F3EEFF' : 'transparent'; }}>
          <span>U</span>
        </button>

        <Sep />

        {/* Bullet list */}
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list" style={{ ...btnStyle, color: editor.isActive('bulletList') ? '#630DE3' : '#18181B', background: editor.isActive('bulletList') ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.isActive('bulletList') ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.isActive('bulletList') ? '#F3EEFF' : 'transparent'; }}>
          <svg viewBox="0 0 256 256" width={18} height={18} fill="currentColor"><path d="M80 64a8 8 0 0 1 8-8h128a8 8 0 0 1 0 16H88a8 8 0 0 1-8-8m136 56H88a8 8 0 0 0 0 16h128a8 8 0 0 0 0-16m0 64H88a8 8 0 0 0 0 16h128a8 8 0 0 0 0-16M44 116a12 12 0 1 0 0-24a12 12 0 0 0 0 24m0 64a12 12 0 1 0 0-24a12 12 0 0 0 0 24" /></svg>
        </button>
        {/* Ordered list */}
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered list" style={{ ...btnStyle, color: editor.isActive('orderedList') ? '#630DE3' : '#18181B', background: editor.isActive('orderedList') ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.isActive('orderedList') ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.isActive('orderedList') ? '#F3EEFF' : 'transparent'; }}>
          <svg viewBox="0 0 256 256" width={18} height={18} fill="currentColor"><path d="M224 128a8 8 0 0 1-8 8H104a8 8 0 0 1 0-16h112a8 8 0 0 1 8 8M104 72h112a8 8 0 0 0 0-16H104a8 8 0 0 0 0 16m112 112H104a8 8 0 0 0 0 16h112a8 8 0 0 0 0-16M43.58 55.16L48 52.94V104a8 8 0 0 0 16 0V40a8 8 0 0 0-11.58-7.16l-16 8a8 8 0 0 0 7.16 14.32m36.19 101.56a23.73 23.73 0 0 0-9.6-15.95a24.86 24.86 0 0 0-34.11 4.7a23.6 23.6 0 0 0-3.57 6.46a8 8 0 1 0 15 5.47a7.8 7.8 0 0 1 1.18-2.13a8.76 8.76 0 0 1 12-1.59a7.9 7.9 0 0 1 3.26 5.32a7.64 7.64 0 0 1-1.57 5.78a1 1 0 0 0-.08.11l-28.69 38.32A8 8 0 0 0 40 216h32a8 8 0 0 0 0-16H56l19.08-25.53a23.47 23.47 0 0 0 4.69-17.75" /></svg>
        </button>

        <Sep />

        {/* Align left */}
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left" style={{ ...btnStyle, color: editor.getAttributes('paragraph').textAlign === 'left' || !editor.getAttributes('paragraph').textAlign ? '#630DE3' : '#18181B', background: (!editor.getAttributes('paragraph').textAlign || editor.getAttributes('paragraph').textAlign === 'left') ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { const a = editor.getAttributes('paragraph').textAlign; e.currentTarget.style.background = (!a || a === 'left') ? '#F3EEFF' : 'transparent'; }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d="M3.75 6.75h12.5M3.75 12h16.5M3.75 17.25h10.5" /></svg>
        </button>
        {/* Align center */}
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center" style={{ ...btnStyle, color: editor.getAttributes('paragraph').textAlign === 'center' ? '#630DE3' : '#18181B', background: editor.getAttributes('paragraph').textAlign === 'center' ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.getAttributes('paragraph').textAlign === 'center' ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.getAttributes('paragraph').textAlign === 'center' ? '#F3EEFF' : 'transparent'; }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d="M5.25 6.75h13.5M3.75 12h16.5M7.25 17.25h9.5" /></svg>
        </button>
        {/* Align right */}
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right" style={{ ...btnStyle, color: editor.getAttributes('paragraph').textAlign === 'right' ? '#630DE3' : '#18181B', background: editor.getAttributes('paragraph').textAlign === 'right' ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.getAttributes('paragraph').textAlign === 'right' ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.getAttributes('paragraph').textAlign === 'right' ? '#F3EEFF' : 'transparent'; }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d="M7.75 6.75h12.5M3.75 12h16.5M9.75 17.25h10.5" /></svg>
        </button>

        <Sep />

        {/* Link */}
        <button type="button" onClick={() => { const url = prompt('Paste link URL:'); if (url) editor.chain().focus().setLink({ href: url }).run(); }} title="Insert link" style={{ ...btnStyle, color: editor.isActive('link') ? '#630DE3' : '#18181B', background: editor.isActive('link') ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.isActive('link') ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.isActive('link') ? '#F3EEFF' : 'transparent'; }}>
          <svg viewBox="0 0 256 256" width={18} height={18} fill="currentColor"><path d="M165.66 90.34a8 8 0 0 1 0 11.32l-64 64a8 8 0 0 1-11.32-11.32l64-64a8 8 0 0 1 11.32 0M215.6 40.4a56 56 0 0 0-79.2 0l-30.06 30.05a8 8 0 0 0 11.32 11.32l30.06-30a40 40 0 0 1 56.57 56.56l-30.07 30.06a8 8 0 0 0 11.31 11.32l30.07-30.11a56 56 0 0 0 0-79.2m-77.26 133.82l-30.06 30.06a40 40 0 1 1-56.56-56.57l30.05-30.05a8 8 0 0 0-11.32-11.32L40.4 136.4a56 56 0 0 0 79.2 79.2l30.06-30.07a8 8 0 0 0-11.32-11.31" /></svg>
        </button>
        {/* Image — file upload as block */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              editor.chain().focus().setImage({ src: reader.result as string, alt: keyword || '' }).run();
            };
            reader.readAsDataURL(file);
            e.target.value = '';
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} title="Insert image" style={btnStyle} onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5m10.5-11.25h.008v.008h-.008zm.375 0a.375.375 0 1 1-.75 0a.375.375 0 0 1 .75 0" /></svg>
        </button>

        <Sep />

        {/* Undo */}
        <button type="button" onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!canUndo} style={{ ...btnStyle, opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'not-allowed' }} onMouseEnter={(e) => { if (canUndo) e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
        </button>
        {/* Redo */}
        <button type="button" onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!canRedo} style={{ ...btnStyle, opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'not-allowed' }} onMouseEnter={(e) => { if (canRedo) e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m15 15l6-6m0 0l-6-6m6 6H9a6 6 0 0 0 0 12h3" /></svg>
        </button>

      </div>

      {/* Right: Ask Surfy */}
      <button
        type="button"
        onClick={onAskSurfy}
        title="Ask Surfy — edit with AI"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, height: 28, padding: '0 6px 0 2px', borderRadius: 4,
          background: '#fff', color: '#18181B',
          border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 500,
          fontFamily: 'var(--font-family-primary)',
          transition: 'background-color 200ms ease-in-out',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
      >
        <svg width="20" height="21" viewBox="0 0 19 20" fill="none" style={{ flexShrink: 0, padding: 1 }}>
          <path d="M1.92383 5.67187C1.92383 3.60081 3.60276 1.92188 5.67383 1.92188H14.3279C16.399 1.92188 18.0779 3.60081 18.0779 5.67188V14.326C18.0779 16.397 16.399 18.076 14.3279 18.076H5.67383C3.60276 18.076 1.92383 16.397 1.92383 14.326V5.67187Z" fill="white" />
          <path fillRule="evenodd" clipRule="evenodd" d="M5.30765 1.25C3.07817 1.25 1.29686 3.08974 1.29686 5.28846L1.25 14.7115C1.25 16.9551 3.07817 18.75 5.26306 18.75H14.6715C16.9009 18.75 18.75 16.9103 18.75 14.7115L18.7326 5.03212C18.5997 2.9097 16.8171 1.25 14.7161 1.25H5.30765ZM16.9876 5.18178C16.9316 3.97662 15.9303 3.04487 14.7606 3.04487H5.26306C4.05914 3 3.03358 4.03205 3.03358 5.28846L3.03098 14.7115H3.03358C3.03358 15.9679 4.05914 16.9551 5.26306 16.9551H14.6715C15.92 16.9551 16.9664 15.9231 16.9664 14.7115L16.9876 5.18178Z" fill="url(#s_grad_1)" />
          <path fillRule="evenodd" clipRule="evenodd" d="M5.30765 1.25C3.07817 1.25 1.29686 3.08974 1.29686 5.28846L1.25 14.7115C1.25 16.9551 3.07817 18.75 5.26306 18.75H14.6715C16.9009 18.75 18.75 16.9103 18.75 14.7115L18.7326 5.03212C18.5997 2.9097 16.8171 1.25 14.7161 1.25H5.30765ZM16.9876 5.18178C16.9316 3.97662 15.9303 3.04487 14.7606 3.04487H5.26306C4.05914 3 3.03358 4.03205 3.03358 5.28846L3.03098 14.7115H3.03358C3.03358 15.9679 4.05914 16.9551 5.26306 16.9551H14.6715C15.92 16.9551 16.9664 15.9231 16.9664 14.7115L16.9876 5.18178Z" fill="url(#s_grad_2)" />
          <path fillRule="evenodd" clipRule="evenodd" d="M5.30765 1.25C3.07817 1.25 1.29686 3.08974 1.29686 5.28846L1.25 14.7115C1.25 16.9551 3.07817 18.75 5.26306 18.75H14.6715C16.9009 18.75 18.75 16.9103 18.75 14.7115L18.7326 5.03212C18.5997 2.9097 16.8171 1.25 14.7161 1.25H5.30765ZM16.9876 5.18178C16.9316 3.97662 15.9303 3.04487 14.7606 3.04487H5.26306C4.05914 3 3.03358 4.03205 3.03358 5.28846L3.03098 14.7115H3.03358C3.03358 15.9679 4.05914 16.9551 5.26306 16.9551H14.6715C15.92 16.9551 16.9664 15.9231 16.9664 14.7115L16.9876 5.18178Z" fill="url(#s_grad_3)" />
          <path d="M6.15039 7.05909C6.15039 6.55062 6.15039 6.29639 6.30835 6.13843C6.46631 5.98047 6.72054 5.98047 7.22901 5.98047H7.56271C8.07118 5.98047 8.32541 5.98047 8.48337 6.13843C8.64133 6.29639 8.64133 6.55062 8.64133 7.05909V10.4451C8.64133 10.9535 8.64133 11.2078 8.48337 11.3657C8.32541 11.5237 8.07118 11.5237 7.56272 11.5237H7.22901C6.72054 11.5237 6.46631 11.5237 6.30835 11.3657C6.15039 11.2078 6.15039 10.9535 6.15039 10.4451V7.05909Z" fill="black" />
          <path d="M11.3164 7.05909C11.3164 6.55062 11.3164 6.29639 11.4744 6.13843C11.6323 5.98047 11.8866 5.98047 12.395 5.98047H12.7287C13.2372 5.98047 13.4914 5.98047 13.6494 6.13843C13.8073 6.29639 13.8073 6.55062 13.8073 7.05909V10.4451C13.8073 10.9535 13.8073 11.2078 13.6494 11.3657C13.4914 11.5237 13.2372 11.5237 12.7287 11.5237H12.395C11.8866 11.5237 11.6323 11.5237 11.4744 11.3657C11.3164 11.2078 11.3164 10.9535 11.3164 10.4451V7.05909Z" fill="black" />
          <defs>
            <linearGradient id="s_grad_1" x1="1.25" y1="18.75" x2="21.3089" y2="15.0232" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF4087" />
              <stop offset="1" stopColor="#FFC056" />
            </linearGradient>
            <linearGradient id="s_grad_2" x1="10" y1="10" x2="-1.24953" y2="15.9384" gradientUnits="userSpaceOnUse">
              <stop offset="0.631405" stopColor="#FF6DE8" stopOpacity="0" />
              <stop offset="1" stopColor="#DA6EA2" />
            </linearGradient>
            <linearGradient id="s_grad_3" x1="13.125" y1="7.5" x2="19.9999" y2="6.24946" gradientUnits="userSpaceOnUse">
              <stop offset="0.640157" stopColor="#FFE43E" stopOpacity="0" />
              <stop offset="1" stopColor="#FFE43E" />
            </linearGradient>
          </defs>
        </svg>
        Ask Surfy
      </button>
    </div>
  );
};

/* Featured image block — sits between Title/Description and the editor */
const FeaturedImageBlock = ({
  imageUrl, imageAlt, keyword,
  onImageChange, onImageRemove,
}: {
  imageUrl?: string;
  imageAlt?: string;
  keyword?: string;
  onImageChange?: (img: { url: string; alt: string }) => void;
  onImageRemove?: () => void;
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [altText, setAltText] = useState(imageAlt || '');
  const featuredFileInputRef = useRef<HTMLInputElement>(null);

  // Sync altText when parent provides a new image with a different alt
  useEffect(() => {
    setAltText(imageAlt || '');
  }, [imageAlt]);

  const handleAiGenerate = async (prompt: string) => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/articles/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: prompt, title: prompt }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        onImageChange?.({ url: data.url, alt: data.alt || prompt });
        setAiPrompt('');
      }
    } catch {
      // silently fail
    } finally {
      setIsGenerating(false);
    }
  };

  if (!imageUrl) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      {!collapsed && (
        <div
          style={{ background: '#fff', borderBottom: '1px solid #e4e4e7', padding: '16px 16px 12px', marginBottom: 8 }}
        >
          {/* Image container with hover overlay */}
          <div
            style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <img
              src={imageUrl}
              alt={altText || 'Featured image'}
              style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }}
            />

            {/* Dark overlay */}
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.45)',
                opacity: isHovered ? 1 : 0,
                transition: 'opacity 0.2s',
                pointerEvents: isHovered ? 'auto' : 'none',
              }}
            />

            {/* Bottom toolbar */}
            <div
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'rgba(9,9,11,0.88)',
                transform: isHovered ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1)',
                borderRadius: '0 0 8px 8px',
                padding: '8px 10px',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              {/* AI prompt row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="18" height="18" viewBox="0 0 19 20" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M1.92383 5.67187C1.92383 3.60081 3.60276 1.92188 5.67383 1.92188H14.3279C16.399 1.92188 18.0779 3.60081 18.0779 5.67188V14.326C18.0779 16.397 16.399 18.076 14.3279 18.076H5.67383C3.60276 18.076 1.92383 16.397 1.92383 14.326V5.67187Z" fill="white" />
                  <path d="M6.15039 7.05909C6.15039 6.55062 6.15039 6.29639 6.30835 6.13843C6.46631 5.98047 6.72054 5.98047 7.22901 5.98047H7.56271C8.07118 5.98047 8.32541 5.98047 8.48337 6.13843C8.64133 6.29639 8.64133 6.55062 8.64133 7.05909V10.4451C8.64133 10.9535 8.64133 11.2078 8.48337 11.3657C8.32541 11.5237 8.07118 11.5237 7.56272 11.5237H7.22901C6.72054 11.5237 6.46631 11.5237 6.30835 11.3657C6.15039 11.2078 6.15039 10.9535 6.15039 10.4451V7.05909Z" fill="black" />
                  <path d="M11.3164 7.05909C11.3164 6.55062 11.3164 6.29639 11.4744 6.13843C11.6323 5.98047 11.8866 5.98047 12.395 5.98047H12.7287C13.2372 5.98047 13.4914 5.98047 13.6494 6.13843C13.8073 6.29639 13.8073 6.55062 13.8073 7.05909V10.4451C13.8073 10.9535 13.8073 11.2078 13.6494 11.3657C13.4914 11.5237 13.2372 11.5237 12.7287 11.5237H12.395C11.8866 11.5237 11.6323 11.5237 11.4744 11.3657C11.3164 11.2078 11.3164 10.9535 11.3164 10.4451V7.05909Z" fill="black" />
                </svg>
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAiGenerate(aiPrompt || keyword || ''); }}
                  placeholder="Describe the image you want to generate…"
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', outline: 'none',
                    borderRadius: 5, padding: '4px 8px', fontSize: 12, color: '#fff',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAiGenerate(aiPrompt || keyword || '')}
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
                {/* Regenerate */}
                <button
                  type="button"
                  onClick={() => handleAiGenerate(altText || keyword || '')}
                  disabled={isGenerating}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 8px', borderRadius: 5, border: 'none',
                    background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)',
                    fontSize: 12, cursor: isGenerating ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                  Regenerate
                </button>

                {/* Pixabay */}
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('surfer:open-pixabay', {
                      detail: { onSelect: (img: { url: string; alt: string }) => { onImageChange?.(img); } },
                    }));
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 8px', borderRadius: 5, border: 'none',
                    background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)',
                    fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-family-primary)',
                  }}
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
                  ref={featuredFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      onImageChange?.({ url: reader.result as string, alt: altText || keyword || '' });
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => featuredFileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 8px', borderRadius: 5, border: 'none',
                    background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)',
                    fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Upload
                </button>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Remove */}
                <button
                  type="button"
                  onClick={onImageRemove}
                  title="Remove featured image"
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
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#9f9fa9', flexShrink: 0, fontFamily: 'var(--font-family-primary)' }}>Alt</span>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Alt text…"
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: 12,
                color: '#374151', fontFamily: 'var(--font-family-primary)',
                background: 'transparent',
              }}
            />
          </div>
        </div>
      )}

      {/* Toggle below the image */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280', background: '#fff', border: '1px solid #e4e4e7', borderRadius: 20, padding: '3px 12px', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap' }}
        >
          Featured Image {collapsed ? <ArrowDown01Icon size={12} /> : <ArrowUp01Icon size={12} />}
        </button>
      </div>
    </div>
  );
};

/* Title + Description editable block at the top of the editor scroll area */
const TitleDescriptionBlock = ({
  metaTitle, metaDescription, onMetaTitleChange, onMetaDescriptionChange,
}: {
  metaTitle?: string;
  metaDescription?: string;
  onMetaTitleChange?: (v: string) => void;
  onMetaDescriptionChange?: (v: string) => void;
}) => {
  const [expanded, setExpanded] = useState(true);
  const titleMax = 70;
  const descMax = 160;
  const titleLen = metaTitle?.length || 0;
  const descLen = metaDescription?.length || 0;

  return (
    <div style={{ marginBottom: 32, background: '#fff' }}>
      {expanded && (
        <>
          {/* Title row */}
          <div style={{ paddingBottom: 12, borderBottom: '1px solid #e4e4e7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', fontFamily: 'var(--font-family-primary)' }}>Title</span>
              <span style={{ fontSize: 12, color: titleLen > titleMax ? '#ef4444' : '#9ca3af', fontFamily: 'var(--font-family-primary)' }}>{titleLen}/{titleMax}</span>
            </div>
            <textarea
              value={metaTitle || ''}
              onChange={(e) => onMetaTitleChange?.(e.target.value)}
              rows={2}
              placeholder="Enter meta title..."
              style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', fontSize: 15, color: '#111827', lineHeight: 1.5, fontFamily: 'var(--font-family-primary)', background: 'transparent' }}
            />
          </div>
          {/* Description row */}
          <div style={{ paddingTop: 12, paddingBottom: 12, borderBottom: '1px solid #e4e4e7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', fontFamily: 'var(--font-family-primary)' }}>Description</span>
              <span style={{ fontSize: 12, color: descLen > descMax ? '#ef4444' : '#9ca3af', fontFamily: 'var(--font-family-primary)' }}>{descLen}/{descMax}</span>
            </div>
            <textarea
              value={metaDescription || ''}
              onChange={(e) => onMetaDescriptionChange?.(e.target.value)}
              rows={3}
              placeholder="Enter meta description..."
              style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', fontSize: 14, color: '#374151', lineHeight: 1.6, fontFamily: 'var(--font-family-primary)', background: 'transparent' }}
            />
          </div>
        </>
      )}
      {/* Toggle handle */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280', background: '#fff', border: '1px solid #e4e4e7', borderRadius: 20, padding: '3px 12px', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap' }}
        >
          Title and Description {expanded ? <ArrowUp01Icon size={12} /> : <ArrowDown01Icon size={12} />}
        </button>
      </div>
    </div>
  );
};

const ArticleEditor = ({ content, keyword, metaTitle, metaDescription, scoreData, internalArticles, onChange, onMetaTitleChange, onMetaDescriptionChange, onHeadingsChange, initialFeaturedImage, onFeaturedImageChange, editorRef, reviewMode, onAiActivity }: Props) => {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onHeadingsChangeRef = useRef(onHeadingsChange);
    onHeadingsChangeRef.current = onHeadingsChange;

    const [featuredImage, setFeaturedImage] = useState<{ url: string; alt: string } | null>(initialFeaturedImage ?? null);

    const updateFeaturedImage = (img: { url: string; alt: string } | null) => {
      setFeaturedImage(img);
      onFeaturedImageChange?.(img);
    };

    // Sync if parent loads featured image after mount (e.g. article loaded from DB)
    useEffect(() => {
      if (initialFeaturedImage !== undefined) setFeaturedImage(initialFeaturedImage ?? null);
    }, [initialFeaturedImage]);
    const [surfyOpen, setSurfyOpen] = useState(false);
    const [surfyPrompt, setSurfyPrompt] = useState('');
    const [surfyLoading, setSurfyLoading] = useState(false);
    const [surfyResponse, setSurfyResponse] = useState<{ message: string; content: string | null } | null>(null);
    const surfyInputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { onAiActivity?.(surfyLoading); }, [surfyLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    /* Render AI message with rich formatting */
    const renderSurfyMessage = (text: string) => {
      const lines = text.split('\n');
      const elements: React.ReactNode[] = [];
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) { i++; continue; }

        // Numbered list item: "1. text" or "1) text"
        const listMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
        if (listMatch) {
          elements.push(
            <div key={`l${i}`} style={{ display: 'flex', gap: 8, marginBottom: 5, paddingLeft: 0 }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, lineHeight: '22px', fontFamily: 'var(--font-family-primary)', flexShrink: 0, minWidth: 18, textAlign: 'right', fontWeight: 500 }}>{listMatch[1]}.</span>
              <span style={{ fontSize: 13, lineHeight: '22px', color: 'rgba(255,255,255,0.82)', fontFamily: 'var(--font-family-primary)' }}>
                {parseInlineFormatting(listMatch[2])}
              </span>
            </div>
          );
          i++; continue;
        }

        // Regular paragraph
        elements.push(
          <p key={`p${i}`} style={{ margin: '0 0 8px', fontSize: 13, lineHeight: '20px', color: 'rgba(255,255,255,0.82)', fontFamily: 'var(--font-family-primary)' }}>
            {parseInlineFormatting(trimmed)}
          </p>
        );
        i++;
      }

      return elements.length ? elements : <p style={{ margin: 0, fontSize: 13, lineHeight: '20px', color: 'rgba(255,255,255,0.82)', fontFamily: 'var(--font-family-primary)' }}>{text}</p>;
    };

    /* Parse **bold** and `code` within a text segment */
    const parseInlineFormatting = (text: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
      let last = 0;
      let match: RegExpExecArray | null;
      let idx = 0;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > last) {
          parts.push(<span key={`t${idx++}`}>{text.slice(last, match.index)}</span>);
        }
        if (match[2]) {
          parts.push(<strong key={`b${idx++}`} style={{ fontWeight: 600, color: '#fff' }}>{match[2]}</strong>);
        } else if (match[3]) {
          parts.push(<code key={`c${idx++}`} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 6px', fontSize: 12.25, fontFamily: '"JetBrains Mono", "Fira Code", monospace', color: '#FFC056' }}>{match[3]}</code>);
        }
        last = match.index + match[0].length;
      }
      if (last < text.length) {
        parts.push(<span key={`t${idx++}`}>{text.slice(last)}</span>);
      }
      return parts;
    };

    const handleAskSurfy = () => {
      if (!editor) return;
      if (surfyOpen) { setSurfyOpen(false); setSurfyResponse(null); return; }
      setSurfyOpen(true);
      setSurfyResponse(null);
      setTimeout(() => surfyInputRef.current?.focus(), 50);
    };

    const handleSurfySubmit = async () => {
      const prompt = surfyPrompt.trim();
      if (!prompt || !editor) return;
      setSurfyLoading(true);
      setSurfyResponse(null);
      try {
        const content = editor.getHTML();
        const res = await fetch('/api/articles/ask-surfy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, content, context: ['article'], scoreData: scoreData || null, internalArticles: internalArticles || [] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        setSurfyResponse({ message: data.message, content: data.content });
        setSurfyPrompt('');
      } catch (err: any) {
        setSurfyResponse({ message: 'Error: ' + err.message, content: null });
      } finally {
        setSurfyLoading(false);
      }
    };

    const handleSurfyApply = () => {
      if (!editor || !surfyResponse?.content) return;
      editor.commands.setContent(surfyResponse.content);
      setSurfyOpen(false);
      setSurfyResponse(null);
      setSurfyPrompt('');
    };

    // Always-current editor ref — useEditor returns null on first render in
    // Next.js (TipTap v3 detects window.next and forces immediatelyRender:false).
    // A plain ref lets getEditor() read the live value without stale-closure issues.
    const editorLiveRef = useRef<any>(null);

    const calcAndEmit = useCallback((ed: any) => {
      const html = ed.getHTML();
      const text = ed.getText();
      const words = text.split(/\s+/).filter(Boolean).length;
      const json = ed.getJSON();
      const headings = (json.content || []).filter((n: any) => n.type === 'heading').length;
      const paragraphs = (json.content || []).filter((n: any) => n.type === 'paragraph' && n.content?.length).length;
      onChangeRef.current(html, text, words, headings, paragraphs);
      if (onHeadingsChangeRef.current) {
        const items: HeadingItem[] = [];
        ed.state.doc.descendants((node: any, pos: number) => {
          if (node.type.name === 'heading') items.push({ level: node.attrs.level, text: node.textContent, pos });
        });
        onHeadingsChangeRef.current(items);
      }
    }, []);

    const SurferImage = ImageExt.extend({
      addNodeView() {
        return ReactNodeViewRenderer(SurferImageNode);
      },
    });

    const editor = useEditor({
      extensions: [
        // link: false — StarterKit v3 includes Link by default; disable it so
        // our explicit Link.configure() below is the only Link extension.
        StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
        SurferImage.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: 'article-image' } }),
        TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
        Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      ],
      content,
      onCreate({ editor: ed }) { calcAndEmit(ed); },
      onUpdate({ editor: ed }) { calcAndEmit(ed); },
    });

    // Keep the live ref in sync on every render
    editorLiveRef.current = editor;

    // Expose handle via prop-based ref (React.forwardRef doesn't work through
    // Next.js dynamic() / loadable — the wrapper intercepts the ref prop and
    // replaces editorRef.current with its own {retry:ƒ} object).
    useEffect(() => {
      if (!editorRef) return;
      editorRef.current = {
        getEditor: () => editorLiveRef.current,
        triggerSurfy: (prompt: string) => {
          setSurfyOpen(true);
          setSurfyResponse(null);
          setSurfyPrompt(prompt);
          setTimeout(() => surfyInputRef.current?.focus(), 100);
        },
      };
      return () => { editorRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorRef]);

    useEffect(() => {
      if (editor && content && editor.getHTML() !== content) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }, [content, editor]);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: '#fff', position: 'relative' }}>
        <style>{`
          .art-editor-scroll {
            flex: 1;
            overflow-y: auto;
            background: #fff;
          }
          .art-editor-scroll .ProseMirror {
            outline: none;
            max-width: 860px;
            margin: 0 auto;
            padding: 32px 64px 80px;
            min-height: 500px;
            position: relative;
          }
          /* Block labels */
          .art-editor-scroll .ProseMirror > h1,
          .art-editor-scroll .ProseMirror > h2,
          .art-editor-scroll .ProseMirror > h3,
          .art-editor-scroll .ProseMirror > p,
          .art-editor-scroll .ProseMirror > ul,
          .art-editor-scroll .ProseMirror > ol,
          .art-editor-scroll .ProseMirror > blockquote { position: relative; }
          .art-editor-scroll .ProseMirror > h1::before { content: 'h1'; }
          .art-editor-scroll .ProseMirror > h2::before { content: 'h2'; }
          .art-editor-scroll .ProseMirror > h3::before { content: 'h3'; }
          .art-editor-scroll .ProseMirror > p::before { content: 'p'; }
          .art-editor-scroll .ProseMirror > ul::before { content: 'ul'; }
          .art-editor-scroll .ProseMirror > ol::before { content: 'ol'; }
          .art-editor-scroll .ProseMirror > h1::before,
          .art-editor-scroll .ProseMirror > h2::before,
          .art-editor-scroll .ProseMirror > h3::before,
          .art-editor-scroll .ProseMirror > p::before,
          .art-editor-scroll .ProseMirror > ul::before,
          .art-editor-scroll .ProseMirror > ol::before {
            position: absolute; left: -36px; top: 5px;
            font-size: 11px; font-weight: 400; color: #d1d5db;
            font-family: var(--font-family-primary); line-height: 1;
            pointer-events: none; user-select: none;
          }
          /* Typography */
          .art-editor-scroll .ProseMirror h1 { font-size: 35px; font-weight: 800; color: #09090b; margin: 36px 0 16px; line-height: 1.15; letter-spacing: -0.02em; }
          .art-editor-scroll .ProseMirror h2 { font-size: 24px; font-weight: 700; color: #111827; margin: 28px 0 12px; line-height: 1.25; }
          .art-editor-scroll .ProseMirror h3 { font-size: 19px; font-weight: 600; color: #1f2937; margin: 22px 0 10px; line-height: 1.35; }
          .art-editor-scroll .ProseMirror p { margin: 10px 0; line-height: 1.75; color: #374151; font-size: 14px; }
          .art-editor-scroll .ProseMirror ul, .art-editor-scroll .ProseMirror ol { padding-left: 24px; margin: 10px 0; color: #374151; }
          .art-editor-scroll .ProseMirror li { margin: 5px 0; line-height: 1.65; color: #374151; font-size: 14px; }
          .art-editor-scroll .ProseMirror strong { font-weight: 700; color: #111827; }
          .art-editor-scroll .ProseMirror em { font-style: italic; }
          .art-editor-scroll .ProseMirror blockquote { border-left: 3px solid #e5e7eb; padding: 10px 18px; margin: 16px 0; color: #6b7280; font-style: italic; background: #f9fafb; border-radius: 0 6px 6px 0; }
          .art-editor-scroll .ProseMirror img { max-width: 100%; height: auto; }
          .art-editor-scroll .ProseMirror img.article-image.ProseMirror-selectednode { outline: 3px solid var(--color-surface-raised); }
          .art-editor-scroll .ProseMirror p.is-editor-empty:first-child::before { color: #d1d5db; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; font-style: italic; }
          .art-editor-scroll .ProseMirror a { color: #2563eb; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
          .art-editor-scroll .ProseMirror a:hover { color: #1d4ed8; }
          .art-editor-scroll[data-review="true"] .ProseMirror a { background: #783afb; color: #fff !important; text-decoration: none; border-radius: 3px; padding: 1px 3px; }
          .art-editor-scroll[data-review="true"] .ProseMirror a:hover { background: #6d28d9; color: #fff !important; }
          .art-editor-scroll .ProseMirror hr { border: none; border-top: 1px solid #e4e4e7; margin: 22px 0; }
        `}</style>

        {/* Toolbar */}
        <MenuBar editor={editor} keyword={keyword} onAskSurfy={handleAskSurfy} />

        {/* Scrollable editor */}
        <div className="art-editor-scroll styled-scrollbar" data-review={reviewMode ? 'true' : 'false'}>
          {/* Title + Description card */}
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 64px 0' }}>
            <TitleDescriptionBlock
              metaTitle={metaTitle}
              metaDescription={metaDescription}
              onMetaTitleChange={onMetaTitleChange}
              onMetaDescriptionChange={onMetaDescriptionChange}
            />
          </div>

          {/* Featured Image block */}
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 64px' }}>
            <FeaturedImageBlock
              imageUrl={featuredImage?.url}
              imageAlt={featuredImage?.alt}
              keyword={keyword}
              onImageChange={(img) => updateFeaturedImage(img)}
              onImageRemove={() => updateFeaturedImage(null)}
            />
          </div>

          <EditorContent editor={editor} style={{ background: '#fff' }} />
        </div>

        {/* Ask Surfy modal — centered at bottom */}
        {surfyOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100,
              width: 816,
              maxWidth: 'calc(100% - 32px)',
              animation: 'growOut 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              style={{
                background: '#09090b',
                color: '#fff',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: '0px 8px 16px 0px rgba(24,26,34,0.32), 0px 2px 4px 0px rgba(24,26,34,0.16), 0px 4px 4px 0px rgba(0,0,0,0.08), 0px 1px 1px 0px rgba(0,0,0,0.04)',
              }}
            >
              {/* Input row — hidden when response exists */}
              {!surfyResponse && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', paddingBottom: 0 }}>
                  {/* Surfy logo */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="20" height="21" viewBox="0 0 19 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ padding: 1 }}>
                      <path d="M1.92383 5.67187C1.92383 3.60081 3.60276 1.92188 5.67383 1.92188H14.3279C16.399 1.92188 18.0779 3.60081 18.0779 5.67188V14.326C18.0779 16.397 16.399 18.076 14.3279 18.076H5.67383C3.60276 18.076 1.92383 16.397 1.92383 14.326V5.67187Z" fill="white"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M5.30765 1.25C3.07817 1.25 1.29686 3.08974 1.29686 5.28846L1.25 14.7115C1.25 16.9551 3.07817 18.75 5.26306 18.75H14.6715C16.9009 18.75 18.75 16.9103 18.75 14.7115L18.7326 5.03212C18.5997 2.9097 16.8171 1.25 14.7161 1.25H5.30765ZM16.9876 5.18178C16.9316 3.97662 15.9303 3.04487 14.7606 3.04487H5.26306C4.05914 3 3.03358 4.03205 3.03358 5.28846L3.03098 14.7115H3.03358C3.03358 15.9679 4.05914 16.9551 5.26306 16.9551H14.6715C15.92 16.9551 16.9664 15.9231 16.9664 14.7115L16.9876 5.18178Z" fill="url(#surfy-g0)"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M5.30765 1.25C3.07817 1.25 1.29686 3.08974 1.29686 5.28846L1.25 14.7115C1.25 16.9551 3.07817 18.75 5.26306 18.75H14.6715C16.9009 18.75 18.75 16.9103 18.75 14.7115L18.7326 5.03212C18.5997 2.9097 16.8171 1.25 14.7161 1.25H5.30765ZM16.9876 5.18178C16.9316 3.97662 15.9303 3.04487 14.7606 3.04487H5.26306C4.05914 3 3.03358 4.03205 3.03358 5.28846L3.03098 14.7115H3.03358C3.03358 15.9679 4.05914 16.9551 5.26306 16.9551H14.6715C15.92 16.9551 16.9664 15.9231 16.9664 14.7115L16.9876 5.18178Z" fill="url(#surfy-g1)"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M5.30765 1.25C3.07817 1.25 1.29686 3.08974 1.29686 5.28846L1.25 14.7115C1.25 16.9551 3.07817 18.75 5.26306 18.75H14.6715C16.9009 18.75 18.75 16.9103 18.75 14.7115L18.7326 5.03212C18.5997 2.9097 16.8171 1.25 14.7161 1.25H5.30765ZM16.9876 5.18178C16.9316 3.97662 15.9303 3.04487 14.7606 3.04487H5.26306C4.05914 3 3.03358 4.03205 3.03358 5.28846L3.03098 14.7115H3.03358C3.03358 15.9679 4.05914 16.9551 5.26306 16.9551H14.6715C15.92 16.9551 16.9664 15.9231 16.9664 14.7115L16.9876 5.18178Z" fill="url(#surfy-g2)"/>
                      <path d="M6.15039 7.05909C6.15039 6.55062 6.15039 6.29639 6.30835 6.13843C6.46631 5.98047 6.72054 5.98047 7.22901 5.98047H7.56271C8.07118 5.98047 8.32541 5.98047 8.48337 6.13843C8.64133 6.29639 8.64133 6.55062 8.64133 7.05909V10.4451C8.64133 10.9535 8.64133 11.2078 8.48337 11.3657C8.32541 11.5237 8.07118 11.5237 7.56272 11.5237H7.22901C6.72054 11.5237 6.46631 11.5237 6.30835 11.3657C6.15039 11.2078 6.15039 10.9535 6.15039 10.4451V7.05909Z" fill="black"/>
                      <path d="M11.3164 7.05909C11.3164 6.55062 11.3164 6.29639 11.4744 6.13843C11.6323 5.98047 11.8866 5.98047 12.395 5.98047H12.7287C13.2372 5.98047 13.4914 5.98047 13.6494 6.13843C13.8073 6.29639 13.8073 6.55062 13.8073 7.05909V10.4451C13.8073 10.9535 13.8073 11.2078 13.6494 11.3657C13.4914 11.5237 13.2372 11.5237 12.7287 11.5237H12.395C11.8866 11.5237 11.6323 11.5237 11.4744 11.3657C11.3164 11.2078 11.3164 10.9535 11.3164 10.4451V7.05909Z" fill="black"/>
                      <defs>
                        <linearGradient id="surfy-g0" x1="1.25" y1="18.75" x2="21.3089" y2="15.0232" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#FF4087"/>
                          <stop offset="1" stopColor="#FFC056"/>
                        </linearGradient>
                        <linearGradient id="surfy-g1" x1="10" y1="10" x2="-1.24953" y2="15.9384" gradientUnits="userSpaceOnUse">
                          <stop offset="0.631405" stopColor="#FF6DE8" stopOpacity="0"/>
                          <stop offset="1" stopColor="#DA6EA2"/>
                        </linearGradient>
                        <linearGradient id="surfy-g2" x1="13.125" y1="7.5" x2="19.9999" y2="6.24946" gradientUnits="userSpaceOnUse">
                          <stop offset="0.640157" stopColor="#FFE43E" stopOpacity="0"/>
                          <stop offset="1" stopColor="#FFE43E"/>
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>

                  {/* Textarea */}
                  <div style={{ flex: 1 }}>
                    <textarea
                      ref={surfyInputRef}
                      rows={1}
                      value={surfyPrompt}
                      onChange={(e) => setSurfyPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSurfySubmit();
                        }
                      }}
                      placeholder="Ask Surfy to make it shorter"
                      disabled={surfyLoading}
                      style={{
                        width: '100%',
                        height: 24,
                        maxHeight: 400,
                        minHeight: 0,
                        border: 'none',
                        borderRadius: 0,
                        background: 'transparent',
                        outline: 'none',
                        padding: 0,
                        fontSize: 14,
                        lineHeight: '24px',
                        color: '#fff',
                        fontFamily: 'var(--font-family-primary)',
                        resize: 'none',
                      }}
                    />
                  </div>

                  {/* Send button */}
                  <button
                    type="button"
                    onClick={handleSurfySubmit}
                    disabled={!surfyPrompt.trim() || surfyLoading}
                    aria-label="Send"
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 36, height: 36, borderRadius: 8,
                      background: 'transparent', border: 'none',
                      color: '#fff',
                      cursor: surfyPrompt.trim() && !surfyLoading ? 'pointer' : 'not-allowed',
                      opacity: surfyPrompt.trim() && !surfyLoading ? 1 : 0.4,
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 12L3.269 3.125A59.8 59.8 0 0 1 21.486 12a59.8 59.8 0 0 1-18.217 8.875zm0 0h7.5" />
                    </svg>
                  </button>

                  {/* Audio/loading bars */}
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} style={{ width: 4, height: 12, background: '#1AB25E', borderRadius: 1, opacity: surfyLoading ? 1 : 0 }} />
                    ))}
                  </div>

                  {/* Close button */}
                  <button
                    type="button"
                    onClick={() => { setSurfyOpen(false); setSurfyPrompt(''); setSurfyResponse(null); }}
                    aria-label="Close"
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-start',
                      width: 36, height: 36, borderRadius: 8,
                      background: 'transparent', border: 'none',
                      color: '#fff', cursor: 'pointer', padding: '0.375rem',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#3F3F47'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Loading state */}
              {surfyLoading && (
                <div style={{ padding: '1rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-family-primary)' }}>Thinking…</span>
                </div>
              )}

              {/* AI Response */}
              {surfyResponse && !surfyLoading && (
                <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Response header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0.25rem' }}>
                    <svg width="20" height="21" viewBox="0 0 19 20" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M1.92383 5.67187C1.92383 3.60081 3.60276 1.92188 5.67383 1.92188H14.3279C16.399 1.92188 18.0779 3.60081 18.0779 5.67188V14.326C18.0779 16.397 16.399 18.076 14.3279 18.076H5.67383C3.60276 18.076 1.92383 16.397 1.92383 14.326V5.67187Z" fill="white" />
                      <path fillRule="evenodd" clipRule="evenodd" d="M5.30765 1.25C3.07817 1.25 1.29686 3.08974 1.29686 5.28846L1.25 14.7115C1.25 16.9551 3.07817 18.75 5.26306 18.75H14.6715C16.9009 18.75 18.75 16.9103 18.75 14.7115L18.7326 5.03212C18.5997 2.9097 16.8171 1.25 14.7161 1.25H5.30765ZM16.9876 5.18178C16.9316 3.97662 15.9303 3.04487 14.7606 3.04487H5.26306C4.05914 3 3.03358 4.03205 3.03358 5.28846L3.03098 14.7115H3.03358C3.03358 15.9679 4.05914 16.9551 5.26306 16.9551H14.6715C15.92 16.9551 16.9664 15.9231 16.9664 14.7115L16.9876 5.18178Z" fill="url(#s_grad_1)" />
                      <path fillRule="evenodd" clipRule="evenodd" d="M5.30765 1.25C3.07817 1.25 1.29686 3.08974 1.29686 5.28846L1.25 14.7115C1.25 16.9551 3.07817 18.75 5.26306 18.75H14.6715C16.9009 18.75 18.75 16.9103 18.75 14.7115L18.7326 5.03212C18.5997 2.9097 16.8171 1.25 14.7161 1.25H5.30765ZM16.9876 5.18178C16.9316 3.97662 15.9303 3.04487 14.7606 3.04487H5.26306C4.05914 3 3.03358 4.03205 3.03358 5.28846L3.03098 14.7115H3.03358C3.03358 15.9679 4.05914 16.9551 5.26306 16.9551H14.6715C15.92 16.9551 16.9664 15.9231 16.9664 14.7115L16.9876 5.18178Z" fill="url(#s_grad_2)" />
                      <path fillRule="evenodd" clipRule="evenodd" d="M5.30765 1.25C3.07817 1.25 1.29686 3.08974 1.29686 5.28846L1.25 14.7115C1.25 16.9551 3.07817 18.75 5.26306 18.75H14.6715C16.9009 18.75 18.75 16.9103 18.75 14.7115L18.7326 5.03212C18.5997 2.9097 16.8171 1.25 14.7161 1.25H5.30765ZM16.9876 5.18178C16.9316 3.97662 15.9303 3.04487 14.7606 3.04487H5.26306C4.05914 3 3.03358 4.03205 3.03358 5.28846L3.03098 14.7115H3.03358C3.03358 15.9679 4.05914 16.9551 5.26306 16.9551H14.6715C15.92 16.9551 16.9664 15.9231 16.9664 14.7115L16.9876 5.18178Z" fill="url(#s_grad_3)" />
                      <path d="M6.15039 7.05909C6.15039 6.55062 6.15039 6.29639 6.30835 6.13843C6.46631 5.98047 6.72054 5.98047 7.22901 5.98047H7.56271C8.07118 5.98047 8.32541 5.98047 8.48337 6.13843C8.64133 6.29639 8.64133 6.55062 8.64133 7.05909V10.4451C8.64133 10.9535 8.64133 11.2078 8.48337 11.3657C8.32541 11.5237 8.07118 11.5237 7.56272 11.5237H7.22901C6.72054 11.5237 6.46631 11.5237 6.30835 11.3657C6.15039 11.2078 6.15039 10.9535 6.15039 10.4451V7.05909Z" fill="black" />
                      <path d="M11.3164 7.05909C11.3164 6.55062 11.3164 6.29639 11.4744 6.13843C11.6323 5.98047 11.8866 5.98047 12.395 5.98047H12.7287C13.2372 5.98047 13.4914 5.98047 13.6494 6.13843C13.8073 6.29639 13.8073 6.55062 13.8073 7.05909V10.4451C13.8073 10.9535 13.8073 11.2078 13.6494 11.3657C13.4914 11.5237 13.2372 11.5237 12.7287 11.5237H12.395C11.8866 11.5237 11.6323 11.5237 11.4744 11.3657C11.3164 11.2078 11.3164 10.9535 11.3164 10.4451V7.05909Z" fill="black" />
                      <defs>
                        <linearGradient id="s_grad_1" x1="1.25" y1="18.75" x2="21.3089" y2="15.0232" gradientUnits="userSpaceOnUse"><stop stopColor="#FF4087" /><stop offset="1" stopColor="#FFC056" /></linearGradient>
                        <linearGradient id="s_grad_2" x1="10" y1="10" x2="-1.24953" y2="15.9384" gradientUnits="userSpaceOnUse"><stop offset="0.631405" stopColor="#FF6DE8" stopOpacity="0" /><stop offset="1" stopColor="#DA6EA2" /></linearGradient>
                        <linearGradient id="s_grad_3" x1="13.125" y1="7.5" x2="19.9999" y2="6.24946" gradientUnits="userSpaceOnUse"><stop offset="0.640157" stopColor="#FFE43E" stopOpacity="0" /><stop offset="1" stopColor="#FFE43E" /></linearGradient>
                      </defs>
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: 'var(--font-family-primary)', lineHeight: '20px' }}>Surfy</span>
                  </div>

                  {/* Message body */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid #221e28',
                      maxHeight: 340,
                      overflowY: 'auto',
                    }}
                    className="styled-scrollbar-dark"
                  >
                    {renderSurfyMessage(surfyResponse.message)}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button
                        type="button"
                        onClick={() => { setSurfyResponse(null); surfyInputRef.current?.focus(); }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '0.375rem 0.75rem', borderRadius: 6,
                          background: '#18181b', border: 'none', cursor: 'pointer',
                          color: '#fff', fontSize: 13, fontWeight: 500,
                          fontFamily: 'var(--font-family-primary)',
                        }}
                      >
                        Ask again
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSurfyOpen(false); setSurfyResponse(null); setSurfyPrompt(''); }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '0.375rem 0.75rem', borderRadius: 6,
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500,
                          fontFamily: 'var(--font-family-primary)',
                        }}
                      >
                        Dismiss
                      </button>
                    </div>

                    {surfyResponse.content && (
                      <button
                        type="button"
                        onClick={handleSurfyApply}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '0.375rem 0.75rem', borderRadius: 6,
                          background: '#783afb', border: 'none', cursor: 'pointer',
                          color: '#fff', fontSize: 13, fontWeight: 600,
                          fontFamily: 'var(--font-family-primary)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#5a1fd6'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#783afb'; }}
                      >
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                        Apply changes
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Context chips row — only when no response yet */}
              {!surfyResponse && !surfyLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem 0.5rem 0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: 13, lineHeight: '16px', color: '#fff', fontFamily: 'var(--font-family-primary)' }}>Context:</span>
                    {['This article', 'Guidelines', 'Facts', 'Competitors', 'Cursor position'].map((label) => (
                      <div
                        key={label}
                        style={{
                          display: 'flex', alignItems: 'center',
                          borderRadius: '9999px',
                          border: '1px solid rgba(255,255,255,0.8)',
                          padding: '0.1875rem 0.75rem',
                          fontSize: 13, lineHeight: '16px',
                          color: 'rgba(255,255,255,0.8)',
                          fontFamily: 'var(--font-family-primary)',
                          cursor: 'default',
                          userSelect: 'none',
                        }}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
};

ArticleEditor.displayName = 'ArticleEditor';
export default ArticleEditor;
