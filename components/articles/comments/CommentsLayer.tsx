import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import CommentComposer, { DraftComment } from './CommentComposer';
import { Thread, CommentAuthor } from './CommentThreadBubble';
import CommentPin from './CommentPin';
import { commentsUrl } from './commentApi';
import { useArticleChannel } from '../../../lib/ably/useArticleChannel';
import { ABLY_EVENTS } from '../../../lib/ably/channel';
import { ablyIgnore } from '../../../lib/ably/safe';

const F = 'var(--font-family-primary)';

interface Props {
  containerRef: React.RefObject<HTMLElement>;
  wrapperRef: React.RefObject<HTMLElement>;
  articleId: string;
  author: CommentAuthor;
  /** Whether selecting text offers "Add comment". */
  active: boolean;
  /** Bump to refetch threads (SSE-driven live updates). */
  reloadSignal?: number;
  /** Base share URL for "Copy thread URL". */
  shareUrl?: string;
  /** Opaque share token for anonymous reviewers; omitted for authenticated owners. */
  shareToken?: string;
  /** Bump after each live content push to re-anchor comment highlights. */
  relayoutSignal?: number;
}

/** Wrap a live Range with a comment mark. */
const wrapRange = (range: Range, id: string): HTMLElement | null => {
  const span = document.createElement('span');
  span.className = 'comment-mark';
  span.setAttribute('data-comment-id', id);
  try { range.surroundContents(span); } catch {
    try { span.appendChild(range.extractContents()); range.insertNode(span); } catch { return null; }
  }
  return span;
};

/** Replace a span with its own children (remove the highlight, keep the text). */
const unwrap = (el: Element) => {
  const p = el.parentNode;
  if (!p) return;
  while (el.firstChild) p.insertBefore(el.firstChild, el);
  p.removeChild(el);
};

/** Re-anchor a stored comment by finding its quote text in a single text node. */
const anchorQuote = (container: HTMLElement, quote: string, id: string): HTMLElement | null => {
  if (!quote.trim()) return null;
  const existing = container.querySelector(`[data-comment-id="${id}"]`);
  if (existing) return existing as HTMLElement;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const idx = node.nodeValue ? node.nodeValue.indexOf(quote) : -1;
    if (idx >= 0 && !(node.parentElement && node.parentElement.closest('.comment-mark'))) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + quote.length);
      return wrapRange(range, id);
    }
    node = walker.nextNode() as Text | null;
  }
  return null;
};

const tempId = () => `tmp_${Math.random().toString(36).slice(2, 10)}`;

