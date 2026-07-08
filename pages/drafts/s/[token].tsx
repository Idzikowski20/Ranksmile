import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import ContentScorePanel from '../../../components/articles/ContentScorePanel';
import CommentsLayer from '../../../components/articles/comments/CommentsLayer';
import PreviewNameGate from '../../../components/articles/comments/PreviewNameGate';
import EditorLoading from '../../../components/articles/EditorLoading';
import { ScoreData } from '../../../lib/contentScore';
import { AiVisibilitySummary } from '../../../lib/aiSearchScore';
import ViewerEditor, { ViewerEditorHandle } from '../../../components/articles/ViewerEditor';
import { useArticleChannel } from '../../../lib/ably/useArticleChannel';
import { ABLY_EVENTS } from '../../../lib/ably/channel';
import { ablyIgnore } from '../../../lib/ably/safe';

const F = 'var(--font-family-primary)';
const NAME_KEY = 'preview-author-name';

// Same panel icon as the editor toolbar.
const ICO_PANEL = 'M15 3V21M7.8 3H16.2C17.8802 3 18.7202 3 19.362 3.32698C19.9265 3.6146 20.3854 4.07354 20.673 4.63803C21 5.27976 21 6.11984 21 7.8V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3Z';

interface Article {
  id: number; title: string; content: string; target_keyword: string; status: string;
  meta_title: string; meta_description: string; score_data: string; content_score?: number;
  ai_visibility_summary?: AiVisibilitySummary | null;
  language?: string; created_at?: string; updated_at?: string;
}

const DEFAULT_SCORE: ScoreData = {
  terms: [], words_target: 2000, words_min: 1500, words_max: 2500,
  headings_target: 15, headings_min: 10, headings_max: 20,
};

