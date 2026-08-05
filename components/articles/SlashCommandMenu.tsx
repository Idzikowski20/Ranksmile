import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Editor } from '@tiptap/core';

export type SlashItem = {
  title: string;
  hint: string; // e.g. "/ask"
  section?: string; // group header (undefined = top, ungrouped)
  icon: React.ReactNode;
  command: (props: { editor: Editor; range: { from: number; to: number } }) => void;
};

export interface SlashMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface Props {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

/** The "/" command popup (Notion-style). Theme-aware via Koala tokens; keyboard-navigable. */
const SlashCommandMenu = forwardRef<SlashMenuRef, Props>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);
  useEffect(() => { setSelected(0); }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false;
      if (event.key === 'ArrowUp') { setSelected((s) => (s + items.length - 1) % items.length); return true; }
      if (event.key === 'ArrowDown') { setSelected((s) => (s + 1) % items.length); return true; }
      if (event.key === 'Enter') { const it = items[selected]; if (it) command(it); return true; }
      return false;
    },
  }), [items, selected, command]);

  if (!items.length) return null;

  return (
    <div
      role="listbox"
      style={{
        width: 256, maxHeight: 360, overflowY: 'auto',
        background: 'var(--koala-bg-primary)',
        border: '1px solid var(--koala-border-primary)',
        borderRadius: 12,
        padding: 6,
        boxShadow: '0 16px 32px color-mix(in srgb, var(--koala-bg-inverse) 16%, transparent), 0 2px 8px color-mix(in srgb, var(--koala-bg-inverse) 8%, transparent)',
        fontFamily: 'var(--font-family-primary)',
        animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'top left',
      }}
      className="styled-scrollbar"
    >
      {items.map((item, i) => {
        const prevSection = i > 0 ? items[i - 1].section : '__first__';
        const showHeader = item.section && item.section !== prevSection;
        return (
          <React.Fragment key={`${item.title}-${i}`}>
            {showHeader && (
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--koala-text-tertiary)', padding: '8px 8px 4px' }}>
                {item.section}
              </div>
            )}
            <button
              type="button"
              role="option"
              aria-selected={i === selected}
              onMouseEnter={() => setSelected(i)}
              onMouseDown={(e) => { e.preventDefault(); command(item); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '7px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
                background: i === selected ? 'var(--koala-bg-secondary)' : 'transparent',
                color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flexShrink: 0, color: 'var(--koala-text-secondary)' }}>
                {item.icon}
              </span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{item.title}</span>
              <span style={{ fontSize: 12, color: 'var(--koala-text-tertiary)' }}>{item.hint}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
});

SlashCommandMenu.displayName = 'SlashCommandMenu';
export default SlashCommandMenu;
