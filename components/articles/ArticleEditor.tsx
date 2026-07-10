import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import type { Editor, JSONContent } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { PendingAction } from '../../lib/ai/types';
import type { ArticleEditorHandle } from '../../lib/types/editor';
import { ArrowUp01Icon, ArrowDown01Icon } from 'hugeicons-react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import type { ScoreData, NlpTerm } from '../../lib/contentScore';
import { getErrorMessage } from '../../lib/errors';
import { HIGHLIGHT_COLORS, HighlightSwatchIcon, isHighlightActive } from '../../lib/highlightColors';
import SurferImageNode from './SurferImageNode';
import ContentOptimizer from './contentOptimizerNode';
import SurfyBubbleMenu, { SurfyLinkModal } from './SurfyBubbleMenu';
import { CommentHighlight, CommentAnchor } from './comments/commentHighlightExtension';
import { TableKit } from '@tiptap/extension-table';
import Typography from '@tiptap/extension-typography';
import CharacterCount from '@tiptap/extension-character-count';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details';
import Youtube from '@tiptap/extension-youtube';
import { TermHighlight } from './termHighlightExtension';
import { PlagiarismHighlight } from './plagiarismHighlightExtension';
import { TIP_BUBBLE_BASE } from './tipBubble';
import CommentComposer, { DraftComment } from './comments/CommentComposer';
import EditorCommentsOverlay from './comments/EditorCommentsOverlay';
import { Thread, CommentAuthor } from './comments/CommentThreadBubble';
import CompareVersionsModal from './CompareVersionsModal';
import SlashCommand, { SlashItem } from './SlashCommand';
import SurfyChatPanel, { SurfyPanelApi } from './SurfyChatPanel';
import ProgressiveBlur from '../common/ProgressiveBlur';

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
  editorRef?: React.MutableRefObject<ArticleEditorHandle | null>;
  /** When true, inserted links are highlighted purple for review */
  reviewMode?: boolean;
  /** When true, the format toolbar is visually disabled (Auto-Optimize section review). */
  formattingSuspended?: boolean;
  /** Deep analysis / import — lock the document and toolbar. */
  readOnly?: boolean;
  /** Highlight NLP entity terms inline (Write & Optimize). */
  highlightTerms?: boolean;
  /** Fired with true when Surfy is processing, false when done */
  onAiActivity?: (active: boolean) => void;
  /** Target keyword for Surfy scoring context */
  articleKeyword?: string;
  /** Plagiarised sentences to underline in red (view-only; from the Plagiarism panel). */
  plagiarismSentences?: string[];
  /** The plagiarism match currently focused in the panel — highlighted stronger + scrolled into view. */
  plagiarismFocused?: string | null;
  /** Comment anchors to highlight inline (view-only ProseMirror decorations). */
  comments?: CommentAnchor[];
  /** Full comment threads for the in-editor pins + bubbles overlay. */
  threads?: Thread[];
  /** Current viewer identity used when replying/reacting/creating. */
  commentAuthor?: CommentAuthor;
  /** Article id for the comments API (overlay/bubble calls). */
  commentArticleId?: string;
  /** Bump source — called after any comment mutation so the page refetches. */
  onCommentsChanged?: () => void;
  /** Create a comment anchored to the selected quote; resolves to the new id. */
  onCreateComment?: (quote: string, draft: { text: string; images: string[] }) => Promise<string | undefined> | void;
  /** Notified whenever Surfy opens/closes, so the page can swap its right panel to the docked pane. */
  onSurfyOpenChange?: (open: boolean) => void;
  /** When provided, the Surfy chat renders (via portal) into this docked element instead of the
   *  floating modal — the page supplies it in the right column while Surfy is open. */
  surfyDockEl?: HTMLElement | null;
}

interface MenuBarProps {
  editor: Editor;
  keyword?: string;
  onAskSurfy: () => void;
  formattingSuspended?: boolean;
}

/* ── Vertical separator ─────────────────────────────────────────────── */
const Sep = () => (
  <div style={{ padding: '0 0.25rem', display: 'flex', flexShrink: 0 }}>
    <div style={{ width: 1, height: 20, background: '#E4E4E7' }} />
  </div>
);

const MAX_SURFY_HISTORY = 20;

const IconSurfy = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
    <defs>
      <linearGradient id="surfy-editor-grad" x1="2.01449e-7" y1="31.8993" x2="36.6637" y2="25.0444" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF4087"/>
        <stop offset="1" stopColor="#FFC056"/>
      </linearGradient>
    </defs>
    <path d="M3.07678 9.07672C3.07678 5.76301 5.76307 3.07672 9.07678 3.07672H22.9233C26.237 3.07672 28.9233 5.76301 28.9233 9.07672V22.9233C28.9233 26.237 26.237 28.9233 22.9233 28.9233H9.07678C5.76307 28.9233 3.07678 26.237 3.07678 22.9233V9.07672Z" fill="white"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M8.49224 2C4.92508 2 2.07498 4.94359 2.07498 8.46154L2 23.5385C2 27.1282 4.92508 30 8.4209 30H23.4743C27.0415 30 30 27.0564 30 23.5385L29.9722 8.05139C29.7595 4.65552 26.9073 2 23.5457 2H8.49224ZM27.1802 8.29085C27.0905 6.36259 25.4884 4.8718 23.617 4.8718H8.4209C6.49463 4.8 4.85373 6.45128 4.85373 8.46154L4.84956 23.5385H4.85373C4.85373 25.5487 6.49463 27.1282 8.4209 27.1282H23.4743C25.472 27.1282 27.1463 25.4769 27.1463 23.5385L27.1802 8.29085Z" fill="url(#surfy-editor-grad)"/>
    <g style={{ transformOrigin: '11px 14px', animation: 'surfy-blink 4s ease-in-out infinite' }}>
      <path d="M9.84155 11.1844C9.84155 10.3709 9.84155 9.96409 10.0943 9.71135C10.347 9.45862 10.7538 9.45862 11.5673 9.45862H12.1013C12.9148 9.45862 13.3216 9.45862 13.5743 9.71135C13.8271 9.96409 13.8271 10.3709 13.8271 11.1844V16.602C13.8271 17.4155 13.8271 17.8223 13.5743 18.075C13.3216 18.3278 12.9148 18.3278 12.1013 18.3278H11.5673C10.7538 18.3278 10.347 18.3278 10.0943 18.075C9.84155 17.8223 9.84155 17.4155 9.84155 16.602V11.1844Z" fill="black"/>
    </g>
    <g style={{ transformOrigin: '20px 14px', animation: 'surfy-blink 4s ease-in-out 0.15s infinite' }}>
      <path d="M18.1047 11.1844C18.1047 10.3709 18.1047 9.96409 18.3575 9.71135C18.6102 9.45862 19.017 9.45862 19.8305 9.45862H20.3645C21.178 9.45862 21.5848 9.45862 21.8375 9.71135C22.0902 9.96409 22.0902 10.3709 22.0902 11.1844V16.602C22.0902 17.4155 22.0902 17.8223 21.8375 18.075C21.5848 18.3278 21.178 18.3278 20.3645 18.3278H19.8305C19.017 18.3278 18.6102 18.3278 18.3575 18.075C18.1047 17.8223 18.1047 17.4155 18.1047 16.602V11.1844Z" fill="black"/>
    </g>
  </svg>
);

/**
 * A toolbar group rendered as a single trigger button that opens a small
 * popover (Heading / List / Align). Defined at module scope so it keeps its
 * own `open` state across the parent toolbar's frequent re-renders (the
 * toolbar re-renders on every editor transaction to refresh active states).
 */
const TOOLBAR_TRIGGER: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
  height: 28, minWidth: 28, padding: '0 4px', borderRadius: 4,
  border: 'none', cursor: 'pointer', flexShrink: 0,
  background: 'transparent', color: '#18181B',
  transition: 'background-color 150ms', fontFamily: 'var(--font-family-primary)',
};

