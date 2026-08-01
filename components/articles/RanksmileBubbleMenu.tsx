import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import { HIGHLIGHT_COLORS, HighlightSwatchIcon, isHighlightActive } from '../../lib/highlightColors';
import {
  shouldOpenCustomContextMenu,
  menuAnchorPoint,
  clampMenuPosition,
  RANKSMILE_PRESET_IMPROVE,
  RANKSMILE_PRESET_EXPAND,
  RANKSMILE_VOICE_OPTIONS,
  ranksmilePresetVoice,
} from '../../lib/ranksmileContextMenu';
import IconSmily from './IconSmily';

const IconRanksmile = IconSmily;

const IconBold = () => (
  <svg viewBox="0 0 256 256" width="20" height="20" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
    <path fill="currentColor" d="M170.5 115.7A44 44 0 0 0 140 40H64a7.9 7.9 0 0 0-8 8v152a8 8 0 0 0 8 8h88a48 48 0 0 0 18.5-92.3ZM72 56h68a28 28 0 0 1 0 56H72Zm80 136H72v-64h80a32 32 0 0 1 0 64Z"/>
  </svg>
);

const IconItalic = () => (
  <svg viewBox="0 0 256 256" width="20" height="20" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
    <path fill="currentColor" d="M200 56a8 8 0 0 1-8 8h-34.23L115.1 192H144a8 8 0 0 1 0 16H64a8 8 0 0 1 0-16h34.23L140.9 64H112a8 8 0 0 1 0-16h80a8 8 0 0 1 8 8"/>
  </svg>
);

const IconUnderline = () => (
  <svg viewBox="0 0 256 256" width="20" height="20" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
    <path fill="currentColor" d="M200 224a8 8 0 0 1-8 8H64a8 8 0 0 1 0-16h128a8 8 0 0 1 8 8m-72-24a64.07 64.07 0 0 0 64-64V56a8 8 0 0 0-16 0v80a48 48 0 0 1-96 0V56a8 8 0 0 0-16 0v80a64.07 64.07 0 0 0 64 64"/>
  </svg>
);

const IconStrike = () => (
  <svg viewBox="0 0 256 256" width="20" height="20" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
    <path fill="currentColor" d="M224 128a8 8 0 0 1-8 8h-40.07c9.19 7.11 16.07 17.2 16.07 32c0 13.34-7 25.7-19.75 34.79C160.33 211.31 144.61 216 128 216s-32.33-4.69-44.25-13.21C71 193.7 64 181.34 64 168a8 8 0 0 1 16 0c0 17.35 22 32 48 32s48-14.65 48-32c0-14.85-10.54-23.58-38.77-32H40a8 8 0 0 1 0-16h176a8 8 0 0 1 8 8M76.33 104a8 8 0 0 0 7.61-10.49a17.3 17.3 0 0 1-.83-5.51c0-18.24 19.3-32 44.89-32c18.84 0 34.16 7.42 41 19.85a8 8 0 0 0 14-7.7C173.33 50.52 152.77 40 128 40c-34.71 0-60.89 20.63-60.89 48a33.7 33.7 0 0 0 1.62 10.49a8 8 0 0 0 7.6 5.51"/>
  </svg>
);

const IconLink = () => (
  <svg viewBox="0 0 256 256" width="20" height="20" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
    <path fill="currentColor" d="M165.66 90.34a8 8 0 0 1 0 11.32l-64 64a8 8 0 0 1-11.32-11.32l64-64a8 8 0 0 1 11.32 0M215.6 40.4a56 56 0 0 0-79.2 0l-30.06 30.05a8 8 0 0 0 11.32 11.32l30.06-30a40 40 0 0 1 56.57 56.56l-30.07 30.06a8 8 0 0 0 11.31 11.32l30.07-30.11a56 56 0 0 0 0-79.2m-77.26 133.82l-30.06 30.06a40 40 0 1 1-56.56-56.57l30.05-30.05a8 8 0 0 0-11.32-11.32L40.4 136.4a56 56 0 0 0 79.2 79.2l30.06-30.07a8 8 0 0 0-11.32-11.31"/>
  </svg>
);

