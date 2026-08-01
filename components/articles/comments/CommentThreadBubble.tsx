import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { commentsUrl } from './commentApi';

type Reactions = Record<string, string[]>;
type Burst = { id: string; emoji: string; x: number; y: number; parts: Array<{ dx: number; dy: number; dur: number; rot: number }> };

const F = 'var(--font-family-primary)';

export type CommentT = {
  id: string; parentId: string | null; quote: string; text: string; images: string[];
  author: string; color: string; avatar?: string; resolved: boolean; reactions?: Record<string, string[]>;
  createdAt: number; updatedAt: number | null; pending?: boolean;
};
export type Thread = CommentT & { replies: CommentT[]; pending?: boolean };

export type CommentAuthor = { name: string; color: string; avatar?: string };

const PALETTE = ['👍', '❤️', '🎉', '🚀', '😍', '😄'];

const initial = (n: string) => (n || 'U').trim().charAt(0).toUpperCase();

const relTime = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'Now';
  const m = Math.round(s / 60); if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24); if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Avatar = supplied image (e.g. Google/GSC photo), else the author's first initial on a colored disc. */
export const CommentAvatar = ({ name, color, src, size = 26 }: { name: string; color: string; src?: string; size?: number }) => {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img alt={name} src={src} referrerPolicy="no-referrer" onError={() => setBroken(true)}
      style={{ flexShrink: 0, width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />;
  }
  return (
    <span style={{ flexShrink: 0, width: size, height: size, borderRadius: '50%', background: color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size <= 22 ? 11 : 12, fontWeight: 700, fontFamily: F }}>
      {initial(name)}
    </span>
  );
};

const IcoDots = () => (<svg viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0m6 0a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0m6 0a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0" /></svg>);
const IcoCheck = () => (<svg viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75l6 6l9-13.5" /></svg>);
const IcoClose = () => (<svg viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>);
const IcoAddReaction = () => (<svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M8.5 10.5h.01M13.5 10.5h.01M8.5 14s1 1.2 2.5 1.2S13.5 14 13.5 14M18 5v4M20 7h-4" /></svg>);

interface Props {
  thread: Thread;
  author: CommentAuthor;
  articleId: string;
  onChanged: () => void;
  onClose: () => void;
  shareUrl?: string;
  /** Opaque share token for anonymous reviewers; omitted for authenticated owners. */
  shareToken?: string;
  style?: React.CSSProperties;
}

/** Figma-style dark bubble holding one comment thread: discussion + replies + reactions. */
const CommentThreadBubble = ({ thread, author, articleId, onChanged, onClose, shareUrl, shareToken, style }: Props) => {
  const [reply, setReply] = useState('');
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingReplies, setPendingReplies] = useState<CommentT[]>([]);
  // A pending reply is hidden only once its real counterpart appears in the thread
  // (match by author+text). Blanket-clearing on every `thread` change wiped the
  // "Sending…" state before it was visible (any SSE reload would clear it).
  const stillPending = pendingReplies.filter((p) => !thread.replies.some((r) => r.author === p.author && r.text === p.text));
  // Optimistically hide a reply the moment it's deleted (exit animation), then DELETE in the background.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const comments: CommentT[] = [thread, ...thread.replies, ...stillPending].filter((c) => !deletedIds.has(c.id));

  // Reactions store only names; map name → avatar from known participants so the
  // chips can show a tiny photo of who reacted (falls back to initials).
  const avatarByName: Record<string, string> = {};
  const colorByName: Record<string, string> = {};
  [thread, ...thread.replies].forEach((c) => { if (c.avatar) avatarByName[c.author] = c.avatar; colorByName[c.author] = c.color; });
  if (author.avatar) avatarByName[author.name] = author.avatar;
  colorByName[author.name] = author.color;

  // Tick so relative timestamps ("Now" → "1 minute ago") refresh live.
  const [, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(i); }, []);

  // Auto-scroll the discussion to the newest message when one is added, so the
  // sender immediately sees their message land at the bottom.
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(comments.length);
  useEffect(() => {
    if (comments.length > prevLenRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
    prevLenRef.current = comments.length;
  }, [comments.length]);
  // Prune optimistic replies that the server has now confirmed.
  useEffect(() => {
    setPendingReplies((prev) => prev.filter((p) => !thread.replies.some((r) => r.author === p.author && r.text === p.text)));
    // Drop deleted ids the server has already removed (keep in-flight ones).
    setDeletedIds((prev) => {
      const replyIds = new Set(thread.replies.map((r) => r.id));
      const next = new Set([...prev].filter((id) => replyIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [thread]);

  // Local reactions for instant (optimistic) feedback — reconciled from the
  // thread prop whenever the server data changes (SSE / refetch).
  const [reactions, setReactions] = useState<Record<string, Reactions>>({});
  const [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(() => {
    const m: Record<string, Reactions> = {};
    [thread, ...thread.replies].forEach((c) => { m[c.id] = c.reactions || {}; });
    setReactions(m);
  }, [thread]);

  const toggleReaction = (commentId: string, emoji: string, ev: React.MouseEvent) => {
    const cur = reactions[commentId] || {};
    const added = !(cur[emoji] || []).includes(author.name);
    setReactions((prev) => {
      const cc = { ...(prev[commentId] || {}) };
      const who = new Set(cc[emoji] || []);
      if (who.has(author.name)) who.delete(author.name); else who.add(author.name);
      if (who.size) cc[emoji] = [...who]; else delete cc[emoji];
      return { ...prev, [commentId]: cc };
    });
    // Discord-style floating burst on add.
    if (added) {
      const r = ev.currentTarget.getBoundingClientRect();
      const parts = Array.from({ length: 6 }, () => ({ dx: (Math.random() - 0.5) * 70, dy: -70 - Math.random() * 70, dur: 0.9 + Math.random() * 0.5, rot: (Math.random() - 0.5) * 50 }));
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setBursts((prev) => [...prev, { id, emoji, x: r.left + r.width / 2, y: r.top, parts }]);
      setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 1500);
    }
    // Persist in the background (SSE reconciles other clients).
    fetch(commentsUrl(articleId, shareToken), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commentId, reaction: { emoji, author: author.name } }) }).catch(() => {});
  };

  const api = (method: string, body: Record<string, unknown>) => {
    const url = method === 'DELETE'
      ? commentsUrl(articleId, shareToken, { commentId: String(body.commentId) })
      : commentsUrl(articleId, shareToken);
    return fetch(url, method === 'DELETE'
      ? { method }
      : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(() => onChanged()).catch(() => {});
  };

  const deleteComment = (id: string) => {
    setDeletedIds((prev) => new Set(prev).add(id));
    fetch(commentsUrl(articleId, shareToken, { commentId: id }), { method: 'DELETE' })
      .then(() => onChanged())
      .catch(() => setDeletedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }));
  };

  const sendReply = () => {
    const text = reply.trim();
    if (!text) return;
    setReply('');
    // Show the reply instantly with a "Sending…" state; persist in the background.
    const tmp = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setPendingReplies((prev) => [...prev, { id: tmp, parentId: thread.id, quote: '', text, images: [], author: author.name, color: author.color, avatar: author.avatar, resolved: false, reactions: {}, createdAt: Date.now(), updatedAt: null, pending: true }]);
    fetch(commentsUrl(articleId, shareToken), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parentId: thread.id, text, author: author.name, color: author.color, avatar: author.avatar || '' }) })
      .then(() => onChanged())
      .catch(() => setPendingReplies((prev) => prev.filter((p) => p.id !== tmp)));
  };

  const copyLink = () => {
    const base = shareUrl || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');
    try { navigator.clipboard?.writeText(`${base}#c-${thread.id}`); } catch { /* ignore */ }
    setMenuOpen(false);
  };

  return (
    <>
    <motion.div data-comment-bubble
      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 520, damping: 32, mass: 0.6 }}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      style={{ width: 320, maxWidth: '74vw', background: '#2b2b30', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.4)', overflow: 'hidden', fontFamily: F, ...style }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid #3a3a40' }}>
        <CommentAvatar name={thread.author} color={thread.color} src={thread.avatar} size={24} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.author}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" onClick={() => api('PATCH', { commentId: thread.id, resolved: !thread.resolved })} title={thread.resolved ? 'Reopen' : 'Resolve thread'}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: thread.resolved ? '#1AB25E' : '#a1a1aa', display: 'inline-flex', padding: 4 }}><IcoCheck /></button>
          <div style={{ position: 'relative' }} data-cmt-pop>
            <button type="button" onClick={() => setMenuOpen((v) => !v)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#a1a1aa', display: 'inline-flex', padding: 4 }}><IcoDots /></button>
            {menuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#1f1f23', borderRadius: 10, padding: 6, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 5 }}>
                <button type="button" onClick={copyLink} style={darkItem}>Copy thread URL</button>
                <button type="button" onClick={() => { setMenuOpen(false); api('DELETE', { commentId: thread.id }); onClose(); }} style={{ ...darkItem, color: '#ff6f77' }}>Delete thread</button>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} title="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#a1a1aa', display: 'inline-flex', padding: 4 }}><IcoClose /></button>
        </div>
      </div>

      {/* Discussion */}
      <div ref={scrollRef} className="styled-scrollbar-dark" style={{ maxHeight: 320, overflowY: 'auto', padding: '12px' }}>
        {thread.quote && (
          <div style={{ borderLeft: '2px solid #F84416', padding: '1px 0 1px 8px', margin: '0 0 12px', fontSize: 12, color: '#a1a1aa', fontStyle: 'italic', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{thread.quote}</div>
        )}
        <AnimatePresence initial={false}>
        {comments.map((c) => (
          <motion.div key={c.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: c.pending ? 0.65 : 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.2 }} style={{ marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CommentAvatar name={c.author} color={c.color} src={c.avatar} size={22} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.author}</span>
              {c.pending
                ? <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} style={{ fontSize: 11.5, color: '#8b8b92', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Sending…</motion.span>
                : <span style={{ fontSize: 11.5, color: '#8b8b92' }}>{relTime(c.createdAt)}</span>}
              {(!c.parentId || c.pending)
                ? null
                : <button type="button" onClick={() => deleteComment(c.id)} title="Delete reply" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#8b8b92', cursor: 'pointer', display: 'inline-flex', padding: 0 }}>
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                  </button>}
            </div>
            {c.text && <div style={{ marginLeft: 30, marginTop: 4, fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-line' }}>{c.text}</div>}
            {c.images?.length > 0 && (
              <div style={{ marginLeft: 30, marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {c.images.map((src, i) => <img key={i} alt="" src={src} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} />)}
              </div>
            )}
            {/* Reactions */}
            <div style={{ marginLeft: 30, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(reactions[c.id] || {}).map(([emoji, who]) => {
                const mine = who.includes(author.name);
                return (
                  <button key={emoji} type="button" onClick={(ev) => toggleReaction(c.id, emoji, ev)} title={who.join(', ')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 7px 0 6px', borderRadius: 12, cursor: 'pointer', fontSize: 12.5, color: '#fff', background: mine ? 'rgba(242,153,100,0.28)' : '#3a3a40', border: mine ? '1px solid #F84416' : '1px solid transparent' }}>
                    <span style={{ fontSize: 13 }}>{emoji}</span>
                    <span style={{ display: 'inline-flex' }}>
                      {who.slice(0, 3).map((name, i) => (
                        <span key={name} style={{ marginLeft: i === 0 ? 0 : -5, display: 'inline-flex', borderRadius: '50%', border: '1.5px solid #2b2b30' }}>
                          <CommentAvatar name={name} color={colorByName[name] || '#71717b'} src={avatarByName[name]} size={15} />
                        </span>
                      ))}
                    </span>
                    {who.length > 3 && <span style={{ fontWeight: 600 }}>+{who.length - 3}</span>}
                  </button>
                );
              })}
              <div style={{ position: 'relative' }} data-cmt-pop>
                <button type="button" onClick={() => setPickerFor(pickerFor === c.id ? null : c.id)} title="Add reaction"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 12, border: 'none', background: '#3a3a40', color: '#a1a1aa', cursor: 'pointer' }}><IcoAddReaction /></button>
                {pickerFor === c.id && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, display: 'flex', gap: 2, padding: 5, background: '#1f1f23', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 6 }}>
                    {PALETTE.map((e) => (
                      <button key={e} type="button" onClick={(ev) => { setPickerFor(null); toggleReaction(c.id, e, ev); }}
                        style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 17 }}
                        onMouseEnter={(mev) => { mev.currentTarget.style.background = '#3a3a40'; }} onMouseLeave={(mev) => { mev.currentTarget.style.background = 'transparent'; }}>{e}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
      </div>

      {/* Reply */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '10px 12px', borderTop: '1px solid #3a3a40' }}>
        <CommentAvatar name={author.name} color={author.color} src={author.avatar} size={24} />
        <textarea rows={1} placeholder="Reply" value={reply} className="styled-scrollbar-dark"
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
          style={{ flex: 1, boxSizing: 'border-box', minHeight: 36, maxHeight: 120, padding: '8px 10px', background: '#3a3a40', border: 'none', borderRadius: 8, resize: 'none', color: '#fff', fontSize: 13.5, fontFamily: F, outline: 'none', lineHeight: '20px' }} />
        <button type="button" onClick={sendReply} disabled={!reply.trim()} aria-label="Send reply"
          style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: reply.trim() ? 'pointer' : 'not-allowed', background: reply.trim() ? '#2f80ff' : '#4a4a52', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </div>
    </motion.div>

    {/* Discord-style floating reaction burst (portal → escapes the bubble clip) */}
    {typeof document !== 'undefined' && createPortal(
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
        <AnimatePresence>
          {bursts.map((b) => b.parts.map((p, i) => (
            <motion.span key={`${b.id}-${i}`}
              initial={{ opacity: 1, x: b.x, y: b.y, scale: 0.5, rotate: 0 }}
              animate={{ opacity: 0, x: b.x + p.dx, y: b.y + p.dy, scale: 1.25, rotate: p.rot }}
              exit={{ opacity: 0 }}
              transition={{ duration: p.dur, ease: 'easeOut' }}
              style={{ position: 'absolute', left: 0, top: 0, fontSize: 18, marginLeft: -9, marginTop: -9 }}>
              {b.emoji}
            </motion.span>
          )))}
        </AnimatePresence>
      </div>,
      document.body,
    )}
    </>
  );
};

const darkItem: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 7, fontSize: 13.5, color: '#e4e4e7', cursor: 'pointer', fontFamily: F };

export default CommentThreadBubble;
