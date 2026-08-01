import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const F = 'var(--font-family-primary)';

type Comment = { id: string; quote: string; text: string; images: string[]; author: string; color: string; createdAt: number };

const relTime = (t: number) => {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return new Date(t).toLocaleDateString();
};

/** Light-theme popover listing an article's shared comments (editor side). */
const CommentsPanel = ({ articleId, onCountChange, style, reloadSignal }: { articleId: string; onCountChange?: (n: number) => void; style?: React.CSSProperties; reloadSignal?: number }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch(`/api/articles/${articleId}/comments`).then((r) => r.json())
      .then((d) => { setComments(d.comments || []); onCountChange?.((d.comments || []).length); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, [articleId, reloadSignal]);

  const remove = (id: string) => {
    setComments((prev) => { const next = prev.filter((c) => c.id !== id); onCountChange?.(next.length); return next; });
    fetch(`/api/articles/${articleId}/comments?commentId=${id}`, { method: 'DELETE' }).catch(() => {});
  };

  return (
    <div onClick={(e) => e.stopPropagation()}
      style={{ background: '#fff', borderRadius: 12, width: 340, maxWidth: 'calc(100vw - 24px)', boxShadow: '0px 8px 24px rgba(24,26,34,0.16), 0px 2px 6px rgba(24,26,34,0.08)', animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)', fontFamily: F, overflow: 'hidden', ...style }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#18181b' }}>Comments</span>
        <span style={{ fontSize: 12, color: '#9f9fa9' }}>{comments.length}</span>
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto' }} className="styled-scrollbar">
        {loading ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9f9fa9', fontSize: 13 }}>Loading…</div>
        ) : comments.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: '#9f9fa9', fontSize: 13 }}>No comments yet. Reviewers can add comments from the shared link.</div>
        ) : (
          <AnimatePresence initial={false}>
            {comments.map((c) => (
              <motion.div key={c.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: c.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{c.author.charAt(0).toUpperCase()}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{c.author}</span>
                  <span style={{ fontSize: 12, color: '#9f9fa9' }}>{relTime(c.createdAt)}</span>
                  <button type="button" onClick={() => remove(c.id)} title="Delete" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#9f9fa9', cursor: 'pointer', display: 'inline-flex' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#e5484d'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#9f9fa9'; }}>
                    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                  </button>
                </div>
                {c.quote && (
                  <div style={{ borderLeft: '2px solid #F29964', padding: '2px 0 2px 8px', margin: '0 0 6px', fontSize: 12, color: '#71717b', fontStyle: 'italic', lineHeight: '17px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.quote}</div>
                )}
                {c.text && <div style={{ fontSize: 14, color: '#27272a', lineHeight: '19px', wordBreak: 'break-word' }}>{c.text}</div>}
                {c.images.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {c.images.map((src, i) => <img key={i} alt="" src={src} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }} />)}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default CommentsPanel;
