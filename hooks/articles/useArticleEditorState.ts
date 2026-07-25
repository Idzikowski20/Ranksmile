import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NextRouter } from 'next/router';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../lib/errors';
import { authClient } from '../../lib/auth/client';
import { useArticleKeywords } from '../../services/articleKeywords';
import { countOccurrences, type ScoreData } from '../../lib/contentScore';
import { scoreArticleHtml } from '../../lib/scoreArticleHtml';
import type { AiVisibilitySummary } from '../../lib/aiSearchScore';
import type { CoverageItem } from '../../lib/aiCoverage';
import { throttle } from '../../lib/throttle';
import { useArticleChannel } from '../../lib/ably/useArticleChannel';
import { ABLY_EVENTS } from '../../lib/ably/channel';
import { ablyIgnore } from '../../lib/ably/safe';
import type { ArticleEditorHandle } from '../../lib/types/editor';
import type { Editor } from '@tiptap/core';
import { Thread, type CommentAuthor } from '../../components/articles/comments/CommentThreadBubble';
import type { HeadingItem } from '../../components/articles/ArticleEditor';

export interface Article {
  id: number;
  domain_id: number;
  title: string;
  content: string;
  status: string;
  target_keyword: string;
  meta_title: string;
  meta_description: string;
  meta_url: string;
  schema_json: string;
  score_data: string;
  content_score?: number;
  word_count: number;
  featured_image: string | null;
  publish_target: string | null;
  publish_url: string | null;
  competitor_outlines_cache: string | null;
  ai_visibility_summary?: AiVisibilitySummary | null;
  ai_info_to_cover?: string | null;
  internal_links_cache?: string | Record<string, unknown> | null;
  language?: string;
  created_at?: string;
  updated_at?: string;
  plagiarism_json?: string | null;
  ai_readability_json?: string | null;
  wizard_state?: string | null;
}

export interface DoSaveVersionMeta {
  changes: number;
  promptVersion: string;
  creditDeducted: boolean;
  runs?: number;
  lastContentScore?: number;
  lastSeo?: number;
  lastAi?: number;
}

export interface ContentOverride {
  html: string;
  text: string;
  words: number;
  headings: number;
  paragraphs: number;
}

export interface UseArticleEditorStateOptions {
  id: string | undefined;
  router: NextRouter;
  getIsAutoOptimizing: () => boolean;
  getAnalysisReloadKey: () => number;
  onArticleLoaded: (art: Article) => void;
  getCoverageItems: () => CoverageItem[];
}