const IconBrowser = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub', color: 'inherit' }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M5.25 6h.008v.008H5.25zM7.5 6h.008v.008H7.5zm2.25 0h.008v.008H9.75z" />
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const IconClearFormatting = () => (
  <svg viewBox="0 0 256 256" width="20" height="20" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
    <path fill="currentColor" d="M225 80.4L183.6 39a24 24 0 0 0-33.94 0L31 157.66a24 24 0 0 0 0 33.94l30.06 30.06a8 8 0 0 0 5.68 2.34H216a8 8 0 0 0 0-16h-84.7l93.7-93.66a24 24 0 0 0 0-33.94M108.68 208H70.05l-27.72-27.72a8 8 0 0 1 0-11.31L96 115.31L148.69 168Zm105-105L160 156.69L107.31 104L161 50.34a8 8 0 0 1 11.32 0l41.38 41.38a8 8 0 0 1 0 11.31Z"/>
  </svg>
);

const Separator = () => (
  <div style={{ width: 1, height: 20, background: '#dbded4', margin: '0 4px', flexShrink: 0 }} />
);

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    style={{
      display: 'inline-block',
      flexShrink: 0,
      transform: open ? 'rotate(180deg)' : 'none',
      transition: 'transform 160ms ease-in-out',
    }}
  >
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 6l4 4 4-4" />
  </svg>
);

const BLOCK_ICON_PATHS = {
  paragraph: 'M87.24 52.59a8 8 0 0 0-14.48 0l-64 136a8 8 0 1 0 14.48 6.81L39.9 160h80.2l16.66 35.4a8 8 0 1 0 14.48-6.81ZM47.43 144L80 74.79L112.57 144ZM200 96c-12.76 0-22.73 3.47-29.63 10.32a8 8 0 0 0 11.26 11.36c3.8-3.77 10-5.68 18.37-5.68c13.23 0 24 9 24 20v3.22a42.76 42.76 0 0 0-24-7.22c-22.06 0-40 16.15-40 36s17.94 36 40 36a42.73 42.73 0 0 0 24-7.25a8 8 0 0 0 16-.75v-60c0-19.85-17.94-36-40-36m0 88c-13.23 0-24-9-24-20s10.77-20 24-20s24 9 24 20s-10.77 20-24 20',
  h1: 'M152 56v120a8 8 0 0 1-16 0v-52H48v52a8 8 0 0 1-16 0V56a8 8 0 0 1 16 0v52h88V56a8 8 0 0 1 16 0m88 144h-16V88l-20.44 13.63a8 8 0 1 1-8.88-13.31l32-21.33A8 8 0 0 1 240 73.66V200h16a8 8 0 0 1 0 16h-48a8 8 0 0 1 0-16',
  h2: 'M152 56v120a8 8 0 0 1-16 0v-52H48v52a8 8 0 0 1-16 0V56a8 8 0 0 1 16 0v52h88V56a8 8 0 0 1 16 0m88 144h-32l33.55-44.74a32 32 0 1 0-55.73-29.93a8 8 0 1 0 15.08 5.34a16.3 16.3 0 0 1 2.32-4.3a16 16 0 1 1 25.54 19.27L185.6 203.2A8 8 0 0 0 192 216h48a8 8 0 0 0 0-16',
  h3: 'M152 56v120a8 8 0 0 1-16 0v-52H48v52a8 8 0 0 1-16 0V56a8 8 0 0 1 16 0v52h88V56a8 8 0 0 1 16 0m73.52 90.63l21-30A8 8 0 0 0 240 104h-48a8 8 0 0 0 0 16h32.63l-19.18 27.41A8 8 0 0 0 212 160a20 20 0 1 1-14.29 34a8 8 0 1 0-11.42 11.19A36 36 0 0 0 248 180a36.07 36.07 0 0 0-22.48-33.37',
  h4: 'M152 56v120a8 8 0 0 1-16 0v-52H48v52a8 8 0 0 1-16 0V56a8 8 0 0 1 16 0v52h88V56a8 8 0 0 1 16 0m104 128a8 8 0 0 1-8 8h-8v16a8 8 0 0 1-16 0v-16h-48a8 8 0 0 1-6.31-12.91l56-72A8 8 0 0 1 240 112v64h8a8 8 0 0 1 8 8m-32-48.68L192.36 176H224Z',
};

