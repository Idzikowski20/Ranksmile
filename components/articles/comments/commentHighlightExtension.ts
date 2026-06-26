// TipTap/ProseMirror extension that paints comment highlights as view-only
// inline decorations (NOT marks) — so they never mutate or get saved into the
// article content, and ProseMirror won't revert them the way it does external
// DOM edits. Quotes are matched within a single text node (same anchoring rule
// as the preview's DOM CommentsLayer), so behaviour stays consistent.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type CommentAnchor = { id: string; quote: string };

export const commentHighlightKey = new PluginKey('commentHighlight');

interface CommentHighlightOptions {
  getComments: () => CommentAnchor[];
  onCommentClick: (id: string) => void;
  /** Range being commented on right now (keeps the selection highlighted while composing). */
  getDraftRange: () => { from: number; to: number } | null;
}

export const CommentHighlight = Extension.create<CommentHighlightOptions>({
  name: 'commentHighlight',

  addOptions() {
    return { getComments: () => [], onCommentClick: () => {}, getDraftRange: () => null };
  },

  addProseMirrorPlugins() {
    const { options } = this;
    return [
      new Plugin({
        key: commentHighlightKey,
        props: {
          decorations(state) {
            const comments = options.getComments();
            if (!comments.length) return DecorationSet.empty;
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              const text = node.text;
              comments.forEach((c) => {
                if (!c.quote) return;
                let idx = text.indexOf(c.quote);
                while (idx !== -1) {
                  decos.push(Decoration.inline(pos + idx, pos + idx + c.quote.length, { class: 'comment-mark', 'data-comment-id': c.id }));
                  idx = text.indexOf(c.quote, idx + 1);
                }
              });
            });
            const draft = options.getDraftRange();
            if (draft && draft.to > draft.from) {
              decos.push(Decoration.inline(draft.from, draft.to, { class: 'comment-mark comment-mark-draft' }));
            }
            return DecorationSet.create(state.doc, decos);
          },
          handleClick(_view, _pos, event) {
            const el = (event.target as HTMLElement).closest?.('.comment-mark');
            if (el) { options.onCommentClick(el.getAttribute('data-comment-id') || ''); return true; }
            return false;
          },
        },
      }),
    ];
  },
});