export function useArticleEditorState({
  id,
  router,
  getIsAutoOptimizing,
  getAnalysisReloadKey,
  onArticleLoaded,
  getCoverageItems,
}: UseArticleEditorStateOptions) {
  const editorRef = useRef<ArticleEditorHandle | null>(null);
  const getEditor = (): Editor | null => editorRef.current?.getEditor() ?? null;
  const pixabayCallbackRef = useRef<((img: { url: string; alt: string }) => void) | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const lastSavedSig = useRef<string | null>(null);
  const lastVersionAt = useRef(0);
  const flushRef = useRef<((unload?: boolean) => void) | null>(null);
  const onArticleLoadedRef = useRef(onArticleLoaded);
  onArticleLoadedRef.current = onArticleLoaded;
  const prevArticleIdRef = useRef<string | undefined>();

  const [article, setArticle] = useState<Article | null>(null);
  const [highlightTerms, setHighlightTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [autoSaveState, setAutoSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [showPixabay, setShowPixabay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [showInternalLinksPanel, setShowInternalLinksPanel] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [ranksmileDockOpen, setRanksmileDockOpen] = useState(false);
  const [ranksmileDockEl, setRanksmileDockEl] = useState<HTMLElement | null>(null);
  const [showCustomization, setShowCustomization] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [actionsMenu, setActionsMenu] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentThreads, setCommentThreads] = useState<Thread[]>([]);
  const [commentsVersion, setCommentsVersion] = useState(0);

  const session = authClient.useSession?.();
  const [gscPicture, setGscPicture] = useState('');
  useEffect(() => {
    fetch('/api/gsc/accounts', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const a = d?.accounts?.[0]; if (a?.picture) setGscPicture(a.picture); })
      .catch(() => {});
  }, []);

  const commentAuthor: CommentAuthor = useMemo(() => ({
    name: session?.data?.user?.name || session?.data?.user?.email || 'You',
    color: '#F29964',
    avatar: gscPicture || undefined,
  }), [session?.data?.user?.name, session?.data?.user?.email, gscPicture]);

  const actionsRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const sharePopoverRef = useRef<HTMLDivElement>(null);
  const [domainBaseUrl, setDomainBaseUrl] = useState('');
  const [ranksmileAiActive, setRanksmileAiActive] = useState(false);
  const [linksAiActive, setLinksAiActive] = useState(false);
  const [articleKeywords, setArticleKeywords] = useState<string[]>([]);
  const [breadcrumbKeywords, setBreadcrumbKeywords] = useState<string[]>([]);

  const [editorHtml, setEditorHtml] = useState('');
  const [plainText, setPlainText] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [editorHeadings, setEditorHeadings] = useState<HeadingItem[]>([]);
  const [headingCount, setHeadingCount] = useState(0);
  const [paragraphCount, setParagraphCount] = useState(0);
  const [featuredImage, setFeaturedImage] = useState<{ url: string; alt: string } | null>(null);
  const [internalArticles, setInternalArticles] = useState<Array<{ id: number; title: string; url: string }>>([]);
  const [scoreData, setScoreData] = useState<ScoreData>({
    terms: [],
    words_target: 2000,
    words_min: 1500,
    words_max: 2500,
    headings_target: 15,
    headings_min: 10,
    headings_max: 20,
  });

  const { data: keywordRows } = useArticleKeywords(id);
  useEffect(() => {
    if (!keywordRows) return;
    setArticleKeywords(keywordRows.map((k) => k.keyword));
    setBreadcrumbKeywords(keywordRows.map((k) => k.keyword).filter(Boolean));
  }, [keywordRows]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/articles/${id}/comments`)
      .then((r) => r.json())
      .then((d) => setCommentThreads(d.threads || []))
      .catch(() => {});
  }, [id, commentsVersion]);

  const { channel: ownerChannel } = useArticleChannel({ articleId: article?.id ?? null });
  useEffect(() => {
    if (!ownerChannel) return undefined;
    const onComment = () => setCommentsVersion((v) => v + 1);
    ablyIgnore(ownerChannel.subscribe(ABLY_EVENTS.comment, onComment));
    ablyIgnore(ownerChannel.presence.enter({ role: 'owner' }));
    return () => {
      ownerChannel.unsubscribe(ABLY_EVENTS.comment, onComment);
      ablyIgnore(ownerChannel.presence.leave());
    };
  }, [ownerChannel]);

  const [reviewers, setReviewers] = useState<string[]>([]);
  useEffect(() => {
    if (!ownerChannel) return undefined;
    const refresh = () => ablyIgnore(
      ownerChannel.presence.get()
        .then((members) => setReviewers(members
          .filter((m) => (m.data as { role?: string } | undefined)?.role === 'viewer')
          .map((m) => ((m.data as { name?: string } | undefined)?.name) || 'Guest'))),
    );
    ablyIgnore(ownerChannel.presence.subscribe(['enter', 'leave', 'update'], refresh));
    refresh();
    return () => {
      ownerChannel.presence.unsubscribe();
      ablyIgnore(ownerChannel.presence.leave());
    };
  }, [ownerChannel]);

  const MAX_LIVE_HTML = 56 * 1024;
  const ownerChannelRef = useRef<typeof ownerChannel>(null);
  useEffect(() => { ownerChannelRef.current = ownerChannel; }, [ownerChannel]);
  const contentRevRef = useRef(0);

  const publishContentRef = useRef(
    throttle((html: string, rev: number) => {
      const ch = ownerChannelRef.current;
      if (!ch) return;
      if (html.length > MAX_LIVE_HTML) void ch.publish(ABLY_EVENTS.content, { tooLarge: true, rev });
      else void ch.publish(ABLY_EVENTS.content, { html, rev });
    }, 500),
  );

  const publishCaretRef = useRef(
    throttle((from: number, to: number, rev: number) => {
      const ch = ownerChannelRef.current;
      if (ch) void ch.publish(ABLY_EVENTS.caret, { from, to, rev });
    }, 75),
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const { onSelect } = (e as CustomEvent).detail as { onSelect: (img: { url: string; alt: string }) => void };
      pixabayCallbackRef.current = onSelect;
      setShowPixabay(true);
    };
    window.addEventListener('ranksmile:open-pixabay', handler);
    return () => window.removeEventListener('ranksmile:open-pixabay', handler);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('editor-route');
    return () => document.documentElement.classList.remove('editor-route');
  }, []);

  const analysisReloadKey = getAnalysisReloadKey();

  useEffect(() => {
    if (!id) return;
    const isNewArticle = prevArticleIdRef.current !== id;
    if (isNewArticle) {
      prevArticleIdRef.current = id;
      setIsLoading(true);
    }
    fetch(`/api/articles/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.article?.wizard_state && !(data.article.content || '').trim()) {
          try {
            const ws = JSON.parse(data.article.wizard_state);
            const step = ['content-type', 'context', 'writing-mode'].includes(ws.step) ? ws.step : 'content-type';
            router.replace(`/articles/${step}?articleId=${id}`);
            return;
          } catch { /* fall through */ }
        }
        if (data.article) {
          const art = data.article as Article;
          setArticle(art);
          const content = (art.content || '').replace(
            /<img([^>]*)\ssrc="([^"]+)"([^>]*)>/gi,
            (_: string, before: string, src: string, after: string) => {
              if (src.startsWith('/api/image-proxy')) return `<img${before} src="${src}"${after}>`;
              if (src.startsWith('http://') || src.startsWith('https://')) {
                return `<img${before} src="/api/image-proxy?url=${encodeURIComponent(src)}"${after}>`;
              }
              return '';
            },
          );
          setEditorHtml(content);
          if (art.featured_image) {
            setFeaturedImage({ url: art.featured_image, alt: art.title || '' });
          }
          if (art.score_data) {
            try { setScoreData(JSON.parse(art.score_data)); } catch { /* ignore */ }
          }
          onArticleLoadedRef.current(art);
          if (art.internal_links_cache) {
            try {
              const lsKey = `internal-links-${art.id}`;
              if (!localStorage.getItem(lsKey)) {
                localStorage.setItem(lsKey, typeof art.internal_links_cache === 'string'
                  ? art.internal_links_cache
                  : JSON.stringify(art.internal_links_cache));
              }
            } catch { /* ignore */ }
          }
          if (art.domain_id) {
            Promise.all([
              fetch('/api/domains').then((r) => r.json()),
              fetch(`/api/articles?domainId=${art.domain_id}`).then((r) => r.json()),
            ])
              .then(([dd, d]) => {
                const dom = (dd.domains || []).find((domItem: DomainType) => domItem.ID === art.domain_id);
                if (dom?.domain) setDomainBaseUrl(`https://${dom.domain}`);
                const others = (d.articles || [])
                  .filter((a: { id: number; status?: string }) => a.id !== art.id && a.status === 'published')
                  .map((a: { id: number; title: string; meta_url?: string | null }) => ({ id: a.id, title: a.title, url: a.meta_url || '' }));
                setInternalArticles(others);
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => toast.error('Failed to load article'))
      .finally(() => {
        if (isNewArticle) setIsLoading(false);
      });
  }, [id, analysisReloadKey, router]);

  useEffect(() => {
    if (!actionsMenu && !voiceOpen && !shareOpen) return undefined;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (voiceOpen && voiceRef.current && !voiceRef.current.contains(t)) setVoiceOpen(false);
      if (shareOpen && !shareRef.current?.contains(t) && !sharePopoverRef.current?.contains(t)) setShareOpen(false);
      if (actionsMenu && actionsRef.current && !actionsRef.current.contains(t)) { setActionsMenu(false); setVoiceOpen(false); }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [actionsMenu, voiceOpen, shareOpen]);

  const handleEditorChange = useCallback(
    (html: string, text: string, words: number, headings: number, paragraphs: number) => {
      setEditorHtml(html);
      setPlainText(text);
      setWordCount(words);
      setHeadingCount(headings);
      setParagraphCount(paragraphs);
      contentRevRef.current += 1;
      publishContentRef.current(html, contentRevRef.current);
    },
    [],
  );

  useEffect(() => {
    let ed: ReturnType<NonNullable<typeof editorRef.current>['getEditor']> | null = null;
    const onSel = () => {
      if (!ed) return;
      const { from, to } = ed.state.selection;
      publishCaretRef.current(from, to, contentRevRef.current);
    };
    const tryBind = () => {
      const e = editorRef.current?.getEditor?.();
      if (e && !ed) { ed = e; e.on('selectionUpdate', onSel); return true; }
      return false;
    };
    if (!tryBind()) {
      const iv = setInterval(() => { if (tryBind()) clearInterval(iv); }, 200);
      return () => { clearInterval(iv); if (ed) ed.off('selectionUpdate', onSel); };
    }
    return () => { if (ed) ed.off('selectionUpdate', onSel); };
  }, [article?.id]);

  const handleMetaTitleChange = useCallback((v: string) => {
    setArticle((prev) => prev ? { ...prev, meta_title: v } : prev);
  }, []);

  const handleMetaDescriptionChange = useCallback((v: string) => {
    setArticle((prev) => prev ? { ...prev, meta_description: v } : prev);
  }, []);

  const handleRestoreVersion = (version: { id: number; content: string; score_data: string | null }) => {
    const editor = editorRef.current?.getEditor();
    if (editor) editor.commands.setContent(version.content, { emitUpdate: true });
    if (version.score_data) {
      try {
        const sd = JSON.parse(version.score_data);
        setScoreData(sd);
        setArticle((prev) => prev ? { ...prev, score_data: version.score_data ?? prev.score_data } : prev);
      } catch { /* ignore */ }
    }
    setShowHistory(false);
    toast.success('Version restored');
  };

  const doSave = async (
    versionType?: string,
    opts?: { keepalive?: boolean },
    versionMeta?: DoSaveVersionMeta,
    contentOverride?: ContentOverride,
  ) => {
    if (!id) return false;
    const html = contentOverride?.html ?? editorHtml;
    const text = contentOverride?.text ?? plainText;
    const updatedTerms = scoreData.terms.map((t) => ({
      ...t,
      current_count: countOccurrences(text, t.term),
    }));
    const keyword = article?.target_keyword || '';
    const coverageItems = getCoverageItems();
    const scored = scoreArticleHtml({
      html,
      scoreData: { ...scoreData, terms: updatedTerms },
      keyword,
      coverageItems,
    });
    const updatedScoreData: ScoreData & {
      _heading_count?: number;
      _paragraph_count?: number;
      _computed_score?: number;
      _content_score?: number;
      _ao_meta?: DoSaveVersionMeta & { runs?: number };
    } = {
      ...scoreData,
      terms: updatedTerms,
      _heading_count: scored.headings,
      _paragraph_count: scored.paragraphs,
    };
    const contentScore = scored.seo;
    updatedScoreData._computed_score = contentScore;
    updatedScoreData._content_score = contentScore;
    if (scored.liveItems.length > 0 || scoreData.ai_score != null) {
      updatedScoreData.ai_score = scored.ai;
    }
    if (versionMeta) {
      const priorRuns = (scoreData as ScoreData & { _ao_meta?: { runs?: number } })._ao_meta?.runs ?? 0;
      updatedScoreData._ao_meta = {
        ...versionMeta,
        runs: priorRuns + 1,
        lastContentScore: versionMeta.lastContentScore ?? contentScore,
      };
    }

    let internalLinksCache: object | undefined;
    try {
      const raw = localStorage.getItem(`internal-links-${id}`);
      if (raw) internalLinksCache = JSON.parse(raw);
    } catch { /* ignore */ }

    const res = await fetch(`/api/articles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      ...(opts?.keepalive ? { keepalive: true } : {}),
      body: JSON.stringify({
        content: html,
        word_count: scored.words,
        score_data: updatedScoreData,
        featured_image: featuredImage?.url ?? null,
        target_keyword: article?.target_keyword,
        meta_title: article?.meta_title,
        meta_description: article?.meta_description,
        meta_url: article?.meta_url,
        ...(versionType ? { version_type: versionType } : {}),
        ...(internalLinksCache ? { internal_links_cache: internalLinksCache } : {}),
      }),
    });
    if (!res.ok) throw new Error('Save failed');
    return true;
  };

  const autoSave = async (sig: string, opts?: { unload?: boolean }) => {
    if (savingRef.current) return;
    savingRef.current = true;
    let ok = false;
    try {
      setAutoSaveState('saving');
      const wantVersion = Date.now() - lastVersionAt.current > 120000;
      await doSave(wantVersion ? 'manual_save' : undefined, { keepalive: opts?.unload });
      if (wantVersion) lastVersionAt.current = Date.now();
      lastSavedSig.current = sig;
      setAutoSaveState('saved');
      ok = true;
    } catch {
      setAutoSaveState('unsaved');
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => { void autoSave(sig); }, 3000);
    } finally {
      savingRef.current = false;
    }
    if (ok) flushRef.current?.();
  };

  useEffect(() => {
    if (isLoading || !article) return undefined;
    const sig = JSON.stringify({
      h: editorHtml,
      t: article.meta_title ?? '',
      d: article.meta_description ?? '',
      k: article.target_keyword ?? '',
      u: article.meta_url ?? '',
      img: featuredImage?.url ?? null,
    });
    if (lastSavedSig.current === null) { lastSavedSig.current = sig; return undefined; }
    if (sig === lastSavedSig.current || getIsAutoOptimizing()) return undefined;
    setAutoSaveState('unsaved');
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => { void autoSave(sig); }, 800);
    return () => { if (autoTimer.current) clearTimeout(autoTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorHtml, featuredImage, article?.meta_title, article?.meta_description, article?.target_keyword, article?.meta_url, isLoading, getIsAutoOptimizing()]);

  flushRef.current = (unload?: boolean) => {
    if (isLoading || !article || getIsAutoOptimizing()) return;
    const sig = JSON.stringify({
      h: editorHtml,
      t: article.meta_title ?? '',
      d: article.meta_description ?? '',
      k: article.target_keyword ?? '',
      u: article.meta_url ?? '',
      img: featuredImage?.url ?? null,
    });
    if (lastSavedSig.current === null || sig === lastSavedSig.current) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    void autoSave(sig, { unload });
  };

  useEffect(() => {
    const flushUnload = () => flushRef.current?.(true);
    const onVis = () => { if (document.visibilityState === 'hidden') flushUnload(); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); flushRef.current?.(); }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', flushUnload);
    window.addEventListener('keydown', onKey);
    router.events.on('routeChangeStart', flushUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', flushUnload);
      window.removeEventListener('keydown', onKey);
      router.events.off('routeChangeStart', flushUnload);
    };
  }, [router.events]);

  const handleAcceptReject = async (action: 'accept' | 'reject') => {
    if (!id) return;
    try {
      const res = await fetch('/api/articles/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setArticle((prev) => prev ? { ...prev, status: data.status } : prev);
      toast.success(action === 'accept' ? 'Article accepted' : 'Article rejected');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handlePixabaySelect = (image: { url: string; alt: string; width: number; height: number }) => {
    if (pixabayCallbackRef.current) {
      pixabayCallbackRef.current({ url: image.url, alt: image.alt });
      pixabayCallbackRef.current = null;
    } else {
      const editor = editorRef.current?.getEditor();
      if (!editor) return;
      editor.chain().focus().setImage({ src: image.url, alt: image.alt }).run();
    }
  };

  return {
    editorRef,
    getEditor,
    lastSavedSig,
    lastVersionAt,
    article,
    setArticle,
    highlightTerms,
    setHighlightTerms,
    isLoading,
    autoSaveState,
    setAutoSaveState,
    showPixabay,
    setShowPixabay,
    showSettings,
    setShowSettings,
    showAddDomain,
    setShowAddDomain,
    showInternalLinksPanel,
    setShowInternalLinksPanel,
    showHistory,
    setShowHistory,
    ranksmileDockOpen,
    setRanksmileDockOpen,
    ranksmileDockEl,
    setRanksmileDockEl,
    showCustomization,
    setShowCustomization,
    panelCollapsed,
    setPanelCollapsed,
    actionsMenu,
    setActionsMenu,
    voiceOpen,
    setVoiceOpen,
    shareOpen,
    setShareOpen,
    commentThreads,
    setCommentThreads,
    commentsVersion,
    setCommentsVersion,
    commentAuthor,
    actionsRef,
    voiceRef,
    shareRef,
    sharePopoverRef,
    domainBaseUrl,
    ranksmileAiActive,
    setRanksmileAiActive,
    linksAiActive,
    setLinksAiActive,
    articleKeywords,
    breadcrumbKeywords,
    editorHtml,
    setEditorHtml,
    plainText,
    wordCount,
    editorHeadings,
    setEditorHeadings,
    headingCount,
    paragraphCount,
    featuredImage,
    setFeaturedImage,
    internalArticles,
    scoreData,
    setScoreData,
    reviewers,
    handleEditorChange,
    handleMetaTitleChange,
    handleMetaDescriptionChange,
    handleRestoreVersion,
    doSave,
    handleAcceptReject,
    handlePixabaySelect,
  };
}
