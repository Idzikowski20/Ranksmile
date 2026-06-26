import React, { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { AnimatePresence } from 'motion/react';
import { Thread, CommentAuthor } from './CommentThreadBubble';
import CommentPin from './CommentPin';

interface Props {
  editor: Editor;
  wrapperRef: React.RefObject<HTMLElement>;
  threads: Thread[];
  author: CommentAuthor;
  articleId: string;
  onChanged: () => void;
  openId: string | null;
  onOpenChange: (id: string | null) => void;
}

/**
 * Margin avatar-pins + thread bubbles over the TipTap editor. Anchors to the
 * comment decoration spans ([data-comment-id]) rendered by commentHighlightExtension,
 * so pins/bubbles scroll with the text instead of floating over the viewport.
 */
const EditorCommentsOverlay = ({ editor, wrapperRef, threads, author, articleId, onChanged, openId, onOpenChange }: Props) => {
  const [pins, setPins] = useState<{ left: number; items: Array<{ id: string; top: number }> }>({ left: 0, items: [] });

  const layout = useCallback(() => {
    const wrap = wrapperRef.current;
    if (!editor || !wrap) return;
    const dom = editor.view.dom as HTMLElement;
    const wRect = wrap.getBoundingClientRect();
    const colRect = dom.getBoundingClientRect();
    const left = colRect.right - wRect.left - 34; // sit in the column's right gutter
    const seen = new Set<string>();
    const items: Array<{ id: string; top: number }> = [];
    dom.querySelectorAll('[data-comment-id]').forEach((el) => {
      const id = el.getAttribute('data-comment-id');
      if (!id || seen.has(id)) return;
      seen.add(id);
      items.push({ id, top: (el as HTMLElement).getBoundingClientRect().top - wRect.top });
    });
    setPins({ left, items });
  }, [editor, wrapperRef]);

  useEffect(() => { layout(); }, [layout, threads]);
  useEffect(() => {
    if (!editor) return undefined;
    // rAF-batched re-measure. 'transaction' fires for EVERY transaction (incl. the
    // no-op tx that repaints comment decorations) — unlike 'update', which only
    // fires on docChanged. This is what makes an optimistic pin appear instantly.
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); };
    editor.on('transaction', on);
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => { cancelAnimationFrame(raf); editor.off('transaction', on); window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true); };
  }, [editor, layout]);

  // Close bubble on outside click.
  useEffect(() => {
    if (!openId) return undefined;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.('.comment-mark') || t.closest?.('[data-comment-bubble]') || t.closest?.('[data-comment-pin]') || t.closest?.('[data-cmt-pop]')) return;
      onOpenChange(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openId, onOpenChange]);

  return (
    <AnimatePresence>
      {pins.items.map(({ id, top }) => {
        const t = threads.find((x) => x.id === id);
        if (!t) return null;
        return (
          <CommentPin key={id} thread={t} author={author} articleId={articleId}
            open={openId === id}
            onToggle={() => onOpenChange(openId === id ? null : id)}
            onChanged={onChanged}
            onClose={() => onOpenChange(null)}
            style={{ top, left: pins.left }} />
        );
      })}
    </AnimatePresence>
  );
};

export default EditorCommentsOverlay;
