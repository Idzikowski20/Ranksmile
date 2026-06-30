import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { BubbleMenu } from '@tiptap/react/menus';
import { HIGHLIGHT_COLORS, HighlightSwatchIcon, isHighlightActive } from '../../lib/highlightColors';

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

const IconSurfy = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="none" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
    <defs>
      <linearGradient id="surfy-bubble-gradient" x1="2.01449e-7" y1="31.8993" x2="36.6637" y2="25.0444" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF4087"/>
        <stop offset="1" stopColor="#FFC056"/>
      </linearGradient>
    </defs>
    <path d="M3.07678 9.07672C3.07678 5.76301 5.76307 3.07672 9.07678 3.07672H22.9233C26.237 3.07672 28.9233 5.76301 28.9233 9.07672V22.9233C28.9233 26.237 26.237 28.9233 22.9233 28.9233H9.07678C5.76307 28.9233 3.07678 26.237 3.07678 22.9233V9.07672Z" fill="white"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M8.49224 2C4.92508 2 2.07498 4.94359 2.07498 8.46154L2 23.5385C2 27.1282 4.92508 30 8.4209 30H23.4743C27.0415 30 30 27.0564 30 23.5385L29.9722 8.05139C29.7595 4.65552 26.9073 2 23.5457 2H8.49224ZM27.1802 8.29085C27.0905 6.36259 25.4884 4.8718 23.617 4.8718H8.4209C6.49463 4.8 4.85373 6.45128 4.85373 8.46154L4.84956 23.5385H4.85373C4.85373 25.5487 6.49463 27.1282 8.4209 27.1282H23.4743C25.472 27.1282 27.1463 25.4769 27.1463 23.5385L27.1802 8.29085Z" fill="url(#surfy-bubble-gradient)"/>
    <g style={{ transformOrigin: '11px 14px', animation: 'surfy-blink 4s ease-in-out infinite' }}>
      <path d="M9.84155 11.1844C9.84155 10.3709 9.84155 9.96409 10.0943 9.71135C10.347 9.45862 10.7538 9.45862 11.5673 9.45862H12.1013C12.9148 9.45862 13.3216 9.45862 13.5743 9.71135C13.8271 9.96409 13.8271 10.3709 13.8271 11.1844V16.602C13.8271 17.4155 13.8271 17.8223 13.5743 18.075C13.3216 18.3278 12.9148 18.3278 12.1013 18.3278H11.5673C10.7538 18.3278 10.347 18.3278 10.0943 18.075C9.84155 17.8223 9.84155 17.4155 9.84155 16.602V11.1844Z" fill="black"/>
    </g>
    <g style={{ transformOrigin: '20px 14px', animation: 'surfy-blink 4s ease-in-out 0.15s infinite' }}>
      <path d="M18.1047 11.1844C18.1047 10.3709 18.1047 9.96409 18.3575 9.71135C18.6102 9.45862 19.017 9.45862 19.8305 9.45862H20.3645C21.178 9.45862 21.5848 9.45862 21.8375 9.71135C22.0902 9.96409 22.0902 10.3709 22.0902 11.1844V16.602C22.0902 17.4155 22.0902 17.8223 21.8375 18.075C21.5848 18.3278 21.178 18.3278 20.3645 18.3278H19.8305C19.017 18.3278 18.6102 18.3278 18.3575 18.075C18.1047 17.8223 18.1047 17.4155 18.1047 16.602V11.1844Z" fill="black"/>
    </g>
  </svg>
);