const BlockFormatIcon = ({ icon }: { icon: keyof typeof BLOCK_ICON_PATHS }) => (
  <svg
    viewBox="0 0 256 256"
    width="20"
    height="20"
    style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub', color: 'inherit' }}
  >
    <path fill="currentColor" d={BLOCK_ICON_PATHS[icon]} />
  </svg>
);

export type RanksmileAskSelection = {
  text: string;
  from: number;
  to: number;
  presetPrompt?: string;
  autoSubmit?: boolean;
};

interface RanksmileBubbleMenuProps {
  editor: Editor;
  onAskRanksmile: (selection: RanksmileAskSelection) => void;
  onAddComment?: (selection: { text: string; from: number; to: number }) => void;
}

const IconComment = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M7 8.5h10M7 12h7M21 12a8.5 8.5 0 0 1-12.4 7.55L3 21l1.45-5.6A8.5 8.5 0 1 1 21 12Z" />
  </svg>
);

function ToolButton({ editor, command, isActive, onClick, children }: {
  editor: Editor; command?: string; isActive: boolean; onClick?: () => void; children: React.ReactNode;
}) {
  const runCommand = useCallback(() => {
    const chain = editor.chain().focus();
    switch (command) {
      case 'toggleBold': chain.toggleBold().run(); break;
      case 'toggleItalic': chain.toggleItalic().run(); break;
      case 'toggleUnderline': chain.toggleUnderline().run(); break;
      case 'toggleStrike': chain.toggleStrike().run(); break;
      case 'unsetAllMarks': chain.unsetAllMarks().clearNodes().run(); break;
    }
  }, [editor, command]);

  return (
    <button
      type="button"
      onClick={onClick || runCommand}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 4, minWidth: 28, width: 'max-content', height: 28,
        background: isActive ? '#F4F4F5' : 'transparent',
        border: 'none', cursor: 'pointer',
        color: isActive ? '#F29964' : '#302E36',
        padding: 0,
        transition: 'background-color 200ms ease-in-out',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#F4F4F5'; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

const BLOCK_FORMAT_OPTIONS = [
  { type: 'paragraph' as const, label: 'Paragraph', icon: 'paragraph' as const },
  { type: 'heading' as const, level: 1 as const, label: 'Heading 1', icon: 'h1' as const },
  { type: 'heading' as const, level: 2 as const, label: 'Heading 2', icon: 'h2' as const },
  { type: 'heading' as const, level: 3 as const, label: 'Heading 3', icon: 'h3' as const },
  { type: 'heading' as const, level: 4 as const, label: 'Heading 4', icon: 'h4' as const },
];

type LinkRange = { from: number; to: number };

export function getBlockFormatLabel(level?: 1 | 2 | 3 | 4) {
  return level ? `H${level}` : 'Aa';
}

export function RanksmileLinkModal({
  editor,
  open,
  initialText,
  initialHref,
  range,
  onClose,
}: {
  editor: Editor;
  open: boolean;
  initialText: string;
  initialHref: string;
  range: LinkRange | null;
  onClose: () => void;
}) {
  const [linkText, setLinkText] = useState(initialText);
  const [linkHref, setLinkHref] = useState(initialHref);

  useEffect(() => {
    if (!open) return;
    setLinkText(initialText);
    setLinkHref(initialHref);
  }, [initialHref, initialText, open]);

  const saveLink = useCallback((event: React.FormEvent) => {
    event.preventDefault();

    if (!range || !linkText.trim() || !linkHref.trim()) return;

    editor
      .chain()
      .focus()
      .insertContentAt(range, {
        type: 'text',
        text: linkText,
        marks: [{ type: 'link', attrs: { href: linkHref.trim() } }],
      })
      .run();

    onClose();
  }, [editor, linkHref, linkText, onClose, range]);

  if (!open) return null;

  const canSave = Boolean(linkText.trim() && linkHref.trim());

  return (
    <div
      data-ranksmile-link-modal
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(9,9,11,0.62)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <form
        onSubmit={saveLink}
        style={{
          width: 'min(740px, calc(100vw - 48px))',
          background: '#FFFFFF',
          borderRadius: 8,
          boxShadow: '0 24px 64px rgba(24,26,34,0.34), 0 4px 12px rgba(24,26,34,0.14)',
          overflow: 'hidden',
          fontFamily: 'var(--font-family-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 24px 22px' }}>
          <h2 style={{ margin: 0, color: '#18181B', fontSize: 24, lineHeight: '32px', fontWeight: 700 }}>
            Create link
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create link modal"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              border: 'none',
              background: 'transparent',
              color: '#18181B',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <IconClose />
          </button>
        </div>

        <div style={{ display: 'flex', maxWidth: '100%', flexDirection: 'column', gap: '1.5rem', padding: '0 1.5rem 1.5rem' }}>
          <div style={{ display: 'flex', width: '100%', flexDirection: 'column' }}>
            <label
              htmlFor="ranksmile-link-anchor"
              style={{ color: '#3F3F47', paddingBottom: '0.375rem', fontSize: 14, lineHeight: '20px', fontWeight: 500 }}
            >
              Text
            </label>
            <div style={{ position: 'relative', display: 'flex', flexGrow: 1, alignItems: 'center' }}>
              <input
                id="ranksmile-link-anchor"
                aria-invalid="false"
                placeholder="Add text"
                type="text"
                name="anchor"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                autoFocus
                style={{
                  transition: 'border-color 0.25s, box-shadow 0.25s, outline-color 0.2s ease-in-out',
                  background: 'transparent',
                  boxSizing: 'border-box',
                  width: '100%',
                  cursor: 'text',
                  paddingLeft: '0.75rem',
                  paddingRight: '0.75rem',
                  fontSize: 14,
                  lineHeight: '20px',
                  letterSpacing: 'normal',
                  fontFamily: 'var(--font-family-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minHeight: '2.5rem',
                  outlineOffset: 2,
                  boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
                  color: '#18181B',
                  border: '1px solid #D4D4D8',
                  borderRadius: 8,
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', width: '100%', flexDirection: 'column' }}>
            <label
              htmlFor="ranksmile-link-href"
              style={{ color: '#3F3F47', paddingBottom: '0.375rem', fontSize: 14, lineHeight: '20px', fontWeight: 500 }}
            >
              URL
            </label>
            <div style={{ position: 'relative', display: 'flex', flexGrow: 1, alignItems: 'center' }}>
              <div
                style={{
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'center',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#18181B',
                  left: '0.75rem',
                  pointerEvents: 'none',
                }}
              >
                <IconBrowser />
              </div>
              <input
                id="ranksmile-link-href"
                aria-invalid="false"
                placeholder="https://example.com/article.html"
                type="text"
                name="href"
                value={linkHref}
                onChange={(e) => setLinkHref(e.target.value)}
                style={{
                  transition: 'border-color 0.25s, box-shadow 0.25s, outline-color 0.2s ease-in-out',
                  background: 'transparent',
                  boxSizing: 'border-box',
                  width: '100%',
                  cursor: 'text',
                  paddingLeft: '2.5rem',
                  paddingRight: '0.75rem',
                  fontSize: 14,
                  lineHeight: '20px',
                  letterSpacing: 'normal',
                  fontFamily: 'var(--font-family-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minHeight: '2.5rem',
                  outlineOffset: 2,
                  boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
                  color: '#18181B',
                  border: '1px solid #F5C4A0',
                  borderRadius: 8,
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', padding: '1.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              border: 'none',
              background: 'transparent',
              color: '#3F3F47',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'var(--font-family-primary)',
              fontSize: 16,
              lineHeight: '24px',
              fontWeight: 600,
            }}
          >
            <span>Cancel</span>
          </button>
          <button
            type="submit"
            disabled={!canSave}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              border: 'none',
              borderRadius: 8,
              background: '#18181B',
              color: '#FFFFFF',
              cursor: canSave ? 'pointer' : 'not-allowed',
              opacity: canSave ? 1 : 0.55,
              padding: '0.5rem 1.5rem',
              fontFamily: 'var(--font-family-primary)',
              fontSize: 16,
              lineHeight: '24px',
              fontWeight: 600,
              transition: 'color 150ms ease-in-out, background-color 150ms ease-in-out, box-shadow 150ms ease-in-out, opacity 150ms ease-in-out',
            }}
          >
            <span>Save</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function RanksmileBubbleMenu({ editor, onAskRanksmile, onAddComment }: RanksmileBubbleMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [highlightMenuOpen, setHighlightMenuOpen] = useState(false);
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [voiceLabel, setVoiceLabel] = useState<string>(RANKSMILE_VOICE_OPTIONS[0]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkHref, setLinkHref] = useState('');
  const [linkRange, setLinkRange] = useState<{ from: number; to: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const linkModalOpenRef = useRef(false);
  const [, bumpTick] = useState(0);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setBlockMenuOpen(false);
    setHighlightMenuOpen(false);
    setVoiceMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!editor) return undefined;
    const refresh = () => bumpTick((t) => t + 1);
    editor.on('selectionUpdate', refresh);
    return () => {
      editor.off('selectionUpdate', refresh);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return undefined;
    const onContextMenu = (event: MouseEvent) => {
      if (linkModalOpenRef.current) return;
      const { empty, from, to } = editor.state.selection;
      if (!shouldOpenCustomContextMenu(event, empty || from === to)) return;
      event.preventDefault();
      event.stopPropagation();
      const anchor = menuAnchorPoint(
        event,
        (p) => editor.view.coordsAtPos(p),
        to,
      );
      setPos({ left: anchor.x, top: anchor.y });
      setBlockMenuOpen(false);
      setHighlightMenuOpen(false);
      setVoiceMenuOpen(false);
      setOpen(true);
    };
    const dom = editor.view.dom;
    dom.addEventListener('contextmenu', onContextMenu);
    return () => dom.removeEventListener('contextmenu', onContextMenu);
  }, [editor]);

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const next = clampMenuPosition(pos.left, pos.top, rect.width, rect.height);
    if (next.left !== pos.left || next.top !== pos.top) setPos(next);
  }, [open, pos.left, pos.top, blockMenuOpen, highlightMenuOpen, voiceMenuOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (menuRef.current?.contains(t)) return;
      if ((t as Element).closest?.('[data-ranksmile-link-modal]')) return;
      closeMenu();
    };
    const scrollEl = editor.view.dom.closest('.art-editor-scroll');
    const onScroll = () => closeMenu();
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', onScroll);
    scrollEl?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', onScroll);
      scrollEl?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, [open, closeMenu, editor]);

  const selectionPayload = useCallback(() => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '\n');
    return { text, from, to };
  }, [editor]);

  const askWithPreset = useCallback((presetPrompt: string, autoSubmit: boolean) => {
    const sel = selectionPayload();
    closeMenu();
    onAskRanksmile({ ...sel, presetPrompt, autoSubmit });
  }, [closeMenu, onAskRanksmile, selectionPayload]);

  const handleAskAgent = useCallback(() => {
    const sel = selectionPayload();
    closeMenu();
    onAskRanksmile(sel);
  }, [closeMenu, onAskRanksmile, selectionPayload]);

  const handleAddComment = useCallback(() => {
    const sel = selectionPayload();
    closeMenu();
    onAddComment?.(sel);
  }, [closeMenu, onAddComment, selectionPayload]);

  const openLinkModal = useCallback(() => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');
    setBlockMenuOpen(false);
    setHighlightMenuOpen(false);
    setLinkRange({ from, to });
    setLinkText(selectedText);
    setLinkHref(editor.getAttributes('link').href || '');
    linkModalOpenRef.current = true;
    setLinkModalOpen(true);
  }, [editor]);

  const closeLinkModal = useCallback(() => {
    linkModalOpenRef.current = false;
    setLinkModalOpen(false);
    setLinkRange(null);
    setLinkText('');
    setLinkHref('');
  }, []);

  if (!editor) return null;

  const activeHeadingLevel = BLOCK_FORMAT_OPTIONS
    .filter((option) => option.type === 'heading')
    .find((option) => editor.isActive('heading', { level: option.level }))?.level;
  const blockLabel = getBlockFormatLabel(activeHeadingLevel);

  const applyBlockFormat = (option: typeof BLOCK_FORMAT_OPTIONS[number]) => {
    const chain = editor.chain().focus();
    if (option.type === 'paragraph') {
      chain.setParagraph().run();
    } else if (activeHeadingLevel !== option.level) {
      chain.toggleHeading({ level: option.level }).run();
    } else {
      chain.run();
    }
    setBlockMenuOpen(false);
  };

  const rowBtn = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 4,
    minWidth: 28,
    height: 28,
    border: 'none',
    cursor: 'pointer',
    padding: '0 6px',
    background: active ? '#F4F4F5' : 'transparent',
    color: active ? '#F29964' : '#302E36',
    fontFamily: 'var(--font-family-primary)',
    fontSize: 14,
    fontWeight: 500,
  });

  const actionRow = (label: string, onClick: () => void, trailing?: React.ReactNode): React.ReactNode => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        width: '100%',
        padding: '10px 12px',
        border: 'none',
        borderRadius: 6,
        background: 'transparent',
        color: '#181225',
        cursor: 'pointer',
        fontFamily: 'var(--font-family-primary)',
        fontSize: 14,
        fontWeight: 500,
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f0'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span>{label}</span>
      {trailing}
    </button>
  );

  const menu = open ? createPortal(
    <div
      ref={menuRef}
      role="menu"
      data-ranksmile-context-menu
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 1000,
        minWidth: 260,
        maxWidth: 'min(320px, calc(100vw - 16px))',
        background: '#FFFFFF',
        border: '1px solid #dbded4',
        borderRadius: 8,
        boxShadow: '0 16px 32px rgba(24,26,34,0.16), 0 2px 8px rgba(24,26,34,0.08)',
        fontFamily: 'var(--font-family-primary)',
        overflow: 'visible',
      }}
    >
      {/* Format row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '8px 10px',
          borderBottom: '1px solid #dbded4',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            style={rowBtn(blockMenuOpen)}
            onClick={() => { setHighlightMenuOpen(false); setBlockMenuOpen((o) => !o); }}
          >
            <span style={{ minWidth: 22 }}>{blockLabel}</span>
            <ChevronDown open={blockMenuOpen} />
          </button>
          {blockMenuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 34,
                left: 0,
                minWidth: 200,
                padding: 6,
                background: '#FFFFFF',
                border: '1px solid #dbded4',
                borderRadius: 8,
                boxShadow: '0 8px 16px rgba(24,26,34,0.12)',
                zIndex: 2,
              }}
            >
              {BLOCK_FORMAT_OPTIONS.map((option) => {
                const active = option.type === 'paragraph'
                  ? editor.isActive('paragraph') && !editor.isActive('heading')
                  : editor.isActive('heading', { level: option.level });
                return (
                  <button
                    key={option.label}
                    type="button"
                    role="menuitem"
                    onMouseDown={(e) => { e.preventDefault(); applyBlockFormat(option); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 10px',
                      border: 'none',
                      borderRadius: 6,
                      background: active ? '#F4F4F5' : 'transparent',
                      color: active ? '#F29964' : '#302E36',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-family-primary)',
                      fontSize: 14,
                      fontWeight: 500,
                      textAlign: 'left',
                    }}
                  >
                    <BlockFormatIcon icon={option.icon} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Separator />
        <ToolButton editor={editor} command="toggleBold" isActive={editor.isActive('bold')}><IconBold /></ToolButton>
        <ToolButton editor={editor} command="toggleItalic" isActive={editor.isActive('italic')}><IconItalic /></ToolButton>
        <ToolButton editor={editor} command="toggleUnderline" isActive={editor.isActive('underline')}><IconUnderline /></ToolButton>
        <ToolButton editor={editor} command="toggleStrike" isActive={editor.isActive('strike')}><IconStrike /></ToolButton>
        <Separator />
        <ToolButton editor={editor} isActive={editor.isActive('link')} onClick={openLinkModal}><IconLink /></ToolButton>
        <ToolButton editor={editor} command="unsetAllMarks" isActive={false}><IconClearFormatting /></ToolButton>

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            aria-label="Highlight"
            style={rowBtn(highlightMenuOpen || editor.isActive('highlight'))}
            onClick={() => { setBlockMenuOpen(false); setHighlightMenuOpen((o) => !o); }}
          >
            <svg viewBox="0 0 256 256" width={20} height={20}>
              <path fill="currentColor" d="M201.8 46.2A55.2 55.2 0 0 0 149 41.5a55.2 55.2 0 0 0-37.9 20.1L43.4 141.2a4 4 0 0 0-.5.6L35 160.5a16.3 16.3 0 0 0 20.3 20.3l18.9-7.9a4 4 0 0 0 .6-.4l80-79.9a56 56 0 0 0 .8-78.3ZM55.6 160.8l-9.6 22.1a.6.6 0 0 1-.2.2a.3.3 0 0 1-.1 0a.4.4 0 0 1-.3-.1a.3.3 0 0 1 0-.1a.6.6 0 0 0 .2-.1l22.1-9.6Zm100.1-77.9l-79.9 80l-9.7-9.7l79.9-79.9a40 40 0 0 1 56.6 56.5l-80.1 80.2l9.7 9.7l80.2-80.2a56 56 0 0 0-56.8-56.6Z" />
            </svg>
          </button>
          {highlightMenuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 34,
                right: 0,
                minWidth: 200,
                padding: 6,
                background: '#FFFFFF',
                border: '1px solid #dbded4',
                borderRadius: 8,
                boxShadow: '0 8px 16px rgba(24,26,34,0.12)',
                zIndex: 2,
              }}
            >
              {HIGHLIGHT_COLORS.map((item) => {
                const active = isHighlightActive(editor, item.color);
                return (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (item.color === null) editor.chain().focus().unsetHighlight().run();
                      else editor.chain().focus().toggleHighlight({ color: item.color }).run();
                      setHighlightMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 10px',
                      border: 'none',
                      borderRadius: 6,
                      background: active ? '#F4F4F5' : 'transparent',
                      color: '#302E36',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-family-primary)',
                      fontSize: 14,
                      fontWeight: 500,
                      textAlign: 'left',
                    }}
                  >
                    <HighlightSwatchIcon color={item.swatch} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '6px' }}>
        {onAddComment && actionRow('Comment', handleAddComment, <IconComment />)}
        {actionRow('Improve writing', () => askWithPreset(RANKSMILE_PRESET_IMPROVE, true))}
        {actionRow('Expand', () => askWithPreset(RANKSMILE_PRESET_EXPAND, true))}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setVoiceMenuOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderRadius: 6,
              background: voiceMenuOpen ? '#f3f4f0' : 'transparent',
              color: '#181225',
              cursor: 'pointer',
              fontFamily: 'var(--font-family-primary)',
              fontSize: 14,
              fontWeight: 500,
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = voiceMenuOpen ? '#f3f4f0' : 'transparent'; }}
          >
            <span>Change voice</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#6A6772', fontWeight: 400 }}>
              {voiceLabel}
              <ChevronDown open={voiceMenuOpen} />
            </span>
          </button>
          {voiceMenuOpen && (
            <div
              role="menu"
              style={{
                marginTop: 2,
                marginLeft: 8,
                marginRight: 8,
                padding: 4,
                border: '1px solid #dbded4',
                borderRadius: 6,
                background: '#f3f4f0',
              }}
            >
              {RANKSMILE_VOICE_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setVoiceLabel(v);
                    askWithPreset(ranksmilePresetVoice(v), true);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: 4,
                    background: v === voiceLabel ? '#FFFFFF' : 'transparent',
                    color: '#302E36',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family-primary)',
                    fontSize: 13,
                    textAlign: 'left',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
        {actionRow('Ask Agent', handleAskAgent, <IconRanksmile />)}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      {menu}
      {linkModalOpen && (
        <RanksmileLinkModal
          editor={editor}
          open={linkModalOpen}
          initialText={linkText}
          initialHref={linkHref}
          range={linkRange}
          onClose={closeLinkModal}
        />
      )}
    </>
  );
}