const SharePreviewPage: NextPage = () => {
  const router = useRouter();
  const { token } = router.query;
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [nameChecked, setNameChecked] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ViewerEditorHandle>(null);
  const [caretBox, setCaretBox] = useState<{ left: number; top: number; height: number } | null>(null);
  const renderedRevRef = useRef(0);
  const pendingCaretRef = useRef<{ from: number; rev: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const editingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [relayoutEpoch, setRelayoutEpoch] = useState(0);

  const resyncFromShare = useCallback(() => {
    fetch(`/api/share/${token}`).then((r) => r.json())
      .then((j) => { if (j?.article?.content) { viewerRef.current?.setContent(j.article.content); setRelayoutEpoch((n) => n + 1); } })
      .catch(() => {});
  }, [token]);

  const drawCaret = useCallback((from: number) => {
    const box = viewerRef.current?.coordsAtPos(from);
    if (box) setCaretBox({ left: box.left, top: box.top, height: box.bottom - box.top });
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/share/${token}`)
      .then((r) => r.json())
      .then((d) => setArticle(d.article || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const scoreData: ScoreData = useMemo(() => {
    if (!article?.score_data) return DEFAULT_SCORE;
    try { return { ...DEFAULT_SCORE, ...JSON.parse(article.score_data) }; } catch { return DEFAULT_SCORE; }
  }, [article?.score_data]);

  const plain = (article?.content || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plain ? plain.split(/\s+/).length : 0;
  const headingCount = (article?.content.match(/<h[1-6][\s>]/gi) || []).length;

  // Read-only score-panel flag. Changing the article's status is an owner action
  // gated to the editor — the public reviewer preview has no "Mark as done" control.
  const done = article?.status === 'accepted';
  const shareLink = typeof window !== 'undefined' ? `${window.location.origin}/drafts/s/${token}` : '';

  // Anonymous reviewers must give a name before they can view/comment.
  useEffect(() => {
    try { const n = localStorage.getItem(NAME_KEY); if (n) setAuthorName(n); } catch { /* ignore */ }
    setNameChecked(true);
  }, []);
  const author = useMemo(() => ({ name: authorName || 'Guest', color: '#783AFB' }), [authorName]);

  // Live content + caret sync via Ably.
  // EventSource for comments-stream removed: comments now sync via Ably inside CommentsLayer (Task 6).
  const { channel: liveChannel, connectionState } = useArticleChannel({
    articleId: article?.id ?? null,
    shareToken: typeof token === 'string' ? token : null,
    clientId: authorName || null,
    onReconnect: resyncFromShare,
  });

  useEffect(() => {
    if (!liveChannel) return undefined;
    const onContent = (msg: { data?: { html?: string; tooLarge?: boolean; rev?: number } }) => {
      const d = msg.data || {};
      const rev = typeof d.rev === 'number' ? d.rev : renderedRevRef.current + 1;
      if (!d.tooLarge && rev <= renderedRevRef.current) return;
      if (d.tooLarge) { resyncFromShare(); }
      else if (typeof d.html === 'string') { viewerRef.current?.setContent(d.html); setRelayoutEpoch((n) => n + 1); }
      renderedRevRef.current = Math.max(renderedRevRef.current, rev);
      setIsEditing(true);
      if (editingTimer.current) clearTimeout(editingTimer.current);
      editingTimer.current = setTimeout(() => setIsEditing(false), 2000);
      const pc = pendingCaretRef.current;
      if (pc && pc.rev <= renderedRevRef.current) { pendingCaretRef.current = null; drawCaret(pc.from); }
    };
    const onCaret = (msg: { data?: { from?: number; rev?: number } }) => {
      const from = msg.data?.from;
      const rev = msg.data?.rev ?? 0;
      if (typeof from !== 'number') return;
      if (rev > renderedRevRef.current) { pendingCaretRef.current = { from, rev }; return; }
      drawCaret(from);
    };
    ablyIgnore(liveChannel.subscribe(ABLY_EVENTS.content, onContent));
    ablyIgnore(liveChannel.subscribe(ABLY_EVENTS.caret, onCaret));
    ablyIgnore(liveChannel.presence.enter({ name: authorName || 'Guest', role: 'viewer' }));
    return () => {
      liveChannel.unsubscribe(ABLY_EVENTS.content, onContent);
      liveChannel.unsubscribe(ABLY_EVENTS.caret, onCaret);
      ablyIgnore(liveChannel.presence.leave());
    };
  }, [liveChannel, resyncFromShare, drawCaret, authorName]);

  const [ownerLive, setOwnerLive] = useState(false);
  useEffect(() => {
    if (!liveChannel) return undefined;
    const refresh = () => ablyIgnore(
      liveChannel.presence.get()
        .then((members) => setOwnerLive(members.some((m) => (m.data as { role?: string } | undefined)?.role === 'owner'))),
    );
    ablyIgnore(liveChannel.presence.subscribe(['enter', 'leave', 'update'], refresh));
    refresh();
    return () => {
      liveChannel.presence.unsubscribe();
      ablyIgnore(liveChannel.presence.leave());
    };
  }, [liveChannel]);

  // Don't let a pending editing-indicator timeout fire after unmount.
  useEffect(() => () => { if (editingTimer.current) clearTimeout(editingTimer.current); }, []);

  useEffect(() => {
    if (!shareOpen) return undefined;
    const onDoc = (e: MouseEvent) => { if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [shareOpen]);

  // Reused in both the open toolbar and the collapsed bar (only one renders at a time).
  const shareControl = (
    <div ref={shareRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" onClick={() => setShareOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 14px', borderRadius: 6, border: 'none', background: shareOpen ? '#783afb' : '#18181b', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#783afb'; }} onMouseLeave={(e) => { e.currentTarget.style.background = shareOpen ? '#783afb' : '#18181b'; }}>
        Share
      </button>
      {shareOpen && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200, width: 360, maxWidth: 'calc(100vw - 24px)', background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0px 8px 24px rgba(24,26,34,0.16), 0px 2px 6px rgba(24,26,34,0.08)', animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)', fontFamily: F }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 16 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#18181B' }}>Share Content Editor</span>
            <button type="button" aria-label="Close" onClick={() => setShareOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#52525c', display: 'inline-flex', lineHeight: 1 }}>
              <svg viewBox="0 0 24 24" width={20} height={20}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div style={{ fontSize: 14, color: '#3f3f47', lineHeight: '20px', paddingBottom: 10 }}>Anyone with this link can <span style={{ fontWeight: 600, color: '#18181B' }}>view</span> and <span style={{ fontWeight: 600, color: '#18181B' }}>comment,</span> for an unlimited time</div>
          <div style={{ background: '#f8f8f9', padding: '9px 14px', borderRadius: 8 }}>
            <span style={{ display: 'block', fontSize: 14, color: '#52525c', textDecoration: 'underline', textUnderlineOffset: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareLink.replace(/^https?:\/\//, '')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 14 }}>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(shareLink).then(() => { setCopied(true); toast.success('Link copied'); setTimeout(() => setCopied(false), 1600); }); }}
              style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#fff', background: copied ? '#1ab25e' : '#18181b', fontFamily: F, transition: 'background 0.15s' }}>
              {copied ? 'Copied' : 'Copy comment link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#f4f4f5', fontFamily: F, display: 'flex', flexDirection: 'column' }}>
      <Head><title>{`${article?.meta_title || article?.title || 'Shared draft'} — Preview`}</title></Head>
      {connectionState && connectionState !== 'connected' && connectionState !== 'idle' && (
        <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 60, padding: '6px 12px', borderRadius: 8, background: '#1f2937', color: '#fff', fontSize: 13 }}>
          {connectionState === 'connecting' || connectionState === 'disconnected' ? 'Reconnecting…' : connectionState === 'suspended' ? 'Offline — retrying…' : 'Connecting…'}
        </div>
      )}
      <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 60, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.88)', border: '1px solid #e4e4e7', fontSize: 12, fontFamily: F, color: '#52525c', pointerEvents: 'none' }}>
        {ownerLive ? '🟢 editor live' : '⚫ editor away'}
      </div>
      {isEditing && (
        <div style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 60, padding: '4px 10px', borderRadius: 999, background: 'rgba(120,58,251,0.12)', color: '#783AFB', fontSize: 12 }}>✏️ editing…</div>
      )}
      {nameChecked && !authorName && (
        <PreviewNameGate onSubmit={(n) => { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } setAuthorName(n); }} />
      )}
      <style>{`
        .preview-prose h1 { font-size: 34px; font-weight: 700; line-height: 1.2; margin: 0 0 18px; color: #18181b; }
        .preview-prose h2 { font-size: 24px; font-weight: 700; line-height: 1.3; margin: 30px 0 12px; color: #18181b; }
        .preview-prose h3 { font-size: 19px; font-weight: 600; margin: 22px 0 8px; color: #18181b; }
        .preview-prose p { font-size: 16px; line-height: 1.7; margin: 0 0 16px; color: #27272a; }
        .preview-prose ul, .preview-prose ol { margin: 0 0 16px; padding-left: 22px; }
        .preview-prose li { font-size: 16px; line-height: 1.7; color: #27272a; margin-bottom: 4px; }
        .preview-prose img { max-width: 100%; height: auto; border-radius: 12px; margin: 8px 0; }
        .preview-prose a { color: #783afb; text-decoration: underline; }
        /* Read-only editing host: stops the native browser selection toolbar
           while keeping text selectable for comments. No caret, no edit outline. */
        .preview-prose[contenteditable] { outline: none; caret-color: transparent; -webkit-user-modify: read-only; }
        .preview-prose[contenteditable] *::selection { background: rgba(120,58,251,0.18); }
        @keyframes art-caret-blink { 50% { opacity: 0; } }
      `}</style>

      {/* Topbar removed — the article preview shows only the content + score panel. */}

      {loading ? (
        <EditorLoading />
      ) : !article ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9f9fa9' }}>Draft not found.</div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 4, padding: '0 8px 8px 8px', marginBottom: 8, position: 'relative' }}>
          {/* Content card */}
          <div className="styled-scrollbar" style={{ flex: 1, minWidth: 0, minHeight: 0, background: '#fff', borderRadius: 12, border: '1px solid #e4e4e7', overflow: 'auto' }}>
            <div ref={wrapperRef} style={{ position: 'relative', maxWidth: 820, margin: '0 auto', padding: '40px 64px 80px' }}>
              <div ref={contentRef} style={{ position: 'relative' }}>
                <ViewerEditor ref={viewerRef} initialHtml={article.content || ''} />
                {caretBox && (
                  <span aria-hidden style={{ position: 'fixed', left: caretBox.left, top: caretBox.top, height: caretBox.height, width: 2, background: '#783AFB', pointerEvents: 'none', animation: 'art-caret-blink 1s step-end infinite', zIndex: 50 }} />
                )}
              </div>
              <CommentsLayer
                containerRef={contentRef}
                wrapperRef={wrapperRef}
                articleId={String(article.id)}
                author={author}
                active
                reloadSignal={0}
                relayoutSignal={relayoutEpoch}
                shareUrl={shareLink}
                shareToken={typeof token === 'string' ? token : undefined}
              />
            </div>
          </div>

          {/* Right column: minimal toolbar + read-only score panel */}
          <AnimatePresence initial={false}>
          {!panelCollapsed && (
          <motion.div key="previewpanel"
            initial={{ width: 0, opacity: 0, x: 40 }} animate={{ width: 360, opacity: 1, x: 0 }} exit={{ width: 0, opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 380, damping: 40, mass: 0.9 }}
            style={{ flexShrink: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
            <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <button type="button" onClick={() => setPanelCollapsed(true)} title="Hide panel"
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#52525c' }}>
                <svg viewBox="0 0 24 24" width={20} height={20}><path fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d={ICO_PANEL} /></svg>
              </button>
              {shareControl}
            </div>
            <div style={{ flex: 1, minHeight: 0, width: 360, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, overflow: 'hidden' }}>
                <ContentScorePanel
                  plainText={plain}
                  wordCount={wordCount}
                  headingCount={headingCount}
                  scoreData={scoreData}
                  html={article.content}
                  keyword={article.target_keyword || ''}
                  articleId={article.id}
                  title={article.title}
                  metaTitle={article.meta_title}
                  metaDescription={article.meta_description}
                  fallbackScore={article.content_score}
                  aiVisibilitySummary={article.ai_visibility_summary}
                  isDone={done}
                  readOnly
                />
              </div>
            </div>
          </motion.div>
          )}
          </AnimatePresence>

          <AnimatePresence>
          {panelCollapsed && (
            <motion.div key="collapsedbar"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}
              style={{ position: 'absolute', top: 16, right: 16, zIndex: 50, display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* show panel */}
              <button type="button" onClick={() => setPanelCollapsed(false)} title="Show panel"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#52525c' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <svg viewBox="0 0 24 24" width={20} height={20}><path fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d={ICO_PANEL} /></svg>
              </button>
              {shareControl}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default SharePreviewPage;