const Separator = () => (
  <div style={{ width: 1, height: 20, background: '#52525C', margin: '0 4px', flexShrink: 0 }} />
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

interface SurfyBubbleMenuProps {
  editor: Editor;
  onAskSurfy: (selection: { text: string; from: number; to: number }) => void;
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
        background: isActive ? '#3F3F47' : 'transparent',
        border: 'none', cursor: 'pointer',
        color: isActive ? '#783AFB' : '#FFFFFF',
        padding: 0,
        transition: 'background-color 200ms ease-in-out',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#3F3F47'; }}
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

export function SurfyLinkModal({
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
      data-surfy-link-modal
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
              htmlFor="surfy-link-anchor"
              style={{ color: '#3F3F47', paddingBottom: '0.375rem', fontSize: 14, lineHeight: '20px', fontWeight: 500 }}
            >
              Text
            </label>
            <div style={{ position: 'relative', display: 'flex', flexGrow: 1, alignItems: 'center' }}>
              <input
                id="surfy-link-anchor"
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
              htmlFor="surfy-link-href"
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
                id="surfy-link-href"
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
                  border: '1px solid #AA93FD',
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

export default function SurfyBubbleMenu({ editor, onAskSurfy, onAddComment }: SurfyBubbleMenuProps) {
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [highlightMenuOpen, setHighlightMenuOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkHref, setLinkHref] = useState('');
  const [linkRange, setLinkRange] = useState<{ from: number; to: number } | null>(null);
  const linkModalOpenRef = useRef(false);

  // Tiptap's <BubbleMenu> owns show/hide + Floating-UI positioning. We only need
  // the (always-mounted) content to re-render when the selection or marks change
  // so the button active-states stay accurate. Re-render ONLY on real doc/selection
  // changes — the BubbleMenu plugin repositions itself via meta-only transactions
  // (docChanged=false, selectionSet=false); re-rendering on those feeds back into
  // another reposition tx and spins into an infinite update loop.
  const [, bumpTick] = useState(0);
  useEffect(() => {
    if (!editor) return undefined;
    const refresh = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.docChanged || transaction.selectionSet) bumpTick((t) => t + 1);
    };
    editor.on('transaction', refresh);
    return () => { editor.off('transaction', refresh); };
  }, [editor]);

  // The editor body scrolls inside `.art-editor-scroll`, so point Floating UI at
  // that container (not just the window) to reposition on inner scroll.
  const scrollTarget = useMemo(
    () => (editor ? (editor.view.dom.closest('.art-editor-scroll') as HTMLElement | null) : null),
    [editor],
  );
  const bubbleOptions = useMemo(
    () => ({
      placement: 'top' as const,
      strategy: 'fixed' as const,
      offset: 8,
      flip: true,
      shift: { padding: 8 },
      ...(scrollTarget ? { scrollTarget } : {}),
    }),
    [scrollTarget],
  );

  const handleAskSurfy = useCallback(() => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '\n');
    onAskSurfy({ text, from, to });
  }, [editor, onAskSurfy]);

  const handleAddComment = useCallback(() => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '\n');
    onAddComment?.({ text, from, to });
  }, [editor, onAddComment]);

  const openLinkModal = useCallback(() => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');

    setBlockMenuOpen(false);
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

  const saveLink = useCallback((event: React.FormEvent) => {
    event.preventDefault();

    if (!linkRange || !linkText.trim() || !linkHref.trim()) return;

    editor
      .chain()
      .focus()
      .insertContentAt(linkRange, {
        type: 'text',
        text: linkText,
        marks: [{ type: 'link', attrs: { href: linkHref.trim() } }],
      })
      .run();

    closeLinkModal();
  }, [closeLinkModal, editor, linkHref, linkRange, linkText]);

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

  return (
    <>
    <BubbleMenu
      editor={editor}
      options={bubbleOptions}
      appendTo={() => document.body}
      shouldShow={({ state, from, to }) => !linkModalOpenRef.current && !state.selection.empty && from !== to}
      style={{ zIndex: 100 }}
    >
    <div
      onMouseDown={(e) => e.preventDefault()}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        background: '#2F2F34', padding: '0 12px', height: 40, maxWidth: 'calc(100vw - 16px)',
        overflow: 'visible', borderRadius: 4,
        boxShadow: '0px 16px 32px 0px rgba(24,26,34,0.32), 0px 2px 4px 0px rgba(24,26,34,0.16), 0px 4px 4px 0px rgba(0,0,0,0.08), 0px 1px 1px 0px rgba(0,0,0,0.04)',
        fontFamily: 'var(--font-family-primary)',
      }}
    >
      <style>{`
        @keyframes surfyGrowOut {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setBlockMenuOpen((open) => !open)}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            gap: 5, borderRadius: 4, minWidth: 70, height: 28,
            background: blockMenuOpen ? '#3F3F47' : 'transparent', border: 'none', cursor: 'pointer',
            color: '#FFFFFF', padding: '0 6px',
            transition: 'background-color 200ms ease-in-out',
            fontFamily: 'var(--font-family-primary)', fontSize: 17, fontWeight: 400,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#3F3F47'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = blockMenuOpen ? '#3F3F47' : 'transparent'; }}
        >
          <span style={{ minWidth: 28, textAlign: 'left' }}>{blockLabel}</span>
          <ChevronDown open={blockMenuOpen} />
        </button>

        {blockMenuOpen && (
          <div
            data-side="top"
            data-align="start"
            role="menu"
            aria-orientation="vertical"
            data-state="open"
            tabIndex={-1}
            style={{
              position: 'absolute',
              bottom: 36,
              left: 0,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 220,
              padding: '0.375rem',
              background: '#18181B',
              color: '#9F9FA9',
              borderRadius: 8,
              boxShadow: '0px 8px 16px 0px #181a220a, 0px 2px 8px 0px #181a2205, 0px 1px 2px 0px #181a220f',
              zIndex: 150,
              outline: 'none',
              animation: 'surfyGrowOut 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              transformOrigin: '0 100%',
              pointerEvents: 'auto',
            }}
          >
            {BLOCK_FORMAT_OPTIONS.map((option) => {
              const active = option.type === 'paragraph'
                ? !activeHeadingLevel
                : activeHeadingLevel === option.level;

              return (
                <button
                  key={`${option.type}-${option.level || 'p'}`}
                  type="button"
                  role="menuitem"
                  aria-selected={active}
                  tabIndex={-1}
                  onClick={() => applyBlockFormat(option)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    minWidth: 220,
                    padding: '0.5rem 0.75rem',
                    border: 'none',
                    borderRadius: 6,
                    background: active ? '#2F2F34' : 'transparent',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontFamily: 'var(--font-family-primary)',
                    fontSize: 14,
                    lineHeight: '20px',
                    fontWeight: 500,
                    textAlign: 'left',
                    textDecoration: 'none',
                    outline: '2px solid transparent',
                    outlineOffset: 2,
                    transition: 'color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = active ? '#2F2F34' : 'transparent'; }}
                >
                  <BlockFormatIcon icon={option.icon} />
                  <span style={{ display: 'block' }}>{option.label}</span>
                  <div style={{ flexGrow: 2 }} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      <ToolButton editor={editor} command="toggleBold" isActive={editor.isActive('bold')}>
        <IconBold />
      </ToolButton>

      <ToolButton editor={editor} command="toggleItalic" isActive={editor.isActive('italic')}>
        <IconItalic />
      </ToolButton>

      <ToolButton editor={editor} command="toggleUnderline" isActive={editor.isActive('underline')}>
        <IconUnderline />
      </ToolButton>

      <ToolButton editor={editor} command="toggleStrike" isActive={editor.isActive('strike')}>
        <IconStrike />
      </ToolButton>

      <Separator />

      <ToolButton
        editor={editor}
        command="toggleLink"
        isActive={editor.isActive('link')}
        onClick={openLinkModal}
      >
        <IconLink />
      </ToolButton>

      <Separator />

      <ToolButton editor={editor} command="unsetAllMarks" isActive={false}>
        <IconClearFormatting />
      </ToolButton>

      <Separator />

      {/* Highlight color picker */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setHighlightMenuOpen((open) => !open)}
          title="Highlight color"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 4, minWidth: 28, width: 'max-content', height: 28,
            background: highlightMenuOpen ? '#3F3F47' : 'transparent',
            border: 'none', cursor: 'pointer',
            color: editor.isActive('highlight') ? '#783AFB' : '#FFFFFF',
            padding: 0,
            transition: 'background-color 200ms ease-in-out',
          }}
          onMouseEnter={(e) => { if (!highlightMenuOpen) e.currentTarget.style.background = '#3F3F47'; }}
          onMouseLeave={(e) => { if (!highlightMenuOpen) e.currentTarget.style.background = 'transparent'; }}
        >
          <svg viewBox="0 0 256 256" width={20} height={20} style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
            <path fill="currentColor" d="M201.8 46.2A55.2 55.2 0 0 0 149 41.5a55.2 55.2 0 0 0-37.9 20.1L43.4 141.2a4 4 0 0 0-.5.6L35 160.5a16.3 16.3 0 0 0 20.3 20.3l18.9-7.9a4 4 0 0 0 .6-.4l80-79.9a56 56 0 0 0 .8-78.3ZM55.6 160.8l-9.6 22.1a.6.6 0 0 1-.2.2a.3.3 0 0 1-.1 0a.4.4 0 0 1-.3-.1a.3.3 0 0 1 0-.1a.6.6 0 0 0 .2-.1l22.1-9.6Zm100.1-77.9l-79.9 80l-9.7-9.7l79.9-79.9a40 40 0 0 1 56.6 56.5l-80.1 80.2l9.7 9.7l80.2-80.2a56 56 0 0 0-56.8-56.6Z" />
          </svg>
        </button>

        {highlightMenuOpen && (
          <div
            role="menu"
            aria-orientation="vertical"
            data-state="open"
            tabIndex={-1}
            style={{
              position: 'absolute',
              bottom: 36,
              left: 0,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 220,
              padding: '0.375rem',
              background: '#18181B',
              color: '#9F9FA9',
              borderRadius: 8,
              boxShadow: '0px 8px 16px 0px #181a220a, 0px 2px 8px 0px #181a2205, 0px 1px 2px 0px #181a220f',
              zIndex: 150,
              outline: 'none',
              animation: 'surfyGrowOut 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              transformOrigin: '0 100%',
              pointerEvents: 'auto',
            }}
          >
            {HIGHLIGHT_COLORS.map((item) => {
              const active = isHighlightActive(editor, item.color);

              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  aria-selected={active}
                  tabIndex={-1}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (item.color === null) {
                      editor.chain().focus().unsetHighlight().run();
                    } else {
                      editor.chain().focus().toggleHighlight({ color: item.color }).run();
                    }
                    setHighlightMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    minWidth: 220,
                    padding: '0.5rem 0.75rem',
                    border: 'none',
                    borderRadius: 6,
                    background: active ? '#2F2F34' : 'transparent',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontFamily: 'var(--font-family-primary)',
                    fontSize: 14,
                    lineHeight: '20px',
                    fontWeight: 500,
                    textAlign: 'left',
                    textDecoration: 'none',
                    outline: '2px solid transparent',
                    outlineOffset: 2,
                    transition: 'color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = active ? '#2F2F34' : 'transparent'; }}
                >
                  <HighlightSwatchIcon color={item.swatch} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div
              style={{
                margin: '0.375rem -0.375rem',
                minHeight: 1,
                minWidth: 1,
                alignSelf: 'stretch',
                background: '#2F2F34',
              }}
            />

            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                editor.chain().focus().unsetHighlight().run();
                setHighlightMenuOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                minWidth: 220,
                padding: '0.5rem 0.75rem',
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: '#D70028',
                cursor: 'pointer',
                userSelect: 'none',
                fontFamily: 'var(--font-family-primary)',
                fontSize: 14,
                lineHeight: '20px',
                fontWeight: 500,
                textAlign: 'left',
                textDecoration: 'none',
                outline: '2px solid transparent',
                outlineOffset: 2,
                transition: 'color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg viewBox="0 0 24 24" width={20} height={20} style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
                <path fill="currentColor" fillRule="evenodd" d="M16.5 4.478v.227a49 49 0 0 1 3.878.512a.75.75 0 1 1-.256 1.478l-.209-.035l-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A49 49 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a53 53 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951m-6.136-1.452a51 51 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a50 50 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452m-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058z" clipRule="evenodd" />
              </svg>
              <span>Clear all highlights</span>
            </button>
          </div>
        )}
      </div>

      <Separator />

      {onAddComment && (
        <>
          <ToolButton editor={editor} isActive={false} onClick={handleAddComment}>
            <IconComment />
          </ToolButton>
          <Separator />
        </>
      )}

      <button
        type="button"
        onClick={handleAskSurfy}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, borderRadius: 4, minWidth: 28, height: 28,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#FFFFFF', padding: '0 6px 0 4px',
          transition: 'background-color 200ms ease-in-out',
          fontFamily: 'var(--font-family-primary)', fontSize: 13, fontWeight: 500,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#3F3F47')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <IconSurfy />
        Ask Surfy
      </button>
    </div>
    </BubbleMenu>

      {linkModalOpen && (
        <div
          data-surfy-link-modal
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '28px 24px 22px',
              }}
            >
              <h2 style={{ margin: 0, color: '#18181B', fontSize: 24, lineHeight: '32px', fontWeight: 700 }}>
                Create link
              </h2>
              <button
                type="button"
                onClick={closeLinkModal}
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
                  htmlFor="surfy-link-anchor"
                  style={{ color: '#3F3F47', paddingBottom: '0.375rem', fontSize: 14, lineHeight: '20px', fontWeight: 500 }}
                >
                  Text
                </label>
                <div style={{ position: 'relative', display: 'flex', flexGrow: 1, alignItems: 'center' }}>
                  <input
                    id="surfy-link-anchor"
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
                  htmlFor="surfy-link-href"
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
                    id="surfy-link-href"
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
                      border: '1px solid #AA93FD',
                      borderRadius: 8,
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', padding: '1.5rem' }}>
              <button
                type="button"
                onClick={closeLinkModal}
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
                disabled={!linkText.trim() || !linkHref.trim()}
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
                  cursor: linkText.trim() && linkHref.trim() ? 'pointer' : 'not-allowed',
                  opacity: linkText.trim() && linkHref.trim() ? 1 : 0.55,
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
      )}
    </>
  );
}