const CommentsLayer = ({ containerRef, wrapperRef, articleId, author, active, reloadSignal, shareUrl, shareToken, relayoutSignal }: Props) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [pill, setPill] = useState<{ top: number; left: number } | null>(null);
  const [composer, setComposer] = useState<{ top: number; quote: string } | null>(null);
  const [pins, setPins] = useState<Array<{ id: string; top: number }>>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const draftSpanRef = useRef<HTMLElement | null>(null);

  const reload = useCallback(() => {
    fetch(commentsUrl(articleId, shareToken)).then((r) => r.json())
      .then((d) => setThreads(d.threads || []))
      .catch(() => {})
      .finally(() => { loadedRef.current = true; });
  }, [articleId, shareToken]);
  useEffect(() => { reload(); }, [reload, reloadSignal]);

  // Live comment sync via Ably (replaces the in-process SSE, dead on serverless).
  const { channel: liveCommentChannel } = useArticleChannel({
    articleId: articleId ?? null,
    shareToken: shareToken ?? null,
    clientId: author?.name || null,
  });
  useEffect(() => {
    if (!liveCommentChannel) return undefined;
    const onComment = () => reload();
    ablyIgnore(liveCommentChannel.subscribe(ABLY_EVENTS.comment, onComment));
    return () => { liveCommentChannel.unsubscribe(ABLY_EVENTS.comment, onComment); };
  }, [liveCommentChannel, reload]);

  // (Re)apply highlights, drop orphaned ones, compute pin positions.
  const layout = useCallback(() => {
    const container = containerRef.current;
    const wrapper = wrapperRef.current;
    if (!container || !wrapper) return;
    const ids = new Set(threads.map((t) => t.id));
    threads.forEach((t) => anchorQuote(container, t.quote, t.id));
    // Remove highlights whose thread no longer exists (deleted) — keep the live draft.
    container.querySelectorAll('.comment-mark[data-comment-id]').forEach((el) => {
      const cid = el.getAttribute('data-comment-id') || '';
      if (cid !== 'draft' && !ids.has(cid)) unwrap(el);
    });
    const wRect = wrapper.getBoundingClientRect();
    const next: Array<{ id: string; top: number }> = [];
    threads.forEach((t) => {
      const el = container.querySelector(`[data-comment-id="${t.id}"]`) as HTMLElement | null;
      if (el) next.push({ id: t.id, top: el.getBoundingClientRect().top - wRect.top });
    });
    setPins(next);
  }, [threads, containerRef, wrapperRef]);

  useEffect(() => { if (loadedRef.current) layout(); }, [threads, layout]);
  useEffect(() => { if (loadedRef.current) layout(); }, [relayoutSignal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = () => layout();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true); };
  }, [layout]);

  // Open a thread by clicking its highlighted text.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const onClick = (e: MouseEvent) => {
      const mark = (e.target as HTMLElement).closest?.('.comment-mark');
      if (mark && mark.getAttribute('data-comment-id') !== 'draft') { e.stopPropagation(); setOpenId(mark.getAttribute('data-comment-id')); }
    };
    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [containerRef]);

  // Close the open bubble when clicking outside it.
  useEffect(() => {
    if (!openId) return undefined;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.('.comment-mark') || t.closest?.('[data-comment-bubble]') || t.closest?.('[data-comment-pin]') || t.closest?.('[data-cmt-pop]')) return;
      setOpenId(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openId]);

  // Selection → "Add comment" pill.
  useEffect(() => {
    if (!active) { setPill(null); return undefined; }
    const onUp = () => {
      if (draftSpanRef.current) return; // composing already
      const sel = window.getSelection();
      const container = containerRef.current;
      if (!sel || sel.isCollapsed || !container || !sel.toString().trim()) { setPill(null); return; }
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) { setPill(null); return; }
      const r = range.getBoundingClientRect();
      setPill({ top: r.top + window.scrollY - 44, left: r.left + window.scrollX + r.width / 2 });
    };
    document.addEventListener('mouseup', onUp);
    return () => document.removeEventListener('mouseup', onUp);
  }, [active, containerRef]);

  const startComment = () => {
    const sel = window.getSelection();
    const wrapper = wrapperRef.current;
    if (!sel || sel.isCollapsed || !wrapper) return;
    const quote = sel.toString().trim();
    const range = sel.getRangeAt(0).cloneRange();
    const top = range.getBoundingClientRect().top - wrapper.getBoundingClientRect().top;
    // Keep the selected text visibly highlighted while composing.
    const span = wrapRange(range, 'draft');
    if (span) { span.classList.add('is-draft'); draftSpanRef.current = span; }
    setComposer({ top, quote });
    setPill(null);
    sel.removeAllRanges();
  };

  const cancelComposer = () => {
    if (draftSpanRef.current) { unwrap(draftSpanRef.current); draftSpanRef.current = null; }
    setComposer(null);
  };

  const submitComment = async (draft: DraftComment) => {
    if (!composer) return;
    const quote = composer.quote;
    const span = draftSpanRef.current;
    draftSpanRef.current = null;
    setComposer(null);

    // Optimistic: turn the draft highlight into a pending pin immediately.
    const tmp = tempId();
    if (span) { span.setAttribute('data-comment-id', tmp); span.classList.remove('is-draft'); }
    setThreads((prev) => [...prev, { id: tmp, parentId: null, quote, text: draft.text, images: draft.images, author: author.name, color: author.color, avatar: author.avatar, resolved: false, reactions: {}, createdAt: Date.now(), updatedAt: null, replies: [], pending: true }]);
    setOpenId(tmp);

    try {
      const r = await fetch(commentsUrl(articleId, shareToken), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quote, text: draft.text, images: draft.images, author: author.name, color: author.color, avatar: author.avatar || '' }),
      });
      const d = await r.json();
      const c = d.comment;
      if (c) { if (span) span.setAttribute('data-comment-id', c.id); setOpenId(c.id); }
      reload();
    } catch {
      setThreads((prev) => prev.filter((t) => t.id !== tmp));
      if (span) unwrap(span);
      setOpenId(null);
    }
  };

  return (
    <>
      <style>{'.comment-mark{ text-decoration: underline; text-decoration-color: #F29964; text-decoration-thickness: 2px; text-underline-offset: 2px; background: rgba(242,153,100,0.08); cursor: pointer; } .comment-mark.is-draft{ background: rgba(242,153,100,0.22); cursor: default; }'}</style>

      {/* "Add comment" floating pill */}
      <AnimatePresence>
        {pill && (
          <motion.button type="button" onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); startComment(); }}
            initial={{ opacity: 0, y: 4, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.14 }}
            style={{ position: 'absolute', top: pill.top, left: pill.left, transform: 'translateX(-50%)', zIndex: 60, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: 'none', background: '#18181b', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.3)' }}>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            Add comment
          </motion.button>
        )}
      </AnimatePresence>

      {/* Right-margin avatar pins + thread bubbles */}
      <AnimatePresence>
        {pins.map(({ id, top }) => {
          const t = threads.find((x) => x.id === id);
          if (!t) return null;
          return (
            <CommentPin key={id} thread={t} author={author} articleId={articleId} shareUrl={shareUrl} shareToken={shareToken}
              open={openId === id}
              onToggle={() => setOpenId(openId === id ? null : id)}
              onChanged={reload}
              onClose={() => setOpenId(null)}
              style={{ top, right: -44 }} />
          );
        })}
      </AnimatePresence>

      {/* Composer for a new comment */}
      <AnimatePresence>
        {composer && (
          <motion.div data-comment-bubble
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 520, damping: 32, mass: 0.6 }}
            style={{ position: 'absolute', top: composer.top, right: 42, width: 320, maxWidth: '74vw', transformOrigin: 'top right', zIndex: 60 }}>
            <CommentComposer authorName={author.name} authorColor={author.color} authorAvatar={author.avatar} autoFocus onSubmit={submitComment} onCancel={cancelComposer} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CommentsLayer;
