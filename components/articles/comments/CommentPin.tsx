import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import CommentThreadBubble, { Thread, CommentAvatar, CommentAuthor } from './CommentThreadBubble';

const spring = { type: 'spring' as const, stiffness: 520, damping: 30, mass: 0.7 };

interface Props {
  thread: Thread;
  author: CommentAuthor;
  articleId: string;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
  onClose: () => void;
  shareUrl?: string;
  /** Opaque share token for anonymous reviewers; omitted for authenticated owners. */
  shareToken?: string;
  /** Positioning of the pin container within the comments wrapper. */
  style?: React.CSSProperties;
}

/** Unique participants of a thread (root author first, then reply authors). */
const participantsOf = (t: Thread): CommentAuthor[] => {
  const out: CommentAuthor[] = [];
  const seen = new Set<string>();
  [t, ...t.replies].forEach((c) => {
    if (seen.has(c.author)) return;
    seen.add(c.author);
    out.push({ name: c.author, color: c.color, avatar: c.avatar });
  });
  return out;
};

/** Animated margin pin: stacked participant avatars + thread bubble. Pops in on
 *  create, spins while saving (pending), shows an unread marker, animates out on delete. */
const CommentPin = ({ thread, author, articleId, open, onToggle, onChanged, onClose, shareUrl, shareToken, style }: Props) => {
  const people = participantsOf(thread);
  const others = people.slice(1, 3); // up to 2 peeking behind the front avatar
  const moreCount = Math.max(0, people.length - 1 - others.length);

  // Unread marker: messages added since this thread was last opened.
  const total = 1 + thread.replies.length;
  const SEEN_KEY = `cmts-seen-${articleId}`;
  const [seen, setSeen] = useState(total);
  useEffect(() => {
    try { const m = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); setSeen(m[thread.id] ?? 0); } catch { setSeen(0); }
  }, [SEEN_KEY, thread.id]);
  useEffect(() => {
    if (!open) return;
    setSeen(total);
    try { const m = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); m[thread.id] = total; localStorage.setItem(SEEN_KEY, JSON.stringify(m)); } catch { /* ignore */ }
  }, [open, total, SEEN_KEY, thread.id]);
  const unread = total > seen && !open;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.3 }}
      transition={spring}
      style={{ position: 'absolute', zIndex: open ? 55 : 40, ...style }}>
      <div style={{ position: 'relative', width: 30, height: 30, opacity: thread.resolved ? 0.45 : 1, filter: thread.resolved ? 'grayscale(0.7)' : 'none' }}>
        {/* Participants peeking behind the front avatar (overlap ~1/3). */}
        {others.map((p, i) => (
          <span key={`${p.name}-${i}`} style={{ position: 'absolute', top: 2, left: (i + 1) * 20, zIndex: -(i + 1) }}>
            <span style={{ display: 'inline-flex', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
              <CommentAvatar name={p.name} color={p.color} src={p.avatar} size={24} />
            </span>
          </span>
        ))}
        {moreCount > 0 && (
          <span style={{ position: 'absolute', top: 2, left: (others.length + 1) * 20, zIndex: -(others.length + 1), width: 26, height: 26, borderRadius: '50%', border: '2px solid #fff', background: '#52525c', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            +{moreCount}
          </span>
        )}

        {/* Front avatar = teardrop pin (clickable). */}
        <button type="button" data-comment-pin onClick={onToggle} title={thread.author}
          style={{ position: 'relative', zIndex: 1, width: 30, height: 30, borderRadius: '50% 50% 50% 3px', border: 'none', padding: 0, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', background: '#18181b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <CommentAvatar name={thread.author} color={thread.color} src={thread.avatar} size={24} />
        </button>

        {/* Saving spinner that traces the teardrop outline. */}
        {thread.pending && (
          <svg width={36} height={36} viewBox="0 0 36 36" aria-hidden="true"
            style={{ position: 'absolute', top: -3, left: -3, pointerEvents: 'none', overflow: 'visible', zIndex: 2 }}>
            <path d="M18 2 H18 A16 16 0 0 1 34 18 V18 A16 16 0 0 1 18 34 H5 A3 3 0 0 1 2 31 V18 A16 16 0 0 1 18 2 Z"
              fill="none" stroke="#F84416" strokeWidth={2.5} strokeLinecap="round"
              pathLength={100} strokeDasharray="28 72"
              style={{ animation: 'pinTeardropSpin 0.9s linear infinite' }} />
          </svg>
        )}

        {/* New-message marker. */}
        {unread && (
          <motion.span aria-hidden initial={{ scale: 0 }} animate={{ scale: 1 }}
            style={{ position: 'absolute', top: -4, right: -4, zIndex: 3, width: 12, height: 12, borderRadius: '50%', background: '#F84416', border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
        )}
      </div>

      <AnimatePresence>
        {open && (
          <CommentThreadBubble thread={thread} author={author} articleId={articleId} shareUrl={shareUrl} shareToken={shareToken}
            onChanged={onChanged} onClose={onClose}
            style={{ position: 'absolute', top: 0, right: 42, transformOrigin: 'top right' }} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CommentPin;