const ToolbarMenu = ({
  title, active, trigger, children, wide = false, hideChevron = false,
}: {
  title: string;
  active: boolean;
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  wide?: boolean;
  hideChevron?: boolean;
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number; right: number } | null>(null);
  const open = anchor !== null;
  const close = () => setAnchor(null);

  const toggle = () => {
    if (open) { close(); return; }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setAnchor({ top: r.bottom + 6, left: r.left, right: r.right });
  };

  // The toolbar clips its overflow (horizontal button scroll on mobile), which
  // would chop off an in-flow popover. Render it in a body portal with fixed
  // positioning to escape the clip; close on scroll/resize so the anchored
  // position can't go stale.
  useEffect(() => {
    if (!open) return undefined;
    const onMove = () => close();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        title={title}
        onClick={toggle}
        style={{ ...TOOLBAR_TRIGGER, color: active ? '#630DE3' : '#18181B', background: open ? '#F4F4F5' : active ? '#F3EEFF' : 'transparent' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = open ? '#F4F4F5' : active ? '#F3EEFF' : '#F4F4F5'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = open ? '#F4F4F5' : active ? '#F3EEFF' : 'transparent'; }}
      >
        {trigger}
        {!hideChevron && (
          <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}><path d="m6 9 6 6 6-6" /></svg>
        )}
      </button>
      {open && anchor && createPortal(
        (() => {
          const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
          const MENU_W = 248;
          // Wide menus open left-aligned (clamped into the viewport); icon-row
          // menus stay centred under the trigger.
          const left = wide ? Math.max(8, Math.min(anchor.left, vw - 8 - MENU_W)) : (anchor.left + anchor.right) / 2;
          return (
            <>
              {/* click-outside backdrop */}
              <div onMouseDown={close} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
              <div style={{ position: 'fixed', top: anchor.top, left, transform: wide ? 'none' : 'translateX(-50%)', zIndex: 1000 }}>
                <div
                  style={{
                    background: '#fff', borderRadius: 8, padding: wide ? 6 : 4,
                    boxShadow: '0px 4px 16px 0px rgba(24,26,34,0.12), 0px 1px 4px 0px rgba(24,26,34,0.08)',
                    border: '1px solid #F4F4F5',
                    display: 'flex', flexDirection: wide ? 'column' : 'row',
                    alignItems: wide ? 'stretch' : 'center', gap: wide ? 2 : 4,
                    minWidth: wide ? MENU_W : undefined,
                    transformOrigin: wide ? 'top left' : 'top center',
                    animation: 'growOut 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  {children(close)}
                </div>
              </div>
            </>
          );
        })(),
        document.body,
      )}
    </div>
  );
};

const MenuBar = ({ editor, keyword, onAskSurfy, formattingSuspended }: MenuBarProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkInitialText, setLinkInitialText] = useState('');
  const [linkInitialHref, setLinkInitialHref] = useState('');
  const [linkRange, setLinkRange] = useState<{ from: number; to: number } | null>(null);

  const openLinkModal = useCallback(() => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    setLinkRange({ from, to });
    setLinkInitialText(editor.state.doc.textBetween(from, to, '\n'));
    setLinkInitialHref(editor.getAttributes('link').href || '');
    setLinkModalOpen(true);
  }, [editor]);

  const closeLinkModal = useCallback(() => {
    setLinkModalOpen(false);
    setLinkRange(null);
    setLinkInitialText('');
    setLinkInitialHref('');
  }, []);

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
    <>
      <div
        className="no-scrollbar ce-format-toolbar"
        aria-disabled={formattingSuspended || undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          // Auto-Optimize review suspends formatting: dim + block interaction, keep layout stable.
          ...(formattingSuspended ? { pointerEvents: 'none' as const, opacity: 0.5 } : null),
          // `safe center` keeps the toolbar centred when it fits (desktop) but
          // falls back to start-aligned + scrollable when it overflows (mobile),
          // so narrow screens scroll the buttons instead of clipping/overlapping.
          justifyContent: 'safe center',
          padding: '0 12px',
          height: 44,
          background: '#fff',
          flexShrink: 0,
          borderBottom: 'none',
          gap: 8,
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
      {/* Formatting */}
      <div data-tour="format" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>

        {/* Headings dropdown — Paragraph + H1…H6 */}
        {(() => {
          const curLevel = ([1, 2, 3, 4, 5, 6] as const).find((l) => editor.isActive('heading', { level: l }));
          const label = curLevel ? `H${curLevel}` : editor.isActive('paragraph') ? 'P' : 'H';
          return (
            <ToolbarMenu
              title="Text style"
              active={!!curLevel}
              trigger={<span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>}
            >
              {(close) => (
                <>
                  {(() => {
                    const active = editor.isActive('paragraph');
                    return (
                      <button
                        key="p"
                        type="button"
                        onClick={() => { editor.chain().focus().setParagraph().run(); close(); }}
                        title="Paragraph"
                        style={{ ...btnStyle, fontWeight: 500, fontSize: 13, color: active ? '#630DE3' : '#18181B', background: active ? '#F3EEFF' : 'transparent' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = active ? '#F3EEFF' : '#F4F4F5'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = active ? '#F3EEFF' : 'transparent'; }}
                      >
                        P
                      </button>
                    );
                  })()}
                  {([1, 2, 3, 4, 5, 6] as const).map((lvl) => {
                    const active = editor.isActive('heading', { level: lvl });
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => { editor.chain().focus().toggleHeading({ level: lvl }).run(); close(); }}
                        title={`Heading ${lvl}`}
                        style={{ ...btnStyle, fontWeight: 600, fontSize: lvl <= 2 ? 15 - lvl : 13, color: active ? '#630DE3' : '#18181B', background: active ? '#F3EEFF' : 'transparent' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = active ? '#F3EEFF' : '#F4F4F5'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = active ? '#F3EEFF' : 'transparent'; }}
                      >
                        H{lvl}
                      </button>
                    );
                  })}
                </>
              )}
            </ToolbarMenu>
          );
        })()}

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
        {/* Sub / superscript dropdown */}
        <ToolbarMenu
          title="Sub / superscript"
          active={editor.isActive('subscript') || editor.isActive('superscript')}
          trigger={<span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1 }}>x<sup style={{ fontSize: 9 }}>2</sup></span>}
        >
          {(close) => (
            <>
              <button type="button" onClick={() => { editor.chain().focus().toggleSuperscript().run(); close(); }} title="Superscript" style={{ ...btnStyle, color: editor.isActive('superscript') ? '#630DE3' : '#18181B', background: editor.isActive('superscript') ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.isActive('superscript') ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.isActive('superscript') ? '#F3EEFF' : 'transparent'; }}>
                <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1 }}>x<sup style={{ fontSize: 9 }}>2</sup></span>
              </button>
              <button type="button" onClick={() => { editor.chain().focus().toggleSubscript().run(); close(); }} title="Subscript" style={{ ...btnStyle, color: editor.isActive('subscript') ? '#630DE3' : '#18181B', background: editor.isActive('subscript') ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.isActive('subscript') ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.isActive('subscript') ? '#F3EEFF' : 'transparent'; }}>
                <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1 }}>x<sub style={{ fontSize: 9 }}>2</sub></span>
              </button>
            </>
          )}
        </ToolbarMenu>

        <Sep />

        {/* Lists dropdown */}
        <ToolbarMenu
          title="List"
          active={editor.isActive('bulletList') || editor.isActive('orderedList')}
          trigger={
            editor.isActive('orderedList')
              ? <svg viewBox="0 0 256 256" width={18} height={18} fill="currentColor"><path d="M224 128a8 8 0 0 1-8 8H104a8 8 0 0 1 0-16h112a8 8 0 0 1 8 8M104 72h112a8 8 0 0 0 0-16H104a8 8 0 0 0 0 16m112 112H104a8 8 0 0 0 0 16h112a8 8 0 0 0 0-16M43.58 55.16L48 52.94V104a8 8 0 0 0 16 0V40a8 8 0 0 0-11.58-7.16l-16 8a8 8 0 0 0 7.16 14.32m36.19 101.56a23.73 23.73 0 0 0-9.6-15.95a24.86 24.86 0 0 0-34.11 4.7a23.6 23.6 0 0 0-3.57 6.46a8 8 0 1 0 15 5.47a7.8 7.8 0 0 1 1.18-2.13a8.76 8.76 0 0 1 12-1.59a7.9 7.9 0 0 1 3.26 5.32a7.64 7.64 0 0 1-1.57 5.78a1 1 0 0 0-.08.11l-28.69 38.32A8 8 0 0 0 40 216h32a8 8 0 0 0 0-16H56l19.08-25.53a23.47 23.47 0 0 0 4.69-17.75" /></svg>
              : <svg viewBox="0 0 256 256" width={18} height={18} fill="currentColor"><path d="M80 64a8 8 0 0 1 8-8h128a8 8 0 0 1 0 16H88a8 8 0 0 1-8-8m136 56H88a8 8 0 0 0 0 16h128a8 8 0 0 0 0-16m0 64H88a8 8 0 0 0 0 16h128a8 8 0 0 0 0-16M44 116a12 12 0 1 0 0-24a12 12 0 0 0 0 24m0 64a12 12 0 1 0 0-24a12 12 0 0 0 0 24" /></svg>
          }
        >
          {(close) => (
            <>
              <button type="button" onClick={() => { editor.chain().focus().toggleBulletList().run(); close(); }} title="Bullet list" style={{ ...btnStyle, color: editor.isActive('bulletList') ? '#630DE3' : '#18181B', background: editor.isActive('bulletList') ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.isActive('bulletList') ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.isActive('bulletList') ? '#F3EEFF' : 'transparent'; }}>
                <svg viewBox="0 0 256 256" width={18} height={18} fill="currentColor"><path d="M80 64a8 8 0 0 1 8-8h128a8 8 0 0 1 0 16H88a8 8 0 0 1-8-8m136 56H88a8 8 0 0 0 0 16h128a8 8 0 0 0 0-16m0 64H88a8 8 0 0 0 0 16h128a8 8 0 0 0 0-16M44 116a12 12 0 1 0 0-24a12 12 0 0 0 0 24m0 64a12 12 0 1 0 0-24a12 12 0 0 0 0 24" /></svg>
              </button>
              <button type="button" onClick={() => { editor.chain().focus().toggleOrderedList().run(); close(); }} title="Ordered list" style={{ ...btnStyle, color: editor.isActive('orderedList') ? '#630DE3' : '#18181B', background: editor.isActive('orderedList') ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.isActive('orderedList') ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.isActive('orderedList') ? '#F3EEFF' : 'transparent'; }}>
                <svg viewBox="0 0 256 256" width={18} height={18} fill="currentColor"><path d="M224 128a8 8 0 0 1-8 8H104a8 8 0 0 1 0-16h112a8 8 0 0 1 8 8M104 72h112a8 8 0 0 0 0-16H104a8 8 0 0 0 0 16m112 112H104a8 8 0 0 0 0 16h112a8 8 0 0 0 0-16M43.58 55.16L48 52.94V104a8 8 0 0 0 16 0V40a8 8 0 0 0-11.58-7.16l-16 8a8 8 0 0 0 7.16 14.32m36.19 101.56a23.73 23.73 0 0 0-9.6-15.95a24.86 24.86 0 0 0-34.11 4.7a23.6 23.6 0 0 0-3.57 6.46a8 8 0 1 0 15 5.47a7.8 7.8 0 0 1 1.18-2.13a8.76 8.76 0 0 1 12-1.59a7.9 7.9 0 0 1 3.26 5.32a7.64 7.64 0 0 1-1.57 5.78a1 1 0 0 0-.08.11l-28.69 38.32A8 8 0 0 0 40 216h32a8 8 0 0 0 0-16H56l19.08-25.53a23.47 23.47 0 0 0 4.69-17.75" /></svg>
              </button>
              <button type="button" onClick={() => { editor.chain().focus().toggleTaskList().run(); close(); }} title="Checklist" style={{ ...btnStyle, color: editor.isActive('taskList') ? '#630DE3' : '#18181B', background: editor.isActive('taskList') ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.isActive('taskList') ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.isActive('taskList') ? '#F3EEFF' : 'transparent'; }}>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M11 6h10M11 12h10M11 18h10M3 6l1.5 1.5L7 5M3 13l1.5 1.5L7 12" /></svg>
              </button>
            </>
          )}
        </ToolbarMenu>

        {/* Align dropdown */}
        {(() => {
          const aligns = [
            { key: 'left', title: 'Align left', d: 'M3.75 6.75h12.5M3.75 12h16.5M3.75 17.25h10.5' },
            { key: 'center', title: 'Align center', d: 'M5.25 6.75h13.5M3.75 12h16.5M7.25 17.25h9.5' },
            { key: 'right', title: 'Align right', d: 'M7.75 6.75h12.5M3.75 12h16.5M9.75 17.25h10.5' },
          ] as const;
          const cur = aligns.find((a) => editor.isActive({ textAlign: a.key })) || aligns[0];
          return (
            <ToolbarMenu
              title="Text align"
              active={cur.key !== 'left'}
              trigger={<svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d={cur.d} /></svg>}
            >
              {(close) => aligns.map((a) => {
                const active = editor.isActive({ textAlign: a.key }) || (a.key === 'left' && !editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }));
                return (
                  <button key={a.key} type="button" onClick={() => { editor.chain().focus().setTextAlign(a.key).run(); close(); }} title={a.title} style={{ ...btnStyle, color: active ? '#630DE3' : '#18181B', background: active ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = active ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = active ? '#F3EEFF' : 'transparent'; }}>
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d={a.d} /></svg>
                  </button>
                );
              })}
            </ToolbarMenu>
          );
        })()}

        <Sep />

        {/* Link */}
        <button type="button" onClick={openLinkModal} title="Insert link" style={{ ...btnStyle, color: editor.isActive('link') ? '#630DE3' : '#18181B', background: editor.isActive('link') ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = editor.isActive('link') ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = editor.isActive('link') ? '#F3EEFF' : 'transparent'; }}>
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
        <button type="button" data-tour="media" onClick={() => fileInputRef.current?.click()} title="Insert image" style={btnStyle} onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5m10.5-11.25h.008v.008h-.008zm.375 0a.375.375 0 1 1-.75 0a.375.375 0 0 1 .75 0" /></svg>
        </button>

        {/* Insert table (3×3 with a header row) */}
        <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table" style={btnStyle} onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={4} width={18} height={16} rx={1.5} /><path d="M3 9.5h18M3 15h18M9 4.5v15M15 4.5v15" /></svg>
        </button>

        {/* Insert (media / blocks) dropdown */}
        <ToolbarMenu
          title="Insert"
          active={false}
          trigger={<svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
        >
          {(close) => (
            <>
              <button type="button" title="Embed YouTube video" onClick={() => { const url = window.prompt('YouTube video URL'); if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run(); close(); }} style={{ ...btnStyle, width: 'auto', padding: '0 10px', gap: 8, fontSize: 13, fontFamily: 'var(--font-family-primary)' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor"><path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81M10 15V9l5 3z" /></svg>
                <span>YouTube</span>
              </button>
              <button type="button" title="Collapsible details / FAQ" onClick={() => { editor.chain().focus().setDetails().run(); close(); }} style={{ ...btnStyle, width: 'auto', padding: '0 10px', gap: 8, fontSize: 13, fontFamily: 'var(--font-family-primary)' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                <span>Details / FAQ</span>
              </button>
            </>
          )}
        </ToolbarMenu>

        {/* Text color dropdown */}
        {(() => {
          const TEXT_COLORS = [
            { label: 'Default', value: null, swatch: '#18181B' },
            { label: 'Purple', value: '#783AFB', swatch: '#783AFB' },
            { label: 'Green', value: '#1AB25E', swatch: '#1AB25E' },
            { label: 'Red', value: '#FF6F77', swatch: '#FF6F77' },
            { label: 'Gray', value: '#52525C', swatch: '#52525C' },
          ] as const;
          const cur = editor.getAttributes('textStyle').color || '#18181B';
          return (
            <ToolbarMenu
              title="Text color"
              active={!!editor.getAttributes('textStyle').color}
              trigger={<span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1, borderBottom: `3px solid ${cur}`, paddingBottom: 1 }}>A</span>}
            >
              {(close) => TEXT_COLORS.map((c) => {
                const active = c.value ? editor.isActive('textStyle', { color: c.value }) : !editor.getAttributes('textStyle').color;
                return (
                  <button key={c.label} type="button" title={c.label} onClick={() => { if (c.value) editor.chain().focus().setColor(c.value).run(); else editor.chain().focus().unsetColor().run(); close(); }} style={{ ...btnStyle, background: active ? '#F3EEFF' : 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = active ? '#F3EEFF' : '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = active ? '#F3EEFF' : 'transparent'; }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: c.swatch, border: c.value ? 'none' : '1.5px solid #D4D4D8', display: 'inline-block' }} />
                  </button>
                );
              })}
            </ToolbarMenu>
          );
        })()}

        {/* Highlight color dropdown */}
        <ToolbarMenu
          title="Highlight color"
          active={editor.isActive('highlight')}
          wide
          trigger={(
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', flexShrink: 0 }}>
              <path d="M9.53 16.122a3 3 0 0 0-5.78 1.128a2.25 2.25 0 0 1-2.4 2.245a4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128m0 0a16 16 0 0 0 3.388-1.62m-5.043-.025a16 16 0 0 1 1.622-3.395m3.42 3.42a16 16 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a16 16 0 0 0-4.649 4.764m3.42 3.42a6.78 6.78 0 0 0-3.42-3.42" />
            </svg>
          )}
        >
          {(close) => (
            <>
              {HIGHLIGHT_COLORS.map((item) => {
                const active = isHighlightActive(editor, item.color);
                return (
                  <button
                    key={item.label}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (item.color === null) {
                        editor.chain().focus().unsetHighlight().run();
                      } else {
                        editor.chain().focus().toggleHighlight({ color: item.color }).run();
                      }
                      close();
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '4px 8px', borderRadius: 6,
                      background: active ? '#F3EEFF' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      color: '#18181B', fontSize: 13,
                      fontFamily: 'var(--font-family-primary)',
                      transition: 'background-color 120ms ease',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#F4F4F5'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <HighlightSwatchIcon color={item.swatch} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              <div style={{ height: 1, background: '#F4F4F5', margin: '2px 0' }} />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().unsetHighlight().run();
                  close();
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '4px 8px', borderRadius: 6,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#FF6F77', fontSize: 13,
                  fontFamily: 'var(--font-family-primary)',
                  transition: 'background-color 120ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg viewBox="0 0 256 256" width={16} height={16} style={{ display: 'inline-block', flexShrink: 0 }}>
                  <path fill="currentColor" d="M216 48H40a8 8 0 0 0 0 16h8v144a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16V64h8a8 8 0 0 0 0-16m-32 160H72V64h112Zm-80-112v96a8 8 0 0 1-16 0V96a8 8 0 0 1 16 0m32 0v96a8 8 0 0 1-16 0V96a8 8 0 0 1 16 0" />
                </svg>
                Clear all highlights
              </button>
            </>
          )}
        </ToolbarMenu>

        <Sep />

        {/* Undo */}
        <button type="button" onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!canUndo} style={{ ...btnStyle, opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'not-allowed' }} onMouseEnter={(e) => { if (canUndo) e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
        </button>
        {/* Redo */}
        <button type="button" onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!canRedo} style={{ ...btnStyle, opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'not-allowed' }} onMouseEnter={(e) => { if (canRedo) e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m15 15l6-6m0 0l-6-6m6 6H9a6 6 0 0 0 0 12h3" /></svg>
        </button>

        <Sep />

        {/* Overflow ("…") menu — less-common actions, keeps the toolbar narrow */}
        <ToolbarMenu
          title="More"
          active={editor.isActive('codeBlock') || editor.isActive('blockquote')}
          wide
          hideChevron
          trigger={<svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor"><circle cx={5} cy={12} r={1.7} /><circle cx={12} cy={12} r={1.7} /><circle cx={19} cy={12} r={1.7} /></svg>}
        >
          {(close) => {
            const row = (key: string, icon: React.ReactNode, label: string, run: () => void, shortcut?: string, on = false) => (
              <button
                key={key}
                type="button"
                onClick={() => { run(); close(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: on ? '#F3EEFF' : 'transparent', color: on ? '#630DE3' : '#18181B', fontSize: 13, fontFamily: 'var(--font-family-primary)', textAlign: 'left', transition: 'background-color 120ms ease' }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = '#F4F4F5'; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ flexShrink: 0, color: on ? '#630DE3' : '#52525C', display: 'inline-flex' }}>{icon}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {shortcut && <span style={{ color: '#9f9fa9', fontSize: 12, flexShrink: 0 }}>{shortcut}</span>}
              </button>
            );
            const divider = <div style={{ height: 1, background: '#F4F4F5', margin: '4px 6px' }} />;
            return (
              <>
                {row('code', <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="m8 9l-3 3l3 3m8-6l3 3l-3 3" /></svg>, 'Toggle code block', () => editor.chain().focus().toggleCodeBlock().run(), 'Ctrl+Alt+C', editor.isActive('codeBlock'))}
                {row('quote', <svg viewBox="0 0 24 24" width={17} height={17} fill="currentColor"><path d="M7 7h4v6c0 2.2-1.5 3.6-3.7 4l-.5-1.3c1.3-.3 2-.9 2.1-1.9H7zm7 0h4v6c0 2.2-1.5 3.6-3.7 4l-.5-1.3c1.3-.3 2-.9 2.1-1.9H14z" /></svg>, 'Toggle blockquote', () => editor.chain().focus().toggleBlockquote().run(), 'Ctrl+Shift+B', editor.isActive('blockquote'))}
                {divider}
                {row('hr', <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><path d="M4 12h16" /></svg>, 'Insert horizontal rule', () => editor.chain().focus().setHorizontalRule().run())}
                {row('break', <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 5v6a3 3 0 0 1-3 3H5m0 0l4-4m-4 4l4 4" /></svg>, 'Insert hard break', () => editor.chain().focus().setHardBreak().run())}
                {divider}
                {row('clear', <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h11M9 7l-2 13m6-13l-1 6.5M5 21l14-14" /></svg>, 'Clear formatting', () => editor.chain().focus().unsetAllMarks().run())}
              </>
            );
          }}
        </ToolbarMenu>

      </div>

      {/* Right: Ask Surfy */}
      <button
        type="button"
        data-tour="ask-surfy"
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
        <IconSurfy size={20} />
        Ask Surfy
      </button>
      </div>

      <SurfyLinkModal
        editor={editor}
        open={linkModalOpen}
        initialText={linkInitialText}
        initialHref={linkInitialHref}
        range={linkRange}
        onClose={closeLinkModal}
      />
    </>
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

// Friendly labels for the live activity list (tool name → human phrase).
const SURFY_TOOL_LABELS: Record<string, string> = {
  get_tool_catalog: 'Reviewing available tools', get_content_score: 'Checking content score',
  list_missing_terms: 'Finding missing terms', get_ranking_signals: 'Reading ranking signals',
  list_internal_link_targets: 'Looking up internal links', get_ai_search_score: 'Checking AI-search score',
  check_plagiarism: 'Scanning for plagiarism', fetch_competitor_outline: 'Fetching competitor outlines',
  get_headings_outline: 'Reading the outline', get_outline: 'Reading the outline', read_block: 'Reading a section',
  apply_edit: 'Editing the article', insert_section: 'Adding a section', set_meta: 'Updating SEO meta',
  generate_social_posts: 'Writing social posts', apply_readability: 'Improving readability',
  publish_to_wordpress: 'Preparing to publish',
};
const surfyToolLabel = (tool: string) => SURFY_TOOL_LABELS[tool] || tool;

type SurfyAgentDonePayload = {
  message?: string;
  finalHtml?: string | null;
  content?: string | null;
  action?: string;
  thinking?: string;
  changelog?: unknown[];
  pendingAction?: PendingAction | null;
  meta?: { metaTitle?: string; metaDescription?: string } | null;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
};

/** Read the agent's SSE stream, forwarding live events, and resolve with the terminal `done` payload. */
async function readSurfyAgentStream(
  res: Response,
  on: { text: (delta: string) => void; step: (d: { phase: string; tool: string }) => void; usage: (n: number) => void },
): Promise<SurfyAgentDonePayload> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let done: SurfyAgentDonePayload | null = null;
  for (;;) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buf += dec.decode(value, { stream: true });
    const frames = buf.split('\n\n');
    buf = frames.pop() || '';
    for (const f of frames) {
      const ev = /event: (.*)/.exec(f)?.[1];
      const dataLine = /data: (.*)/.exec(f)?.[1];
      if (!ev || !dataLine) continue;
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(dataLine) as Record<string, unknown>; } catch { continue; }
      if (ev === 'text') on.text(String(parsed.delta || ''));
      else if (ev === 'step') on.step(parsed as { phase: string; tool: string });
      else if (ev === 'usage') on.usage(Number(parsed.totalTokens) || 0);
      else if (ev === 'done') done = parsed as SurfyAgentDonePayload;
      else if (ev === 'error') throw new Error(String(parsed.error || 'stream error'));
    }
  }
  if (!done) throw new Error('stream ended without result');
  return done;
}

// "/" slash-command menu items. Structural commands run on the live editor; Ask Surfy goes via a ref
// (the handler is defined inside the component). Filtered by the text typed after "/".
const SlashIcon = ({ d }: { d: string }) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

const filterSlashItems = (query: string, askSurfyRef: React.MutableRefObject<() => void>): SlashItem[] => {
  const del = (editor: Editor, range: { from: number; to: number }) => editor.chain().focus().deleteRange(range);
  const all: SlashItem[] = [
    { title: 'Ask Surfy', hint: '/ask', icon: <IconSurfy size={18} />, command: ({ editor, range }) => { del(editor, range).run(); askSurfyRef.current?.(); } },
    { title: 'Add an image', hint: '/img', icon: <SlashIcon d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6" />, command: ({ editor, range }) => {
      del(editor, range).run();
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => {
        const f = inp.files?.[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = () => editor.chain().focus().setImage({ src: reader.result as string, alt: '' }).run();
        reader.readAsDataURL(f);
      };
      inp.click();
    } },
    { section: 'HEADINGS', title: 'Set H1', hint: '/h1', icon: <SlashIcon d="M4 6v12M12 6v12M4 12h8M17 10l3-1v9" />, command: ({ editor, range }) => del(editor, range).toggleHeading({ level: 1 }).run() },
    { section: 'HEADINGS', title: 'Set H2', hint: '/h2', icon: <SlashIcon d="M4 6v12M11 6v12M4 12h7M16 10a2 2 0 1 1 3 1.6L16 18h4" />, command: ({ editor, range }) => del(editor, range).toggleHeading({ level: 2 }).run() },
    { section: 'HEADINGS', title: 'Set H3', hint: '/h3', icon: <SlashIcon d="M4 6v12M11 6v12M4 12h7M16 9a2 2 0 1 1 2 3 2 2 0 1 1-2 3" />, command: ({ editor, range }) => del(editor, range).toggleHeading({ level: 3 }).run() },
    { section: 'LISTS', title: 'Toggle bulleted list', hint: '/bullet', icon: <SlashIcon d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01" />, command: ({ editor, range }) => del(editor, range).toggleBulletList().run() },
    { section: 'LISTS', title: 'Toggle ordered list', hint: '/order', icon: <SlashIcon d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M4 14h2l-2 3h2" />, command: ({ editor, range }) => del(editor, range).toggleOrderedList().run() },
    { section: 'OTHERS', title: 'Add blockquote', hint: '/quote', icon: <SlashIcon d="M7 7H4v6h3l-1 4M17 7h-3v6h3l-1 4" />, command: ({ editor, range }) => del(editor, range).toggleBlockquote().run() },
    { section: 'OTHERS', title: 'Add code block', hint: '/code', icon: <SlashIcon d="M9 8l-4 4 4 4M15 8l4 4-4 4" />, command: ({ editor, range }) => del(editor, range).toggleCodeBlock().run() },
    { section: 'OTHERS', title: 'Insert table', hint: '/table', icon: <SlashIcon d="M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14" />, command: ({ editor, range }) => del(editor, range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  ];
  const q = query.toLowerCase().trim();
  if (!q) return all;
  return all.filter((i) => i.title.toLowerCase().includes(q) || i.hint.slice(1).startsWith(q));
};

/* ── Empty-article "get started" CTA ──────────────────────────────────
 * Surfer-style blank state shown under the title/first line when the doc is
 * empty: import from URL, insert a competitor-derived outline, or open Surfy. */
const CTA_FONT = 'var(--font-family-primary)';
const IconGlobe = () => (<svg viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M5.25 6h.008v.008H5.25zM7.5 6h.008v.008H7.5zm2.25 0h.008v.008H9.75z" /></svg>);
const IconOutline = () => (<svg viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.008v.008H3.75zm0 5.25h.008v.008H3.75zm0 5.25h.008v.008H3.75z" /></svg>);
const IconSpark = () => (<svg viewBox="0 0 24 24" width={18} height={18}><path fill="currentColor" d="M9 3l1.2 3.3L13.5 7.5L10.2 8.7L9 12L7.8 8.7L4.5 7.5L7.8 6.3zm7 6l.9 2.4l2.4.9l-2.4.9l-.9 2.4l-.9-2.4l-2.4-.9l2.4-.9z" /></svg>);
const IconClose = () => (<svg viewBox="0 0 20 20" width={18} height={18}><path fill="currentColor" d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94z" /></svg>);

const CtaButton = ({ icon, children, onClick, busy }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; busy?: boolean }) => (
  <button type="button" onClick={onClick} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', color: '#18181B', fontSize: 14, fontWeight: 500, fontFamily: CTA_FONT, cursor: busy ? 'default' : 'pointer', boxShadow: '0px 1px 2px rgba(24,26,34,0.06)', opacity: busy ? 0.7 : 1, transition: 'background 150ms ease, border-color 150ms ease' }} onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.background = '#F4F4F5'; e.currentTarget.style.borderColor = '#D4D4D8'; } }} onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#E4E4E7'; }}>
    {busy ? <span style={{ width: 16, height: 16, border: '2px solid #D4D4D8', borderTopColor: '#52525C', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <span style={{ display: 'inline-flex', color: '#52525C' }}>{icon}</span>}
    {children}
  </button>
);

const ImportBar = ({ url, onChange, onImport, onClose, busy }: { url: string; onChange: (v: string) => void; onImport: () => void; onClose: () => void; busy?: boolean }) => (
  <form onSubmit={(e) => { e.preventDefault(); onImport(); }} style={{ display: 'flex', width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, background: '#F4F4F5', borderRadius: 8, padding: '6px 8px' }}>
    <span style={{ display: 'inline-flex', alignSelf: 'center', color: '#52525C', marginLeft: 6 }}><IconGlobe /></span>
    <input value={url} onChange={(e) => onChange(e.target.value)} placeholder="https://example.com/article.html" aria-label="URL" autoFocus style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#18181B', fontFamily: CTA_FONT }} />
    <button type="submit" disabled={busy || !url.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 6, background: '#2F2F34', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: CTA_FONT, padding: '6px 12px', cursor: busy || !url.trim() ? 'default' : 'pointer', opacity: busy || !url.trim() ? 0.6 : 1 }}>
      <span>Import</span>
    </button>
    <button type="button" onClick={onClose} aria-label="Clear value" style={{ display: 'inline-flex', alignItems: 'center', border: 'none', background: 'transparent', color: '#52525C', cursor: 'pointer', padding: 4, marginRight: 4 }}><IconClose /></button>
  </form>
);

const ArticleEditor = ({ content, keyword, metaTitle, metaDescription, scoreData, internalArticles, onChange, onMetaTitleChange, onMetaDescriptionChange, onHeadingsChange, initialFeaturedImage, onFeaturedImageChange, editorRef, reviewMode, formattingSuspended, readOnly, highlightTerms, onAiActivity, articleKeyword, comments, threads, commentAuthor, commentArticleId, onCommentsChanged, onCreateComment, plagiarismSentences, plagiarismFocused, onSurfyOpenChange, surfyDockEl }: Props) => {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onHeadingsChangeRef = useRef(onHeadingsChange);
    onHeadingsChangeRef.current = onHeadingsChange;
    // Refs so the (once-built) decoration plugin always reads the latest comments/handler.
    const commentAnchors: CommentAnchor[] = comments || (threads ? threads.map((t) => ({ id: t.id, quote: t.quote })) : []);
    const commentsRef = useRef<CommentAnchor[]>(commentAnchors);
    commentsRef.current = commentAnchors;
    // Live refs for the term-highlight decorations (read inside the PM plugin).
    const termsRef = useRef<NlpTerm[]>([]);
    termsRef.current = scoreData?.terms || [];
    const highlightTermsRef = useRef<boolean>(highlightTerms ?? true);
    highlightTermsRef.current = highlightTerms ?? true;
    const plagSentencesRef = useRef<string[]>([]);
    plagSentencesRef.current = plagiarismSentences ?? [];
    const plagFocusedRef = useRef<string | null>(null);
    plagFocusedRef.current = plagiarismFocused ?? null;
    const editorWrapRef = useRef<HTMLDivElement>(null);
    const [linkTip, setLinkTip] = useState<{ text: string; top: number; left: number } | null>(null);
    const [openCommentId, setOpenCommentId] = useState<string | null>(null);
    const openCommentRef = useRef<(id: string) => void>(() => {});
    openCommentRef.current = (id: string) => setOpenCommentId(id);

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
    // Empty-document "get started" state (Surfer-style CTA on a blank article).
    const [docEmpty, setDocEmpty] = useState(true);
    const [ctaMode, setCtaMode] = useState<'menu' | 'import'>('menu');
    const [importUrl, setImportUrl] = useState('');
    const [importBusy, setImportBusy] = useState(false);
    const [outlineBusy, setOutlineBusy] = useState(false);
    const [surfyResponse, setSurfyResponse] = useState<{ action?: string; message: string; content: string | null; changelog?: Array<{ tool: string; summary: string }>; steps?: number; pendingAction?: PendingAction | null } | null>(null);
    const [publishing, setPublishing] = useState(false);
    // Live streaming state for the agent (SSE): per-tool activity, the in-progress text, token usage.
    const [surfyActivity, setSurfyActivity] = useState<Array<{ tool: string; done: boolean; error?: boolean }>>([]);
    const [surfyStreamText, setSurfyStreamText] = useState('');
    const [surfyUsageDetail, setSurfyUsageDetail] = useState<{ input: number; output: number }>({ input: 0, output: 0 });
    // Running totals across all turns of the current conversation (reset on a new conversation).
    const [surfyTotals, setSurfyTotals] = useState<{ input: number; output: number }>({ input: 0, output: 0 });
    // The organization's shared 5h AI-token pool (drives the ring + the blocked banner).
    const [orgUsage, setOrgUsage] = useState<{ used: number; limit: number; resetsAt: number; over: boolean } | null>(null);
    const refreshOrgUsage = useCallback(async () => {
      try { const r = await fetch('/api/ai-usage'); if (r.ok) setOrgUsage(await r.json()); } catch { /* never block the editor on a usage read */ }
    }, []);
    const [surfySelection, setSurfySelection] = useState<{ text: string; from: number; to: number } | null>(null);
    // In-editor "Add comment" composer, anchored below the selection (viewport coords).
    const [commentDraft, setCommentDraft] = useState<{ quote: string; top: number; left: number; from: number; to: number } | null>(null);
    // Keep the commented range highlighted while the composer is open (decoration).
    const draftRangeRef = useRef<{ from: number; to: number } | null>(null);
    draftRangeRef.current = commentDraft ? { from: commentDraft.from, to: commentDraft.to } : null;
    const surfyInputRef = useRef<HTMLTextAreaElement>(null);
    const surfyScrollRef = useRef<HTMLDivElement>(null);
    // The "/ask" slash item opens Surfy via this ref (the handler is defined further down).
    const slashAskSurfyRef = useRef<() => void>(() => {});

    // Auto-grow the Surfy textarea to fit its content (capped at maxHeight, then it scrolls).
    useEffect(() => {
      const el = surfyInputRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }, [surfyPrompt, surfyOpen]);

    useEffect(() => { onAiActivity?.(surfyLoading); }, [surfyLoading]); // eslint-disable-line react-hooks/exhaustive-deps
    // Tell the page when Surfy opens/closes so it can dock the chat pane in the right column.
    useEffect(() => { onSurfyOpenChange?.(surfyOpen); }, [surfyOpen]); // eslint-disable-line react-hooks/exhaustive-deps
    // Keep the org's shared 5h usage fresh while the panel is open: on open, when the tab regains
    // focus, and on a slow interval — so a teammate burning the pool shows up without a failed send.
    useEffect(() => {
      if (!surfyOpen) return undefined;
      void refreshOrgUsage();
      const onFocus = () => { void refreshOrgUsage(); };
      window.addEventListener('focus', onFocus);
      const iv = setInterval(() => { void refreshOrgUsage(); }, 60000);
      return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
    }, [surfyOpen, refreshOrgUsage]);


    type SurfyMsg = { role: 'user' | 'assistant'; message: string; content?: string | null; action?: string; thinking?: string };
    const [surfyHistory, setSurfyHistory] = useState<SurfyMsg[]>([]);
    // Saved conversations (localStorage, per article) for the header's history dropdown.
    type SurfyConvo = { id: string; title: string; ts: number; history: SurfyMsg[] };
    const [surfyConversations, setSurfyConversations] = useState<SurfyConvo[]>([]);
    const surfyConvoKey = `surfy-conversations-${commentArticleId || 'x'}`;
    useEffect(() => {
      try { const raw = localStorage.getItem(surfyConvoKey); if (raw) setSurfyConversations(JSON.parse(raw)); else setSurfyConversations([]); } catch { setSurfyConversations([]); }
    }, [surfyConvoKey]);
    const persistConvos = (list: SurfyConvo[]) => {
      setSurfyConversations(list);
      try { localStorage.setItem(surfyConvoKey, JSON.stringify(list)); } catch { /* quota/unavailable */ }
    };
    // Archive the current chat (if it has messages) before clearing for a new/loaded one.
    const archiveCurrentConvo = () => {
      if (!surfyHistory.length) return;
      const firstUser = surfyHistory.find((m) => m.role === 'user')?.message || 'Conversation';
      const convo: SurfyConvo = { id: `${Date.now()}`, title: firstUser.slice(0, 60), ts: Date.now(), history: surfyHistory };
      persistConvos([convo, ...surfyConversations].slice(0, 20));
    };

    const handleAskSurfy = () => {
      if (!editor) return;
      // Just hide/show — keep the conversation + any pending response so reopening continues it.
      if (surfyOpen) { setSurfyOpen(false); return; }
      const { from, to, empty } = editor.state.selection;
      if (!empty && from !== to) {
        const text = editor.state.doc.textBetween(from, to, '\n');
        setSurfySelection({ text, from, to });
      } else {
        setSurfySelection(null);
      }
      setSurfyOpen(true);
      setTimeout(() => surfyInputRef.current?.focus(), 50);
    };
    slashAskSurfyRef.current = handleAskSurfy;

  const handleSurfySubmit = async () => {
      const prompt = surfyPrompt.trim();
      if (!prompt || !editor) return;
      setSurfyLoading(true);
      setSurfyResponse(null);
      setSurfyActivity([]);
      setSurfyStreamText('');
      setSurfyUsageDetail({ input: 0, output: 0 });

      setSurfyHistory((prev) => {
        const next = [...prev, { role: 'user' as const, message: prompt }];
        return next.length > MAX_SURFY_HISTORY ? next.slice(-MAX_SURFY_HISTORY) : next;
      });
      // Clear the composer once the message is sent (restored below only if the
      // request is blocked by the shared budget).
      setSurfyPrompt('');

      try {
        const htmlContent = editor.getHTML();
        const useAgent = !surfySelection; // article mode → multi-step agent
        const endpoint = useAgent ? '/api/articles/surfy-agent' : '/api/articles/ask-surfy';
        if (useAgent) surfyOriginalRef.current = htmlContent; // remember pre-edit HTML for the diff

        const ac = new AbortController();
        surfyAbortRef.current = ac;

        const body = useAgent
          ? {
              prompt,
              content: htmlContent,
              keyword: articleKeyword || keyword || '',
              scoreData: scoreData || null,
              internalArticles: internalArticles || [],
              articleTitle: metaTitle || '',
              articleMetaDescription: metaDescription || '',
              history: surfyHistory,
              articleId: commentArticleId ? Number(commentArticleId) : null,
              authorName: commentAuthor?.name || '',
            }
          : {
              prompt,
              content: htmlContent,
              mode: 'selection',
              selectedText: surfySelection?.text || null,
              selectionRange: surfySelection ? { from: surfySelection.from, to: surfySelection.to } : null,
              scoreData: scoreData || null,
              internalArticles: internalArticles || [],
              keyword: articleKeyword || keyword || '',
              history: surfyHistory,
            };
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ac.signal,
        });

        // Org-wide budget exhausted (shared 5h pool): surface the blocked banner, not a chat error.
        if (res.status === 429) {
          const ej = await res.json().catch(() => ({}));
          if (ej.error === 'org_limit') {
            setOrgUsage({ used: ej.used ?? 0, limit: ej.limit ?? 0, resetsAt: ej.resetsAt ?? 0, over: true });
            setSurfyHistory((prev) => prev.slice(0, -1)); // drop the optimistic user bubble; keep their prompt in the box
            setSurfyPrompt(prompt); // restore the composer so they can retry after the reset
            return;
          }
        }

        let data: SurfyAgentDonePayload & Record<string, unknown>;
        if (useAgent) {
          // SSE stream: errors before streaming come back as JSON; otherwise read the stream.
          if (!res.ok) { const ej = await res.json().catch(() => ({})); throw new Error(ej.error || 'Request failed'); }
          data = await readSurfyAgentStream(res, {
            text: (delta) => setSurfyStreamText((t) => t + delta),
            usage: () => {}, // live running count not shown; the ring updates from the final usage below
            step: (d) => setSurfyActivity((a) => {
              if (d.phase === 'start') return [...a, { tool: d.tool, done: false }];
              const rev = [...a].reverse().findIndex((x) => x.tool === d.tool && !x.done);
              if (rev === -1) return a;
              const idx = a.length - 1 - rev;
              const copy = a.slice();
              copy[idx] = { ...copy[idx], done: true, error: d.phase === 'error' };
              return copy;
            }),
          });
          setSurfyUsageDetail({ input: data.usage?.inputTokens || 0, output: data.usage?.outputTokens || 0 });
          setSurfyTotals((t) => ({ input: t.input + (data.usage?.inputTokens || 0), output: t.output + (data.usage?.outputTokens || 0) }));
        } else {
          const json = await res.json() as Record<string, unknown>;
          if (!res.ok) throw new Error(String(json.error || 'Request failed'));
          data = json as SurfyAgentDonePayload & Record<string, unknown>;
        }

        if (useAgent) {
          surfyMetaRef.current = data.meta || null;
          setSurfyResponse({
            action: 'replace_article',
            message: data.message || '',
            content: data.finalHtml || null,
            changelog: (data.changelog || []) as Array<{ tool: string; summary: string }>,
            steps: undefined,
            pendingAction: data.pendingAction || null,
          });
        } else {
          surfyMetaRef.current = null;
          setSurfyResponse({ action: data.action, message: data.message || '', content: data.content ?? null });
        }
        setSurfyHistory((prev) => {
          const next = [...prev, {
            role: 'assistant' as const,
            message: data.message || '',
            content: data.finalHtml ?? data.content ?? null,
            action: data.action,
            thinking: data.thinking || '',
          }];
          return next.length > MAX_SURFY_HISTORY ? next.slice(-MAX_SURFY_HISTORY) : next;
        });
        setSurfyPrompt('');
        void refreshOrgUsage(); // this turn drew from the shared pool — refresh the ring
      } catch (err) {
        const e = err as { name?: string; message?: string };
        if (e?.name === 'AbortError') return; // user pressed Stop
        const errMsg = 'Error: ' + e.message;
        setSurfyResponse({ message: errMsg, content: null });
        setSurfyHistory((prev) => {
          const next = [...prev, { role: 'assistant' as const, message: errMsg }];
          return next.length > MAX_SURFY_HISTORY ? next.slice(-MAX_SURFY_HISTORY) : next;
        });
      } finally {
        setSurfyLoading(false);
        surfyAbortRef.current = null;
      }
    };

    const handleSurfyApply = () => {
      if (!editor || !surfyResponse) return;
      // For analysis-only, there's nothing to apply
      if (!surfyResponse.content && surfyResponse.action !== 'delete_selection') return;

      if (surfySelection) {
        const action = surfyResponse.action || 'replace_selection';
        switch (action) {
          case 'delete_selection':
            editor.chain().focus().deleteRange({ from: surfySelection.from, to: surfySelection.to }).run();
            break;
          case 'insert_after_selection':
            editor.chain().focus().insertContentAt(surfySelection.to, surfyResponse.content || '').run();
            break;
          case 'replace_selection':
          default:
            editor.chain().focus().insertContentAt(
              { from: surfySelection.from, to: surfySelection.to },
              surfyResponse.content || ''
            ).run();
            break;
        }
      } else {
        // Full article mode
        if (surfyResponse.content) {
          // emitUpdate:true so the editor fires onUpdate → page onChange → AUTO-SAVE.
          // Without it setContent is silent and the applied changes never persist.
          editor.commands.setContent(surfyResponse.content, { emitUpdate: true });
        }
        if (surfyMetaRef.current) {
          if (surfyMetaRef.current.metaTitle != null) onMetaTitleChange?.(surfyMetaRef.current.metaTitle);
          if (surfyMetaRef.current.metaDescription != null) onMetaDescriptionChange?.(surfyMetaRef.current.metaDescription);
          surfyMetaRef.current = null;
        }
      }
      // Keep the panel + conversation open so the user can continue; just clear the
      // applied response/draft. (Closing wiped the chat — that surprised users.)
      setSurfyPrompt('');
      setSurfyResponse(null);
      setSurfySelection(null);
    };

    // Always-current editor ref — useEditor returns null on first render in
    // Next.js (TipTap v3 detects window.next and forces immediatelyRender:false).
    // A plain ref lets getEditor() read the live value without stale-closure issues.
    const editorLiveRef = useRef<Editor | null>(null);
    const surfyOpenRef = useRef(surfyOpen);
    surfyOpenRef.current = surfyOpen;
    const surfyMetaRef = useRef<{ metaTitle?: string; metaDescription?: string } | null>(null);
    const surfyOriginalRef = useRef<string>('');                  // pre-edit HTML, for the diff preview
    const surfyAbortRef = useRef<AbortController | null>(null);   // for Stop/Cancel

    // The agent never publishes; it PROPOSES (pendingAction). The user confirms here, and we call the
    // existing publish endpoint, which publishes the SAVED article.
    const confirmPublish = useCallback(async (pa: PendingAction) => {
      setPublishing(true);
      try {
        const res = await fetch('/api/articles/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleId: pa.articleId, target: pa.target }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Publish failed');
        toast.success(d.url ? `Opublikowano: ${d.url}` : 'Opublikowano');
        setSurfyResponse((prev) => (prev ? { ...prev, pendingAction: null } : prev));
      } catch (e) {
        toast.error(getErrorMessage(e) || 'Publikacja nie powiodła się');
      } finally {
        setPublishing(false);
      }
    }, []);
    const [surfyCompareOpen, setSurfyCompareOpen] = useState(false);

    // Contract for the docked light SurfyChatPanel (when the page provides a dock element).
    const surfyApi: SurfyPanelApi = {
      history: surfyHistory,
      loading: surfyLoading,
      activity: surfyActivity,
      streamText: surfyStreamText,
      response: surfyResponse,
      metaPending: surfyMetaRef.current
        ? (surfyMetaRef.current.metaTitle != null && surfyMetaRef.current.metaDescription != null ? 'title + description'
          : surfyMetaRef.current.metaTitle != null ? 'title' : 'description')
        : null,
      prompt: surfyPrompt,
      publishing,
      canApply: Boolean(surfyResponse && (surfyResponse.content || surfyResponse.action === 'delete_selection' || surfyMetaRef.current)),
      canCompare: Boolean(surfyResponse?.content && surfyOriginalRef.current),
      usage: { conversation: surfyUsageDetail.input, lastInput: surfyUsageDetail.input, lastOutput: surfyUsageDetail.output, totalInput: surfyTotals.input, totalOutput: surfyTotals.output },
      orgUsage,
      suggestions: ['Add missing keywords', 'Improve the weakest ranking signal', 'Add an FAQ section', 'Rewrite the intro'],
      inputRef: surfyInputRef,
      scrollRef: surfyScrollRef,
      toolLabel: surfyToolLabel,
      setPrompt: setSurfyPrompt,
      submit: handleSurfySubmit,
      stop: () => surfyAbortRef.current?.abort(),
      apply: handleSurfyApply,
      openCompare: () => setSurfyCompareOpen(true),
      dismiss: () => { setSurfyResponse(null); setSurfyPrompt(''); surfyMetaRef.current = null; },
      conversations: surfyConversations.map((c) => ({ id: c.id, title: c.title, ts: c.ts })),
      newConversation: () => {
        archiveCurrentConvo();
        setSurfyHistory([]); setSurfyResponse(null); setSurfyPrompt(''); surfyMetaRef.current = null;
        setSurfyTotals({ input: 0, output: 0 }); setSurfyUsageDetail({ input: 0, output: 0 });
      },
      openConversation: (id) => {
        const convo = surfyConversations.find((c) => c.id === id);
        if (!convo) return;
        archiveCurrentConvo();
        setSurfyHistory(convo.history);
        setSurfyResponse(null); setSurfyPrompt(''); surfyMetaRef.current = null;
        setSurfyTotals({ input: 0, output: 0 }); setSurfyUsageDetail({ input: 0, output: 0 });
      },
      deleteConversation: (id) => persistConvos(surfyConversations.filter((c) => c.id !== id)),
      renameConversation: (id, title) => persistConvos(surfyConversations.map((c) => (c.id === id ? { ...c, title: title.trim() || c.title } : c))),
      confirmPublish: () => { if (surfyResponse?.pendingAction) confirmPublish(surfyResponse.pendingAction); },
      cancelPublish: () => setSurfyResponse((prev) => (prev ? { ...prev, pendingAction: null } : prev)),
      pickSuggestion: (sug) => { setSurfyPrompt(sug); surfyInputRef.current?.focus(); },
      // Selected-text context chip. Clearing it nulls the selection → the highlight effect
      // ([surfyOpen, surfySelection]) removes the purple highlight from the article.
      selectionText: surfySelection?.text || null,
      clearSelection: () => setSurfySelection(null),
      close: () => setSurfyOpen(false),
    };

    const calcAndEmit = useCallback((ed: Editor) => {
      setDocEmpty(ed.getText().trim().length === 0);
      let html = ed.getHTML();
      // Strip highlight marks when Surfy is open to prevent leaking into saved content
      if (surfyOpenRef.current) html = html.replace(/<\/?mark[^>]*>/g, '');
      const text = ed.getText();
      // Word count comes from Tiptap's CharacterCount (handles unicode/whitespace
      // more robustly than a naive split) with a split fallback if unavailable.
      const words = ed.storage.characterCount?.words?.() ?? text.split(/\s+/).filter(Boolean).length;
      const json = ed.getJSON();
      const content = json.content || [];
      const headings = content.filter((n: JSONContent) => n.type === 'heading').length;
      const paragraphs = content.filter((n: JSONContent) => n.type === 'paragraph' && n.content?.length).length;
      onChangeRef.current(html, text, words, headings, paragraphs);
      if (onHeadingsChangeRef.current) {
        const items: HeadingItem[] = [];
        ed.state.doc.descendants((node: PMNode, pos: number) => {
          if (node.type.name === 'heading') items.push({ level: node.attrs.level as number, text: node.textContent, pos });
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
        // Underline is bundled in StarterKit v3, so it is NOT registered separately.
        StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, link: false }),
        SurferImage.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: 'article-image' } }),
        // contentOptimizer nodes are ephemeral review markers — never persisted to the saved article.
        // The orchestration layer (auto-optimize flow) suspends autosave while these nodes exist.
        ContentOptimizer,
        TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
        Link.extend({
          addAttributes() {
            return {
              ...this.parent?.(),
              'data-surfer-link': {
                default: null,
                parseHTML: (el: HTMLElement) => el.getAttribute('data-surfer-link'),
                renderHTML: (attrs: Record<string, unknown>) => (
                  attrs['data-surfer-link'] ? { 'data-surfer-link': String(attrs['data-surfer-link']) } : {}
                ),
              },
            };
          },
        }).configure({ openOnClick: false, autolink: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
        Highlight.configure({ multicolor: true }),
        CommentHighlight.configure({
          getComments: () => commentsRef.current,
          onCommentClick: (id) => openCommentRef.current(id),
          getDraftRange: () => draftRangeRef.current,
        }),
        TermHighlight.configure({
          getTerms: () => termsRef.current,
          getEnabled: () => highlightTermsRef.current,
        }),
        PlagiarismHighlight.configure({
          getSentences: () => plagSentencesRef.current,
          getFocused: () => plagFocusedRef.current,
        }),
        TableKit.configure({ table: { resizable: true } }),
        Typography,
        CharacterCount,
        TaskList,
        TaskItem.configure({ nested: true }),
        Subscript,
        Superscript,
        TextStyle,
        Color,
        Details.configure({ persist: true, HTMLAttributes: { class: 'art-details' } }),
        DetailsSummary,
        DetailsContent,
        Youtube.configure({ width: 640, height: 360, nocookie: true, HTMLAttributes: { class: 'art-youtube' } }),
        Placeholder.configure({
          placeholder: ({ node }) => (node.type.name === 'heading' && node.attrs.level === 1 ? 'Untitled' : 'Start writing or type a slash /'),
          includeChildren: false,
          showOnlyCurrent: false,
        }),
        SlashCommand.configure({ items: (query: string) => filterSlashItems(query, slashAskSurfyRef) }),
      ],
      content: content || '<h1></h1><p></p>',
      immediatelyRender: false,
      editable: !readOnly,
      onCreate({ editor: ed }) { calcAndEmit(ed); },
      // Only recompute on real content changes — skips selection/decoration-refresh
      // transactions (e.g. the no-op tx we dispatch to repaint comment highlights).
      onUpdate({ editor: ed, transaction }) { if (transaction.docChanged) calcAndEmit(ed); },
    });

    // Keep the live ref in sync on every render
    editorLiveRef.current = editor;

    useEffect(() => {
      if (!editor) return;
      editor.setEditable(!readOnly);
    }, [editor, readOnly]);

    const toolbarLocked = !!formattingSuspended || !!readOnly;

    const surfyHlRangeRef = useRef<{ from: number; to: number } | null>(null);
    useEffect(() => {
      if (!editor) return;
      if (surfyOpen && surfySelection) {
        editor.chain().unsetHighlight().setTextSelection({ from: surfySelection.from, to: surfySelection.to }).setHighlight({ color: 'rgba(120, 58, 251, 0.15)' }).run();
        surfyHlRangeRef.current = { from: surfySelection.from, to: surfySelection.to };
      } else if (surfyHlRangeRef.current) {
        // Remove the Surfy highlight from its EXACT range. The cursor may have moved off it, so
        // unsetHighlight()/isActive('highlight') (which act on the current selection) miss it and
        // the purple highlight lingers. removeMark on the stored range clears it without moving the
        // caret or touching the user's own highlights.
        const { from, to } = surfyHlRangeRef.current;
        surfyHlRangeRef.current = null;
        const markType = editor.state.schema.marks.highlight;
        const docSize = editor.state.doc.content.size;
        if (markType && from < to && to <= docSize) {
          editor.view.dispatch(editor.state.tr.removeMark(from, to, markType));
        }
      }
    }, [surfyOpen, surfySelection]);

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
          setSurfySelection(null);
          setSurfyHistory([]);
          setSurfyTotals({ input: 0, output: 0 });
          setSurfyUsageDetail({ input: 0, output: 0 });
          setSurfyPrompt(prompt);
          setTimeout(() => surfyInputRef.current?.focus(), 100);
        },
        // Right-panel toolbar toggle (docked pane), mirrors the Version-History button.
        toggleSurfy: () => { setSurfyOpen((o) => !o); setTimeout(() => surfyInputRef.current?.focus(), 80); },
      };
      return () => { editorRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorRef]);

    useEffect(() => {
      if (editor && content && editor.getHTML() !== content) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }, [content, editor]);

    // ── "Get started" CTA actions (blank-article empty state) ──────────
    const handleImportUrl = async () => {
      const url = importUrl.trim();
      if (!url || !editor) return;
      setImportBusy(true);
      try {
        const res = await fetch('/api/articles/import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, extractOnly: true }),
        });
        const data = await res.json();
        if (!res.ok || !data.contentHtml) throw new Error(data.error || 'Import failed');
        editor.commands.setContent(data.contentHtml, { emitUpdate: true });
        setCtaMode('menu'); setImportUrl('');
      } catch (e) {
        toast.error(getErrorMessage(e) || 'Could not import content from that URL.');
      } finally {
        setImportBusy(false);
      }
    };

    const handleInsertOutline = async () => {
      const kw = (keyword || articleKeyword || '').trim();
      const articleId = commentArticleId ? Number(commentArticleId) : undefined;
      if (!kw && !articleId) { toast.error('No keyword available to build an outline.'); return; }
      if (!editor) return;
      setOutlineBusy(true);
      try {
        const res = await fetch('/api/articles/generate-outline', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: kw, articleId, language: 'pl' }),
        });
        const data = await res.json();
        const headings: Array<{ level: number; text: string }> = Array.isArray(data.headings) ? data.headings : [];
        if (!res.ok || headings.length === 0) throw new Error(data.error || 'Could not generate an outline.');
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `${headings.map((h) => {
          const lvl = Math.min(Math.max(h.level, 1), 4);
          return `<h${lvl}>${esc(h.text)}</h${lvl}>`;
        }).join('')}<p></p>`;
        editor.commands.setContent(html, { emitUpdate: true });
      } catch (e) {
        toast.error(getErrorMessage(e) || 'Could not generate an outline.');
      } finally {
        setOutlineBusy(false);
      }
    };

    const handleWriteWithAi = () => {
      setSurfyOpen(true);
      setSurfyResponse(null);
      setSurfySelection(null);
      setTimeout(() => surfyInputRef.current?.focus(), 100);
    };

    // Repaint comment decorations when the comment list changes (no-op tx forces
    // the decorations prop to re-run, reading the latest commentsRef).
    useEffect(() => {
      if (editor) editor.view.dispatch(editor.state.tr);
    }, [comments, threads, commentDraft, editor]);

    // Repaint term highlights on toggle (to show or clear them). When disabled the
    // plugin renders nothing, so no whole-doc term scan happens.
    useEffect(() => {
      if (editor) editor.view.dispatch(editor.state.tr);
    }, [highlightTerms, editor]);
    // Repaint plagiarism highlights only when the active sentences / focused match actually
    // change — `plagiarismSentences` is a fresh array each render, so key on a stable signature.
    const plagSig = `${(plagiarismSentences ?? []).join('')} ${plagiarismFocused ?? ''}`;
    useEffect(() => {
      if (editor) editor.view.dispatch(editor.state.tr);
    }, [plagSig, editor]);
    // Scroll the focused plagiarism match into view (after the decoration repaint above).
    useEffect(() => {
      if (!editor || !plagiarismFocused) return undefined;
      const t = setTimeout(() => {
        editor.view.dom.querySelector('.plag-hl-focus')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 60);
      return () => clearTimeout(t);
    }, [plagiarismFocused, editor]);

    // While enabled, repaint as coverage changes; skipped entirely when off so the
    // findTermRangesBatch pass doesn't run on every save.
    useEffect(() => {
      if (editor && highlightTerms) editor.view.dispatch(editor.state.tr);
    }, [scoreData?.terms, highlightTerms, editor]);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: '#fff', position: 'relative' }}>
        <style>{`
          .art-editor-scroll {
            flex: 1;
            overflow-y: auto;
            /* overflow-y:auto makes the browser compute overflow-x as auto too,
               so absolutely-positioned overlays (comment pins, bubble menu) that
               peek past the right edge trigger a horizontal scrollbar — which adds
               a chunky gutter at the bottom. Article text wraps and images are
               capped at 100%, so nothing legitimate needs horizontal scroll. */
            overflow-x: hidden;
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
          .art-editor-scroll .ProseMirror > h1::after { content: 'h1'; }
          .art-editor-scroll .ProseMirror > h2::after { content: 'h2'; }
          .art-editor-scroll .ProseMirror > h3::after { content: 'h3'; }
          .art-editor-scroll .ProseMirror > p::after { content: 'p'; }
          .art-editor-scroll .ProseMirror > ul::after { content: 'ul'; }
          .art-editor-scroll .ProseMirror > ol::after { content: 'ol'; }
          .art-editor-scroll .ProseMirror > h1::after,
          .art-editor-scroll .ProseMirror > h2::after,
          .art-editor-scroll .ProseMirror > h3::after,
          .art-editor-scroll .ProseMirror > p::after,
          .art-editor-scroll .ProseMirror > ul::after,
          .art-editor-scroll .ProseMirror > ol::after {
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
          /* New-line placeholder — Surfer-style: inherits the paragraph's size/line-height/spacing
             (so a fresh line sits as a normal paragraph and nothing shifts when you start typing),
             soft gray, NOT italic. */
          .art-editor-scroll .ProseMirror p.is-empty::before { color: #9ca3af; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
          /* Empty-title placeholder ("Untitled") — inherits the h1 size/weight, soft gray, not italic. */
          .art-editor-scroll .ProseMirror h1.is-empty::before { color: #a1a1aa; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
          /* On a blank article the ProseMirror min-height / bottom padding collapse so the "get started" CTA sits right under the first line. */
          .art-editor-scroll[data-empty="true"] .ProseMirror { min-height: 0; padding-bottom: 8px; }
          /* Hide the paragraph placeholder while importing so only "Importing your content…" shows. */
          .art-editor-scroll[data-importing="true"] .ProseMirror p.is-empty::before { content: none; }
          .art-editor-scroll .ProseMirror a { color: #2563eb; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
          .art-editor-scroll .ProseMirror a:hover { color: #1d4ed8; }
          .art-editor-scroll[data-review="true"] .ProseMirror a { background: #783afb; color: #fff !important; text-decoration: none; border-radius: 3px; padding: 1px 3px; }
          .art-editor-scroll[data-review="true"] .ProseMirror a:hover { background: #6d28d9; color: #fff !important; }
          .art-editor-scroll .ProseMirror hr { border: none; border-top: 1px solid #e4e4e7; margin: 22px 0; }
          .art-editor-scroll .ProseMirror .comment-mark { text-decoration: underline; text-decoration-color: #783AFB; text-decoration-thickness: 2px; text-underline-offset: 2px; background: rgba(120,58,251,0.08); cursor: pointer; }
          .art-editor-scroll .ProseMirror .comment-mark-draft { background: rgba(120,58,251,0.22); }
          .art-editor-scroll .ProseMirror table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 18px 0; overflow: hidden; font-size: 14px; }
          .art-editor-scroll .ProseMirror table td, .art-editor-scroll .ProseMirror table th { border: 1px solid #e4e4e7; padding: 8px 12px; vertical-align: top; box-sizing: border-box; position: relative; min-width: 1em; color: #374151; line-height: 1.6; }
          .art-editor-scroll .ProseMirror table th { background: #f4f4f5; font-weight: 600; color: #18181b; text-align: left; }
          .art-editor-scroll .ProseMirror table p { margin: 0; }
          .art-editor-scroll .ProseMirror table .selectedCell:after { content: ''; position: absolute; inset: 0; background: rgba(120,58,251,0.08); pointer-events: none; z-index: 2; }
          .art-editor-scroll .ProseMirror table .column-resize-handle { position: absolute; right: -2px; top: 0; bottom: -2px; width: 4px; background: #783afb; pointer-events: none; }
          .art-editor-scroll .ProseMirror.resize-cursor { cursor: col-resize; }
          /* Task list (checklist) */
          .art-editor-scroll .ProseMirror ul[data-type="taskList"] { list-style: none; padding: 0; margin: 10px 0; }
          .art-editor-scroll .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; margin: 4px 0; }
          .art-editor-scroll .ProseMirror ul[data-type="taskList"] li > label { flex-shrink: 0; margin-top: 3px; user-select: none; }
          .art-editor-scroll .ProseMirror ul[data-type="taskList"] li > div { flex: 1 1 auto; min-width: 0; }
          .art-editor-scroll .ProseMirror ul[data-type="taskList"] li > div > p { margin: 0; }
          .art-editor-scroll .ProseMirror ul[data-type="taskList"] input[type="checkbox"] { width: 15px; height: 15px; accent-color: #783afb; cursor: pointer; }
          .art-editor-scroll .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div { color: #9f9fa9; text-decoration: line-through; }
          /* Details / FAQ (collapsible) */
          .art-editor-scroll .ProseMirror [data-type="details"] { display: flex; gap: 8px; border: 1px solid #e4e4e7; border-radius: 8px; padding: 10px 12px; margin: 14px 0; background: #fafafa; }
          .art-editor-scroll .ProseMirror [data-type="details"] > button { flex: 0 0 auto; width: 16px; height: 22px; background: transparent; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; }
          .art-editor-scroll .ProseMirror [data-type="details"] > button::before { content: '▶'; color: #783afb; font-size: 10px; transition: transform 0.15s ease; }
          .art-editor-scroll .ProseMirror [data-type="details"].is-open > button::before { transform: rotate(90deg); }
          .art-editor-scroll .ProseMirror [data-type="details"] > div { flex: 1 1 auto; min-width: 0; }
          .art-editor-scroll .ProseMirror [data-type="detailsSummary"] { font-weight: 600; color: #18181b; }
          .art-editor-scroll .ProseMirror [data-type="detailsContent"] > p { margin: 6px 0 0; color: #374151; }
          /* YouTube embed */
          .art-editor-scroll .ProseMirror div[data-youtube-video] { margin: 16px 0; }
          .art-editor-scroll .ProseMirror div[data-youtube-video] iframe { max-width: 100%; width: 100%; aspect-ratio: 16 / 9; height: auto; border: none; border-radius: 8px; }
          .art-editor-scroll[data-readonly="true"] { cursor: wait; }
          .art-editor-scroll[data-readonly="true"] .ProseMirror { cursor: wait; user-select: none; }
          .art-editor-scroll[data-readonly="true"] .ProseMirror * { pointer-events: none; }
        `}</style>

        {/* Toolbar */}
        {editor && <MenuBar editor={editor} keyword={keyword} onAskSurfy={handleAskSurfy} formattingSuspended={toolbarLocked} />}

        {/* Scrollable editor — Title/Description + Featured image now live in the
            "Publish or Export" panel, so the editor shows the article body only.
            Wrapped in a relative container so the progressive-blur fades pin to the
            scroll-area edges (below the toolbar) and don't scroll with the content. */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="art-editor-scroll styled-scrollbar" data-review={reviewMode ? 'true' : 'false'} data-readonly={readOnly ? 'true' : 'false'} data-empty={docEmpty && !readOnly ? 'true' : 'false'} data-importing={importBusy ? 'true' : 'false'}>
          <div
            ref={editorWrapRef}
            className={surfySelection ? 'surfy-selection-highlight' : ''}
            style={{ position: 'relative', paddingTop: 24 }}
            onMouseOver={(e) => {
              const el = e.target as HTMLElement;
              // Term highlight takes priority over an enclosing link.
              const term = el.closest?.('.term-hl') as HTMLElement | null;
              const a = el.closest?.('a[href]') as HTMLAnchorElement | null;
              const target = term || a;
              if (target && editorWrapRef.current?.contains(target)) {
                const text = term ? (term.getAttribute('data-term-tip') || '') : (a?.getAttribute('href') || '');
                if (text) {
                  const r = target.getBoundingClientRect();
                  setLinkTip({ text, top: r.top, left: r.left + r.width / 2 });
                }
              }
            }}
            onMouseOut={(e) => {
              const el = e.target as HTMLElement;
              const target = (el.closest?.('.term-hl') || el.closest?.('a[href]')) as HTMLElement | null;
              const to = e.relatedTarget as Node | null;
              if (target && (!to || !target.contains(to))) setLinkTip(null);
            }}
          >
            <EditorContent editor={editor} style={{ background: '#fff' }} />
            {editor && docEmpty && !readOnly && (
              <div style={{ maxWidth: 860, margin: '0 auto', padding: '4px 64px 80px', fontFamily: CTA_FONT }}>
                {importBusy ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#52525C', fontSize: 14 }}>
                    <span style={{ width: 16, height: 16, border: '2px solid #D4D4D8', borderTopColor: '#52525C', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Importing your content…
                  </div>
                ) : ctaMode === 'import' ? (
                  <ImportBar url={importUrl} onChange={setImportUrl} onImport={handleImportUrl} onClose={() => { setCtaMode('menu'); setImportUrl(''); }} busy={importBusy} />
                ) : (
                  <>
                    <div style={{ fontSize: 14, color: '#9ca3af', margin: '0 0 12px' }}>or get started with</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <CtaButton icon={<IconGlobe />} onClick={() => setCtaMode('import')}>Import content from URL</CtaButton>
                      <CtaButton icon={<IconOutline />} onClick={handleInsertOutline} busy={outlineBusy}>Insert Outline</CtaButton>
                      <CtaButton icon={<IconSpark />} onClick={handleWriteWithAi}>Write with Surfer AI</CtaButton>
                    </div>
                  </>
                )}
              </div>
            )}
            {linkTip && (
              <div style={{ ...TIP_BUBBLE_BASE, top: linkTip.top - 8, left: linkTip.left, transform: 'translate(-50%, -100%)', maxWidth: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {linkTip.text}
              </div>
            )}
            {editor && (
              <SurfyBubbleMenu
                editor={editor}
                onAskSurfy={(selection) => {
                  setSurfySelection(selection);
                  setSurfyResponse(null);
                  setSurfyHistory([]);
                  setSurfyOpen(true);
                }}
                onAddComment={onCreateComment ? (selection) => {
                  if (!selection.text.trim()) return;
                  const wrap = editorWrapRef.current;
                  if (!wrap) return;
                  const wRect = wrap.getBoundingClientRect();
                  const end = editor.view.coordsAtPos(selection.to);
                  const start = editor.view.coordsAtPos(selection.from);
                  setCommentDraft({ quote: selection.text, from: selection.from, to: selection.to, top: end.bottom - wRect.top + 8, left: (start.left + end.right) / 2 - wRect.left });
                } : undefined}
              />
            )}

            {/* Margin pins + thread bubbles, anchored to the comment decorations */}
            {editor && threads && commentAuthor && commentArticleId && (
              <EditorCommentsOverlay
                editor={editor}
                wrapperRef={editorWrapRef}
                threads={threads}
                author={commentAuthor}
                articleId={commentArticleId}
                onChanged={() => onCommentsChanged?.()}
                openId={openCommentId}
                onOpenChange={setOpenCommentId}
              />
            )}

            {/* In-editor comment composer (dark bubble) anchored to the selection */}
            {commentDraft && (
              <div style={{ position: 'absolute', top: commentDraft.top, left: commentDraft.left, transform: 'translateX(-50%)', zIndex: 250, width: 320, maxWidth: 'min(74vw, 360px)' }}>
                <CommentComposer
                  authorName={commentAuthor?.name || 'You'}
                  authorColor={commentAuthor?.color || '#783AFB'}
                  authorAvatar={commentAuthor?.avatar}
                  autoFocus
                  onSubmit={async (draft: DraftComment) => {
                    const quote = commentDraft.quote;
                    setCommentDraft(null);
                    editor?.commands.setTextSelection(editor.state.selection.to);
                    const id = await onCreateComment?.(quote, { text: draft.text, images: draft.images });
                    if (id) setOpenCommentId(id);
                  }}
                  onCancel={() => setCommentDraft(null)}
                />
              </div>
            )}
          </div>
          {/* Progressive-blur fades at the top & bottom scroll edges (à la Skiper41). */}
          <ProgressiveBlur position="top" backgroundColor="#fff" height={72} blurAmount={4} />
          <ProgressiveBlur position="bottom" backgroundColor="#fff" height={80} blurAmount={4} />
        </div>
        </div>

        {/* Docked Surfy chat — rendered (via portal) into the page's right-column dock when present. */}
        {surfyOpen && surfyDockEl && createPortal(
          <>
            <SurfyChatPanel s={surfyApi} />
            {surfyCompareOpen && surfyResponse?.content && (
              <CompareVersionsModal
                original={surfyOriginalRef.current}
                updated={surfyResponse.content}
                terms={(scoreData?.terms || []).map((t) => t.term)}
                onClose={() => setSurfyCompareOpen(false)}
              />
            )}
          </>,
          surfyDockEl,
        )}

      </div>
    );
};

ArticleEditor.displayName = 'ArticleEditor';
export default ArticleEditor;
