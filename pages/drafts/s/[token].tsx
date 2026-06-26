import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const F = 'var(--font-family-primary)';
const NAME_KEY = 'preview-author-name';

// The content is a read-only editing host (contentEditable) so the browser
// doesn't pop its native selection toolbar over our "Add comment" pill.
// Allow navigation + copy/select-all; block any keystroke that would mutate text.
const EDIT_SAFE_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Tab', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'];
const blockContentEdit = (e: React.KeyboardEvent) => {
  if (e.metaKey || e.ctrlKey) return; // let Ctrl/Cmd+C, Ctrl/Cmd+A through
  if (!EDIT_SAFE_KEYS.includes(e.key)) e.preventDefault();
};
// Same panel icon as the editor toolbar.
const ICO_PANEL = 'M15 3V21M7.8 3H16.2C17.8802 3 18.7202 3 19.362 3.32698C19.9265 3.6146 20.3854 4.07354 20.673 4.63803C21 5.27976 21 6.11984 21 7.8V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3Z';

interface Article {
  id: number; title: string; content: string; target_keyword: string; status: string;
  meta_title: string; meta_description: string; score_data: string; content_score?: number;
  ai_visibility_summary?: AiVisibilitySummary | null;
  language?: string; created_at?: string; updated_at?: string;
}

const BC_COUNTRY: Record<string, { name: string; cc: string }> = {
  pl: { name: 'Poland', cc: 'pl' }, en: { name: 'United States', cc: 'us' }, de: { name: 'Germany', cc: 'de' },
  fr: { name: 'France', cc: 'fr' }, es: { name: 'Spain', cc: 'es' }, it: { name: 'Italy', cc: 'it' },
  nl: { name: 'Netherlands', cc: 'nl' }, pt: { name: 'Portugal', cc: 'pt' },
};
const bcFmtDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', ' at');
};

const DEFAULT_SCORE: ScoreData = {
  terms: [], words_target: 2000, words_min: 1500, words_max: 2500,
  headings_target: 15, headings_min: 10, headings_max: 20,
};

const SharePreviewPage: NextPage = () => {
  const router = useRouter();
  const { token } = router.query;
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentsVersion, setCommentsVersion] = useState(0);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [nameChecked, setNameChecked] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  // Live comment sync over SSE — bump the version so the inline layer + panel refetch.
  useEffect(() => {
    if (!article?.id) return undefined;
    const tokenQs = typeof token === 'string' ? `?token=${encodeURIComponent(token)}` : '';
    const es = new EventSource(`/api/articles/${article.id}/comments-stream${tokenQs}`);
    es.onmessage = () => setCommentsVersion((v) => v + 1);
    es.onerror = () => { /* EventSource auto-reconnects */ };
    return () => es.close();
  }, [article?.id, token]);

  useEffect(() => {
    if (!shareOpen) return undefined;
    const onDoc = (e: MouseEvent) => { if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [shareOpen]);

  useEffect(() => {
    if (!infoOpen) return undefined;
    const onDoc = (e: MouseEvent) => { if (infoRef.current && !infoRef.current.contains(e.target as Node)) setInfoOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [infoOpen]);

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
      `}</style>

      {/* Surfer-style topbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', gap: 12, minHeight: 32, padding: '0.75rem 0.75rem 1rem 0.75rem', background: '#f8f8f9', borderBottom: '1px solid #ececef' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', marginRight: 12 }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: '#F97316', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>S</span>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#18181b', letterSpacing: '-0.01em' }}>SURFER</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#52525c', fontSize: 14, fontWeight: 600, minWidth: 0 }}>
          <span>Content Editor</span>
          <span style={{ color: '#9f9fa9' }}>/</span>
          <span style={{ color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{article?.target_keyword || article?.title || ''}</span>
          <div ref={infoRef} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
            <button type="button" aria-label="Article info" onClick={() => setInfoOpen((v) => !v)}
              style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: infoOpen ? '#18181b' : '#9f9fa9', display: 'inline-flex' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#18181b'; }} onMouseLeave={(e) => { e.currentTarget.style.color = infoOpen ? '#18181b' : '#9f9fa9'; }}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" /></svg>
            </button>
            {infoOpen && article && (() => {
              const loc = BC_COUNTRY[(article.language || 'pl').toLowerCase()] || BC_COUNTRY.en;
              const kw = article.target_keyword ? [article.target_keyword] : [];
              return (
                <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 200, width: 300, maxWidth: 'calc(100vw - 24px)', background: '#fff', borderRadius: 12, padding: '12px 16px', boxShadow: '0px 8px 24px rgba(24,26,34,0.16), 0px 2px 6px rgba(24,26,34,0.08)', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: F, fontWeight: 400, animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <span style={{ fontSize: 13, color: '#52525C' }}>Keywords{kw.length ? ` (${kw.length})` : ''}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B', wordBreak: 'break-word' }}>{kw.length ? kw.join(', ') : '—'}</span>
                    </div>
                    {kw.length > 0 && (
                      <button type="button" aria-label="Copy keywords" onClick={() => { navigator.clipboard?.writeText(kw.join(', ')); toast.success('Keywords copied'); }}
                        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: '#3F3F47', display: 'inline-flex', flexShrink: 0 }}>
                        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}><path d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6" /></svg>
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 13, color: '#52525C' }}>Location</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: '#18181B' }}>
                      <img alt="" width={18} height={13} style={{ borderRadius: 2 }} src={`https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/${loc.cc}.svg`} />
                      {loc.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 13, color: '#52525C' }}>Last Modified</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B' }}>{bcFmtDate(article.updated_at)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 13, color: '#52525C' }}>Created</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B' }}>{bcFmtDate(article.created_at)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {loading ? (
        <EditorLoading />
      ) : !article ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9f9fa9' }}>Draft not found.</div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 4, padding: '0 8px 8px 8px', marginBottom: 8, position: 'relative' }}>
          {/* Content card */}
          <div className="styled-scrollbar" style={{ flex: 1, minWidth: 0, minHeight: 0, background: '#fff', borderRadius: 12, border: '1px solid #e4e4e7', overflow: 'auto' }}>
            <div ref={wrapperRef} style={{ position: 'relative', maxWidth: 820, margin: '0 auto', padding: '40px 64px 80px' }}>
              <div
                ref={contentRef}
                className="preview-prose"
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                role="textbox"
                aria-readonly="true"
                onBeforeInput={(e) => e.preventDefault()}
                onPaste={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                onKeyDown={blockContentEdit}
                dangerouslySetInnerHTML={{ __html: article.content || '' }}
              />
              <CommentsLayer
                containerRef={contentRef}
                wrapperRef={wrapperRef}
                articleId={String(article.id)}
                author={author}
                active
                reloadSignal={commentsVersion}
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
