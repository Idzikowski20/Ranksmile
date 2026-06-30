import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import SlashCommandMenu, { SlashItem, SlashMenuRef } from './SlashCommandMenu';

export type { SlashItem };

interface SlashOptions {
  items: (query: string) => SlashItem[];
}

/** Notion-style "/" command menu. Pass `items` (filtered by query) via configure(); each item's
 *  `command({ editor, range })` runs when picked. The popup is a React component positioned at the
 *  caret (no extra positioning dep). */
export const SlashCommand = Extension.create<SlashOptions>({
  name: 'slashCommand',

  addOptions() {
    return { items: () => [] };
  },

  addProseMirrorPlugins() {
    const getItems = this.options.items;
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }) => getItems(query),
        command: ({ editor, range, props }) => { props.command({ editor, range }); },
        render: () => {
          let component: ReactRenderer<SlashMenuRef> | null = null;
          let popup: HTMLDivElement | null = null;

          const place = (rect: DOMRect | null | undefined) => {
            if (!popup || !rect) return;
            const W = 256;
            const left = Math.min(rect.left, window.innerWidth - W - 12);
            // Flip above the caret if there isn't room below.
            const below = window.innerHeight - rect.bottom;
            if (below < 380) popup.style.top = `${Math.max(8, rect.top - 8)}px`, popup.style.transform = 'translateY(-100%)';
            else popup.style.top = `${rect.bottom + 6}px`, popup.style.transform = 'none';
            popup.style.left = `${Math.max(8, left)}px`;
          };

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandMenu, { props, editor: props.editor });
              popup = document.createElement('div');
              popup.style.position = 'fixed';
              popup.style.zIndex = '300';
              popup.appendChild(component.element);
              document.body.appendChild(popup);
              place(props.clientRect?.());
            },
            onUpdate: (props) => {
              component?.updateProps(props);
              place(props.clientRect?.());
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') return false;
              return component?.ref?.onKeyDown({ event: props.event }) ?? false;
            },
            onExit: () => {
              popup?.remove();
              popup = null;
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});

export default SlashCommand;
