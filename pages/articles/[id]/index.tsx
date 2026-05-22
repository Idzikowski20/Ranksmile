import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import toast, { Toaster } from 'react-hot-toast';
import { CheckmarkCircle01Icon } from 'hugeicons-react';
import AppShell from '../../../components/common/AppShell';
import ContentScorePanel from '../../../components/articles/ContentScorePanel';
import ResearchOutlinePanel from '../../../components/articles/ResearchOutlinePanel';
import InternalLinksPanel from '../../../components/articles/InternalLinksPanel';
import KeywordSuggestInput from '../../../components/articles/KeywordSuggestInput';
import PixabayImageModal from '../../../components/articles/PixabayImageModal';
import VersionHistoryPanel from '../../../components/articles/VersionHistoryPanel';
import { useFetchDomains } from '../../../services/domains';
import { useFetchSettings } from '../../../services/settings';
import { ScoreData, countOccurrences, computeContentScore } from '../../../lib/contentScore';
import type { AiVisibilitySummary } from '../../../lib/aiSearchScore';
import dynamic from 'next/dynamic';

const ArticleEditor = dynamic(() => import('../../../components/articles/ArticleEditor'), { ssr: false });
import type { HeadingItem } from '../../../components/articles/ArticleEditor';

interface Article {
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
  word_count: number;
  featured_image: string | null;
  publish_target: string | null;
  publish_url: string | null;
  competitor_outlines_cache: string | null;
  ai_visibility_summary?: AiVisibilitySummary | null;
}

/* ── Icon button used in the top action bar ──────────────────────── */
const IconBtn = ({
  children, onClick, disabled, title, danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 32, height: 32, borderRadius: 8, border: 'none',
      background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      color: danger ? '#dc2626' : '#3f3f47',
      padding: 0, transition: 'color 0.15s, background 0.15s',
      fontFamily: 'var(--font-family-primary)',
    }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.color = danger ? '#b91c1c' : '#09090b'; }}
    onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.color = danger ? '#dc2626' : '#3f3f47'; }}
  >
    {children}
  </button>
);

const ArticleEditorPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { data: domainsData } = useFetchDomains(router);
  const { data: appSettingsData } = useFetchSettings();
  const appSettings: SettingsType = appSettingsData?.settings || {};
  const domains: DomainType[] = domainsData?.domains || [];

  const editorRef = useRef<any>(null);
  const pixabayCallbackRef = useRef<((img: { url: string; alt: string }) => void) | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPixabay, setShowPixabay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [showResearchPanel, setShowResearchPanel] = useState(false);
  const [showInternalLinksPanel, setShowInternalLinksPanel] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [domainBaseUrl, setDomainBaseUrl] = useState('');
  const [linkBar, setLinkBar] = useState<{ count: number; preLinkHtml: string; positions: number[] } | null>(null);
  const [linkNavIdx, setLinkNavIdx] = useState(0);
  const [autoOptimizeBar, setAutoOptimizeBar] = useState<{ preHtml: string } | null>(null);
  const [isAutoOptimizing, setIsAutoOptimizing] = useState(false);
  const [autoOptimizeStatus, setAutoOptimizeStatus] = useState('Optimizing article…');
  const [pendingImageCount, setPendingImageCount] = useState(0);
  const [surfyAiActive, setSurfyAiActive] = useState(false);
  const [researchAiActive, setResearchAiActive] = useState(false);
  const [linksAiActive, setLinksAiActive] = useState(false);
  const [aiVisibilitySummary, setAiVisibilitySummary] = useState<AiVisibilitySummary | null>(null);
  const [isRunningAiVisibility, setIsRunningAiVisibility] = useState(false);
  const [articleKeywords, setArticleKeywords] = useState<string[]>([]);
  const isAiActive = surfyAiActive || researchAiActive || linksAiActive || isAutoOptimizing || isRunningAiVisibility;

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

  // Fetch article keywords when internal links panel opens
  useEffect(() => {
    if (!showInternalLinksPanel || !id) return;
    fetch(`/api/articles/${id}/keywords`)
      .then(r => r.json())
      .then(d => setArticleKeywords((d.keywords || []).map((k: any) => k.keyword)))
      .catch(() => {});
  }, [showInternalLinksPanel, id]);

  // Listen for Pixabay open events dispatched from TipTap image node toolbar
  useEffect(() => {
    const handler = (e: Event) => {
      const { onSelect } = (e as CustomEvent).detail as { onSelect: (img: { url: string; alt: string }) => void };
      pixabayCallbackRef.current = onSelect;
      setShowPixabay(true);
    };
    window.addEventListener('surfer:open-pixabay', handler);
    return () => window.removeEventListener('surfer:open-pixabay', handler);
  }, []);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    fetch(`/api/articles/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.article) {
          const art = data.article;
          setArticle(art);
          // Rewrite image URLs so broken hotlinked images load via our server-side proxy.
          // Root-relative paths like /banner.png can't be fixed (domain unknown) — strip them.
          const content = (art.content || '').replace(
            /<img([^>]*)\ssrc="([^"]+)"([^>]*)>/gi,
            (_: string, before: string, src: string, after: string) => {
              if (src.startsWith('/api/image-proxy')) return `<img${before} src="${src}"${after}>`;
              if (src.startsWith('http://') || src.startsWith('https://')) {
                return `<img${before} src="/api/image-proxy?url=${encodeURIComponent(src)}"${after}>`;
              }
              // Root-relative or relative paths — can't proxy without original domain, remove tag
              return '';
            },
          );
          setEditorHtml(content);
          if (art.featured_image) {
            setFeaturedImage({ url: art.featured_image, alt: art.title || '' });
          }
          if (art.score_data) {
            try { setScoreData(JSON.parse(art.score_data)); } catch {}
          }
          if (art.ai_visibility_summary) {
            setAiVisibilitySummary(art.ai_visibility_summary);
          }
          // Restore internal links panel state from DB into localStorage (if localStorage is empty)
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
          // Fetch other articles in the same domain for internal linking
          if (art.domain_id) {
            // Also fetch domain to build full URLs
            fetch(`/api/domains`)
              .then((r) => r.json())
              .then((dd) => {
                const dom = (dd.domains || []).find((d: any) => d.ID === art.domain_id);
                if (dom?.domain) setDomainBaseUrl(`https://${dom.domain}`);
              })
              .catch(() => {});

            fetch(`/api/articles?domainId=${art.domain_id}`)
              .then((r) => r.json())
              .then((d) => {
                const others = (d.articles || [])
                  .filter((a: any) => a.id !== art.id && a.status === 'published')
                  .map((a: any) => ({ id: a.id, title: a.title, url: a.meta_url || '' }));
                setInternalArticles(others);
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => toast.error('Failed to load article'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleEditorChange = useCallback(
    (html: string, text: string, words: number, headings: number, paragraphs: number) => {
      setEditorHtml(html);
      setPlainText(text);
      setWordCount(words);
      setHeadingCount(headings);
      setParagraphCount(paragraphs);
    },
    [],
  );

  const handleMetaTitleChange = useCallback((v: string) => {
    setArticle((prev) => prev ? { ...prev, meta_title: v } : prev);
  }, []);

  const handleMetaDescriptionChange = useCallback((v: string) => {
    setArticle((prev) => prev ? { ...prev, meta_description: v } : prev);
  }, []);

  const handleRestoreVersion = (version: { id: number; content: string; score_data: string | null }) => {
    const editor = editorRef.current?.getEditor();
    if (editor) editor.commands.setContent(version.content);
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

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      // Update current_count for each term + store computed score so list view stays in sync
      const updatedTerms = scoreData.terms.map((t) => ({
        ...t,
        current_count: countOccurrences(plainText, t.term),
      }));
      const updatedScoreData: ScoreData & { _heading_count?: number; _paragraph_count?: number; _computed_score?: number } = {
        ...scoreData,
        terms: updatedTerms,
        _heading_count: headingCount,
        _paragraph_count: paragraphCount,
        _computed_score: computeContentScore(
          plainText, wordCount, headingCount,
          { ...scoreData, terms: updatedTerms },
          paragraphCount,
          (editorHtml.match(/<a\s[^>]*href=/gi) || []).length,
          editorHtml,
          article?.target_keyword || '',
        ),
      };

      // Persist internal links panel state from localStorage
      let internalLinksCache: object | undefined;
      try {
        const raw = localStorage.getItem(`internal-links-${id}`);
        if (raw) internalLinksCache = JSON.parse(raw);
      } catch { /* ignore */ }

      const res = await fetch(`/api/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editorHtml,
          word_count: wordCount,
          score_data: updatedScoreData,
          featured_image: featuredImage?.url ?? null,
          target_keyword: article?.target_keyword,
          meta_title: article?.meta_title,
          meta_description: article?.meta_description,
          meta_url: article?.meta_url,
          version_type: 'manual_save',
          ...(internalLinksCache ? { internal_links_cache: internalLinksCache } : {}),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Saved');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

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
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRunAiVisibility = async () => {
    if (!id) return;
    setIsRunningAiVisibility(true);
    try {
      const res = await fetch('/api/articles/ai-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI visibility check failed');
      setAiVisibilitySummary(data.summary);
      toast.success('AI Search checked');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsRunningAiVisibility(false);
    }
  };

  const handleInsertOutline = (headings: Array<{ level: number; text: string }>) => {
    const editor = editorRef.current?.getEditor();
    if (!editor) return;
    const html = headings
      .map((h) => `<h${Math.min(h.level, 4)}>${h.text}</h${Math.min(h.level, 4)}>`)
      .join('');
    editor.chain().focus().insertContent(html).run();
    setShowResearchPanel(false);
    toast.success('Outline inserted');
  };

  const handleInsertLinks = (links: Array<{ anchorText: string; url: string }>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = (editorRef.current as any)?.getEditor?.();
    if (!editor) return [];

    const preLinkHtml = editor.getHTML();
    const positions: number[] = [];

    // Build a flat text map: full concatenated text + offset→docPos mapping
    // This handles anchor text that spans ProseMirror node boundaries
    const buildTextMap = () => {
      let fullText = '';
      const segments: Array<{ textStart: number; docPos: number; len: number }> = [];
      editor.state.doc.descendants((node: any, pos: number) => {
        if (node.isText && node.text) {
          segments.push({ textStart: fullText.length, docPos: pos, len: node.text.length });
          fullText += node.text;
        }
      });
      return { fullText, segments };
    };

    const findInDoc = (anchorText: string): { from: number; to: number } | null => {
      const { fullText, segments } = buildTextMap();

      // Map a flat text-string offset back to a ProseMirror doc position
      const textToDoc = (textIdx: number): number => {
        for (const seg of segments) {
          if (seg.textStart <= textIdx && textIdx < seg.textStart + seg.len) {
            return seg.docPos + (textIdx - seg.textStart);
          }
        }
        return -1;
      };

      // 1) exact match
      let textIdx = fullText.indexOf(anchorText);
      if (textIdx !== -1) {
        const from = textToDoc(textIdx);
        if (from !== -1) return { from, to: from + anchorText.length };
      }

      // 2) case-insensitive
      textIdx = fullText.toLowerCase().indexOf(anchorText.toLowerCase());
      if (textIdx !== -1) {
        const from = textToDoc(textIdx);
        if (from !== -1) return { from, to: from + anchorText.length };
      }

      // 3) Normalise dashes, NBSP and multi-whitespace, lowercase — using a per-character
      //    parallel array so we can map normalised positions back to original offsets.
      //    Key difference from old code: NO .trim() per character (trim on single space -> "").
      const normCh = (ch: string) =>
        ch.replace(/[–—‐‑‒―]/g, '-')
          .replace(/[\s ]+/g, ' ')
          .toLowerCase();

      const buildNormMap = (src: string) => {
        const offsets: number[] = [];
        const buf: string[] = [];
        for (let i = 0; i < src.length; i++) {
          const n = normCh(src[i]);
          for (let j = 0; j < n.length; j++) {
            offsets.push(i);
            buf.push(n[j]);
          }
        }
        return { normStr: buf.join(''), offsets };
      };

      const { normStr: normFull, offsets: origOffsets } = buildNormMap(fullText);
      const normAnchor = normCh(anchorText).trim();

      const applyNormMatch = (nIdx: number, nLen: number): { from: number; to: number } | null => {
        if (nIdx === -1 || nIdx + nLen - 1 >= origOffsets.length) return null;
        const origStart = origOffsets[nIdx];
        const origEnd = origOffsets[nIdx + nLen - 1] + 1;
        const from = textToDoc(origStart);
        return from !== -1 ? { from, to: from + (origEnd - origStart) } : null;
      };

      // pass 3: full normalised anchor
      const p3 = applyNormMatch(normFull.indexOf(normAnchor), normAnchor.length);
      if (p3) return p3;

      // pass 4: longest contiguous word-window of anchor that appears in normFull
      //   try n-1 words from start, then n-1 words from end, then progressively shorter
      const words = normAnchor.split(/\s+/).filter(Boolean);
      if (words.length >= 3) {
        for (let size = words.length - 1; size >= Math.max(3, Math.ceil(words.length * 0.6)); size--) {
          for (let start = 0; start <= words.length - size; start++) {
            const sub = words.slice(start, start + size).join(' ');
            const subIdx = normFull.indexOf(sub);
            const r = applyNormMatch(subIdx, sub.length);
            if (r) return r;
          }
        }
      }

      return null;
    };

    // Deduplicate by URL — keep only the first suggestion per URL
    const seenUrls = new Set<string>();
    const dedupedLinks = links.filter(({ url }) => {
      if (seenUrls.has(url)) return false;
      seenUrls.add(url);
      return true;
    });

    const results = dedupedLinks.map(({ anchorText, url }) => {
      const href = url.startsWith('http') ? url : `${domainBaseUrl}/${url.replace(/^\//, '')}`;
      const range = findInDoc(anchorText);
      if (range) {
        // Skip headings — never insert links inside h1-h6
        const resolvedPos = editor.state.doc.resolve(range.from);
        if (resolvedPos.parent?.type?.name === 'heading') {
          return { url, anchorText, success: false as const };
        }
        editor.chain().setTextSelection(range).setLink({ href, target: '_blank' }).run();
        positions.push(range.from);
        return { url, anchorText, success: true as const };
      }
      return { url, anchorText, success: false as const };
    });

    const inserted = results.filter((r) => r.success).length;
    setLinkBar({ count: inserted, preLinkHtml, positions });
    setLinkNavIdx(0);
    return results;
  };

  // Generates images for placeholders inserted by auto-optimize, replacing them in the editor
  const generatePendingImages = async (
    pendingImages: Array<{ idx: number; prompt: string }>,
    keyword: string,
  ) => {
    if (!pendingImages.length) return;
    setPendingImageCount(pendingImages.length);

    // Process sequentially — Pollinations free tier allows only 1 concurrent request per IP
    for (const { idx, prompt } of pendingImages) {
      try {
        const res = await fetch('/api/articles/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword, title: prompt }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          setPendingImageCount((c) => Math.max(0, c - 1));
          continue;
        }

        // Get the LATEST editor HTML right before patching to avoid stale overwrites
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ed = (editorRef.current as any)?.getEditor?.();
        if (!ed) {
          setPendingImageCount((c) => Math.max(0, c - 1));
          continue;
        }
        const currentHtml = ed.getHTML();
        const marker = `__AIMG_${idx}__`;
        // Two-pass: first find the img tag by title marker (works regardless of attr order),
        // then replace only its src attribute.
        let replaced = false;
        const newHtml = currentHtml.replace(
          new RegExp(`<img\\b[^>]*\\btitle="${marker}"[^>]*>`, 'gi'),
          (fullMatch: string) => {
            replaced = true;
            return fullMatch.replace(/\bsrc="[^"]*"/i, `src="${data.url}"`);
          },
        );
        if (replaced) {
          ed.commands.setContent(newHtml, false);
        }
      } catch (e) {
        console.error(`[auto-optimize] image generation failed for idx ${idx}:`, e);
      } finally {
        setPendingImageCount((c) => Math.max(0, c - 1));
      }
    }
  };

  const handleAutoOptimize = async (fromHtml?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = (editorRef.current as any)?.getEditor?.();
    if (!editor) return;
    const preHtml = fromHtml ?? editor.getHTML();
    setIsAutoOptimizing(true);
    setAutoOptimizeStatus('Starting…');
    try {
      if (!fromHtml && id) {
        await fetch(`/api/articles/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: preHtml,
            word_count: wordCount,
            score_data: scoreData,
            version_type: 'pre_auto_optimize',
          }),
        }).catch(() => {});
      }
      const res = await fetch('/api/articles/auto-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: preHtml,
          scoreData,
          keyword: article?.target_keyword,
          articleId: article?.id,
          brandVoice: domains.find((d) => d.ID === article?.domain_id)?.brand_voice ?? '',
          aiVisibilitySummary,
        }),
      });
      if (!res.ok || !res.body) throw new Error('Auto-optimize request failed');

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        console.log('[auto-optimize] reader.read() done=', done, 'bytes=', value?.length ?? 0);
        if (done) {
          console.log('[auto-optimize] stream ended, total events processed:', eventCount, 'leftover buffer:', buffer.slice(0, 200));
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (separated by \n\n)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.trim()) continue;
          eventCount++;
          const eventLine = part.match(/^event: (\w+)/m);
          const dataLine = part.match(/^data: (.+)/ms); // added 's' flag so . matches newlines as fallback
          const eventType = eventLine?.[1] ?? 'message';
          console.log('[auto-optimize] SSE event:', eventType, 'dataLine present:', !!dataLine, 'part length:', part.length);
          if (!dataLine) continue;

          let payload: any;
          try { payload = JSON.parse(dataLine[1]); } catch (e) { console.error('[auto-optimize] JSON parse error for event', eventType, 'data preview:', dataLine[1].slice(0, 200), e); continue; }

          if (eventType === 'progress') {
            setAutoOptimizeStatus(payload.message ?? '');
          } else if (eventType === 'done') {
            console.log('[auto-optimize] done event received, content length:', payload.content?.length, 'pendingImages:', payload.pendingImages?.length ?? 0);
            // Set bar FIRST — before setContent which can throw
            setAutoOptimizeBar({ preHtml });
            setIsAutoOptimizing(false);
            try { editor.commands.setContent(payload.content); } catch (e) { console.error('[auto-optimize] setContent error:', e); }
            // Kick off background image generation for placeholders
            if (payload.pendingImages?.length && article?.target_keyword) {
              generatePendingImages(payload.pendingImages, article.target_keyword);
            }
            return;
          } else if (eventType === 'error') {
            throw new Error(payload.message || 'Auto-optimize failed');
          }
        }
      }
      console.log('[auto-optimize] loop exited without done event');
    } catch (err: any) {
      console.error('[auto-optimize] catch block:', err);
      toast.error(err.message);
    } finally {
      console.log('[auto-optimize] finally block, setting isAutoOptimizing=false');
      setIsAutoOptimizing(false);
    }
  };

  const handlePixabaySelect = (image: { url: string; alt: string; width: number; height: number }) => {
    // If opened from image node toolbar, update that node's src; otherwise insert at cursor
    if (pixabayCallbackRef.current) {
      pixabayCallbackRef.current({ url: image.url, alt: image.alt });
      pixabayCallbackRef.current = null;
    } else {
      const editor = editorRef.current?.getEditor();
      if (!editor) return;
      editor.chain().focus().setImage({ src: image.url, alt: image.alt }).run();
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8f8f9' }}>
        <p style={{ fontSize: 14, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>Loading article…</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8f8f9', gap: 16 }}>
        <p style={{ color: '#9f9fa9' }}>Article not found.</p>
        <Link href="/articles"><a style={{ color: 'var(--color-surface-raised)' }}>← Back to list</a></Link>
      </div>
    );
  }

  const PANEL_W = 320;
  const PANEL_GAP = 8; // gap-2xs = 0.25rem × 4 = ~8px in practice

  return (
    <AppShell
      domains={domains}
      showAddModal={() => setShowAddDomain(true)}
      showSettings={() => setShowSettings(true)}
      showSidebar={false}
      topbarTitle={article.target_keyword || article.title}
      contentClassName="article-editor-shell"
    >
      <style>{`
        @keyframes ai-glow-shift {
          0%   { box-shadow: inset 0 0 6px  4px rgba(120,58,251,0.5), inset 0 0 18px 10px rgba(120,58,251,0.3), inset 0 0 45px 20px rgba(120,58,251,0.15), inset 0 0 90px 10px rgba(120,58,251,0.06); }
          33%  { box-shadow: inset 0 0 6px  4px rgba(6,182,212,0.5),  inset 0 0 18px 10px rgba(6,182,212,0.3),  inset 0 0 45px 20px rgba(6,182,212,0.15),  inset 0 0 90px 10px rgba(6,182,212,0.06); }
          66%  { box-shadow: inset 0 0 6px  4px rgba(168,85,247,0.5), inset 0 0 18px 10px rgba(168,85,247,0.3), inset 0 0 45px 20px rgba(168,85,247,0.15), inset 0 0 90px 10px rgba(168,85,247,0.06); }
          100% { box-shadow: inset 0 0 6px  4px rgba(120,58,251,0.5), inset 0 0 18px 10px rgba(120,58,251,0.3), inset 0 0 45px 20px rgba(120,58,251,0.15), inset 0 0 90px 10px rgba(120,58,251,0.06); }
        }
        .ai-glow-ring {
          position: absolute; inset: 0; border-radius: 12px;
          pointer-events: none; z-index: 9999;
          opacity: 0; transition: opacity 0.4s ease;
        }
        .ai-glow-ring.active {
          opacity: 1;
          animation: ai-glow-shift 2.4s ease-in-out infinite;
        }
        @keyframes barPulse {
          0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
          50%       { transform: scaleY(1.4); opacity: 1; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Surfer-SEO-style image NodeView ──────────────────────── */
        [data-surfer-image] { margin: 0.5rem 0; }
        .surfer-image-group {
          display: flex; flex-direction: column; gap: 0.5rem;
          background: #fff; border-radius: 0.5rem; overflow: hidden;
          padding-bottom: 0.25rem;
          position: relative;
        }
        .ProseMirror-selectednode .surfer-image-group {
          outline: 2px solid #51A2FF; border-radius: 0.5rem;
        }
        .surfer-image-container {
          position: relative; overflow: hidden;
          transition: all 0.2s ease-in-out;
        }
        .group:hover .surfer-image-container { border-radius: 0; }
        .surfer-image-overlay {
          position: absolute; inset: 0; z-index: 4;
          background: #18181B; opacity: 0;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.1s ease-in-out;
          border-radius: 0;
        }
        .group:hover .surfer-image-overlay {
          opacity: 0.24;
          border-bottom-right-radius: 0.75rem;
          border-bottom-left-radius: 0.75rem;
        }
        .surfer-image-img {
          display: block; width: 100%; height: auto; min-height: 100px;
          max-width: 100%; object-fit: cover; aspect-ratio: 16 / 9;
          transition: border-radius 0.2s ease-in-out;
        }
        .group:hover .surfer-image-img {
          border-bottom-right-radius: 0.75rem;
          border-bottom-left-radius: 0.75rem;
        }
        .surfer-image-toolbar {
          position: absolute; bottom: 0; z-index: 5; width: 100%;
          overflow: hidden; max-height: 0;
          transition: max-height 0.1s ease-in-out;
        }
        .group:hover .surfer-image-toolbar { max-height: 300px; }
        .surfer-toolbar-inner {
          display: flex; flex-direction: column; gap: 1px;
          background: #fff; border-radius: 0.5rem;
        }
        .surfer-toolbar-prompt-row {
          display: flex; align-items: flex-end; justify-content: space-between;
          min-height: 48px; padding: 0.5rem 0.75rem;
          background: #F4F4F5; border-radius: 0.5rem 0.5rem 0 0;
        }
        .surfer-toolbar-prompt-icon {
          display: flex; align-items: flex-end; justify-content: center;
          width: 21px; height: 100%; padding-bottom: 0.375rem;
          color: #3F3F47; flex-shrink: 0;
        }
        .surfer-toolbar-prompt-input {
          flex: 1; min-height: 28px; border: none; background: transparent;
          padding: 0.25rem 0; font-size: 0.875rem; line-height: 1.25rem;
          color: #18181B; resize: none; outline: none;
          font-family: var(--font-family-primary);
          box-shadow: none;
        }
        .surfer-toolbar-prompt-input::placeholder { color: #52525C; }
        .surfer-toolbar-send-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 0.375rem; border: none; border-radius: 0.375rem;
          background: #F4F4F5; color: #18181B; cursor: pointer;
          flex-shrink: 0; transition: background 0.15s;
        }
        .surfer-toolbar-send-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .surfer-toolbar-send-btn:not(:disabled):hover { background: #E4E4E7; }
        .surfer-toolbar-actions-row {
          display: flex; align-items: center; gap: 0.5rem;
          height: 48px; padding: 0.5rem 0.75rem;
          background: #F8F8F9; border-radius: 0 0 0.5rem 0.5rem;
        }
        .surfer-toolbar-actions-left {
          display: flex; align-items: center; gap: 0.5rem; flex: 1;
        }
        .surfer-toolbar-actions-right {
          display: flex; align-items: center; gap: 0.125rem;
        }
        .surfer-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 0.25rem 0.75rem; border: none; border-radius: 0.375rem;
          font-size: 0.8125rem; line-height: 1rem; font-weight: 600;
          font-family: var(--font-family-primary); cursor: pointer;
          transition: background 0.15s; white-space: nowrap;
        }
        .surfer-btn-ghost {
          background: #F4F4F5; color: #18181B;
        }
        .surfer-btn-ghost:hover { background: #E4E4E7; }
        .surfer-btn-ghost:active { background: #D4D4D8; }
        .surfer-toolbar-drag-text {
          font-size: 0.875rem; line-height: 1.25rem; color: #3F3F47;
          overflow: hidden; white-space: nowrap;
        }
        .surfer-btn-delete {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 0.375rem; border: none; border-radius: 0;
          background: transparent; color: inherit; cursor: pointer;
          transition: opacity 0.15s;
        }
        .surfer-btn-delete:hover { opacity: 0.8; }
        .surfer-audio-bars { display: flex; gap: 0.125rem; }
        .surfer-audio-bar { width: 4px; height: 12px; background: #1AB25E; }
        /* ── Glow effect during AI image generation ─────────────── */
        @keyframes surferGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(99, 13, 227, 0.3), 0 0 35px rgba(99, 13, 227, 0.15), 0 0 60px rgba(99, 13, 227, 0.08); }
          50%      { box-shadow: 0 0 25px rgba(99, 13, 227, 0.5), 0 0 55px rgba(99, 13, 227, 0.3), 0 0 90px rgba(99, 13, 227, 0.15); }
        }
        .surfer-image-generating .surfer-image-group::before {
          content: '';
          position: absolute;
          inset: -8px;
          z-index: -1;
          pointer-events: none;
          border-radius: 0.625rem;
          animation: surferGlow 1.5s ease-in-out infinite;
        }
        .surfer-image-generating.surfer-image-group {
          overflow: visible;
        }
        .surfer-alt-row {
          display: flex; align-items: center; height: 20px;
          padding-right: 0.5rem; gap: 0;
        }
        .surfer-alt-input {
          flex: 1; border: none; outline: none; padding-right: 0.75rem;
          font-size: 0.875rem; line-height: 1.25rem; color: #3F3F47;
          background: transparent; font-family: var(--font-family-primary);
        }
        .surfer-alt-input::placeholder { color: #52525C; }
        .surfer-alt-input:disabled { background: #fff; }
        .surfer-alt-clear-btn {
          display: inline-flex; align-items: center; justify-content: center;
          border: none; border-radius: 0; background: transparent;
          padding: 0; font-size: 0.875rem; line-height: 1.25rem;
          color: #3F3F47; cursor: pointer; font-family: var(--font-family-primary);
          font-weight: 600; visibility: hidden; white-space: nowrap;
          transition: color 0.15s;
        }
        .group:hover .surfer-alt-clear-btn { visibility: visible; }
        .surfer-alt-clear-btn:hover { color: #2F2F34; }
        .surfer-alt-clear-btn:active { color: #09090B; }
      `}</style>

      {/* ── Gray zone (bg-gray-5 equivalent) ──────────────────────── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#f4f4f5',
          padding: 8,
          gap: 0,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 12,
        }}
      >

        <Head>
          <title>{article.title || 'Editor'} – SerpBear</title>
          {article.schema_json && (() => {
            try {
              const schema = JSON.parse(article.schema_json);
              return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema, null, 2) }} />;
            } catch { return null; }
          })()}
        </Head>

        {/* ── Main content row ─────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}>

          {/* ── Editor card (white rounded, padding-right for panel) ── */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e4e4e7',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              // Reserve space for the right panel so editor content is never hidden behind it
              marginRight: PANEL_W + PANEL_GAP,
            }}
          >
            <ArticleEditor
              editorRef={editorRef}
              content={article.content || ''}
              keyword={article.target_keyword}
              metaTitle={article.meta_title}
              metaDescription={article.meta_description}
              scoreData={scoreData}
              internalArticles={internalArticles}
              reviewMode={!!linkBar}
              onAiActivity={setSurfyAiActive}
              onChange={handleEditorChange}
              onMetaTitleChange={handleMetaTitleChange}
              onMetaDescriptionChange={handleMetaDescriptionChange}
              initialFeaturedImage={featuredImage}
              onFeaturedImageChange={setFeaturedImage}
              onHeadingsChange={setEditorHeadings}
            />
          </div>

          {/* ── Right panel (absolute, two cards stacked) ─────────── */}
          <div
            style={{
              position: 'absolute',
              top: 0, right: 0, bottom: 0,
              width: PANEL_W,
              display: 'flex',
              flexDirection: 'column',
              gap: PANEL_GAP,
              zIndex: 90,
            }}
          >
            {/* Top card: action icons + share */}
            <div
              style={{
                background: '#fff',
                border: '1px solid #e4e4e7',
                borderRadius: 12,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              {/* Left: action icon buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Save */}
                <IconBtn onClick={handleSave} disabled={isSaving} title={isSaving ? 'Saving…' : 'Save'}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4z" />
                    <path d="M17 21v-8H7v8M7 3v5h8" />
                  </svg>
                </IconBtn>

                {/* Accepted status icon */}
                {article.status === 'accepted' && (
                  <span
                    title="Accepted"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, color: '#16a34a', flexShrink: 0 }}
                  >
                    <svg viewBox="0 0 24 24" width={18} height={18}>
                      <path fill="currentColor" fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12m13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}

                {/* Accept */}
                {article.status !== 'published' && article.status !== 'accepted' && (
                  <IconBtn onClick={() => handleAcceptReject('accept')} title="Accept article">
                    <CheckmarkCircle01Icon size={18} />
                  </IconBtn>
                )}

{/* Version History */}
                <IconBtn onClick={() => { setShowResearchPanel(false); setShowInternalLinksPanel(false); setShowHistory((v) => !v); }} title="Version History">
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <path d="M22.7 13.5L20.7005 11.5L18.7 13.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.3019 3 18.1885 4.77814 19.7545 7.42909M12 7V12L15 14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </IconBtn>
              </div>

              {/* Right: Share button */}
              <button
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: '#18181b', color: '#fff',
                  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-family-primary)',
                  cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#2a2a2d'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#18181b'; }}
              >
                Share
              </button>
            </div>

            {/* Bottom card: keyword + content score OR research panel */}
            <div
              style={{
                background: showResearchPanel ? '#fff' : '#fff',
                border: showResearchPanel ? '1px solid #e4e4e7' : '1px solid #e4e4e7',
                borderRadius: 12,
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {showResearchPanel ? (
                <ResearchOutlinePanel
                  keyword={article.target_keyword || ''}
                  articleId={article.id}
                  language={article.target_keyword ? 'pl' : 'en'}
                  onClose={() => setShowResearchPanel(false)}
                  onInsertOutline={handleInsertOutline}
                  onAiActivity={setResearchAiActive}
                  currentHeadings={editorHeadings.map((h) => ({ level: h.level, text: h.text }))}
                  currentWordCount={wordCount}
                  paaQuestions={scoreData.paa_questions}
                />
              ) : showInternalLinksPanel ? (
                <InternalLinksPanel
                  articleId={article.id}
                  keyword={article.target_keyword || ''}
                  plainText={plainText}
                  domainBaseUrl={domainBaseUrl}
                  onClose={() => setShowInternalLinksPanel(false)}
                  onInsertLinks={handleInsertLinks}
                  onAiActivity={setLinksAiActive}
                  articleKeywords={articleKeywords}
                  internalArticles={internalArticles}
                />
              ) : showHistory ? (
                <VersionHistoryPanel
                  articleId={article.id}
                  currentWordCount={wordCount}
                  currentScore={(scoreData as any)._computed_score ?? 0}
                  onClose={() => setShowHistory(false)}
                  onRestore={handleRestoreVersion}
                />
              ) : (
                <>
                  {/* Target keyword (compact, pinned at top) */}
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid #f4f4f5', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9f9fa9', letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: 'var(--font-family-primary)', marginBottom: 5 }}>
                      Target Keyword
                    </div>
                    <KeywordSuggestInput
                      keywords={article.target_keyword ? [article.target_keyword] : []}
                      onAdd={(kw) => setArticle((prev) => prev ? { ...prev, target_keyword: kw } : prev)}
                      onRemove={() => setArticle((prev) => prev ? { ...prev, target_keyword: '' } : prev)}
                      placeholder="Set target keyword…"
                    />
                  </div>

                  {/* ContentScorePanel fills remaining height */}
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="styled-scrollbar">
                    <ContentScorePanel
                      plainText={plainText}
                      wordCount={wordCount}
                      headingCount={headingCount}
                      scoreData={scoreData}
                      internalLinksCount={(editorHtml.match(/<a\s[^>]*href=/gi) || []).length}
                      html={editorHtml}
                      keyword={article?.target_keyword || ''}
                      onResearchOutline={() => setShowResearchPanel(true)}
                      onInternalLinks={() => setShowInternalLinksPanel(true)}
                      onAutoOptimize={() => handleAutoOptimize()}
                      isAutoOptimizing={isAutoOptimizing}
                      aiVisibilitySummary={aiVisibilitySummary}
                      onRunAiVisibility={handleRunAiVisibility}
                      isRunningAiVisibility={isRunningAiVisibility}
                      articleId={article.id}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Auto-optimize loading indicator ──────────────────────── */}
        {isAutoOptimizing && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 500, width: 520, maxWidth: 'calc(100vw - 40px)',
            background: '#09090b', borderRadius: 10,
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, gap: 12,
          }}>
            <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#783afb', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            <span
              key={autoOptimizeStatus}
              style={{
                fontSize: 13, color: '#a1a1aa', fontFamily: 'var(--font-family-primary)',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                animation: 'fadeSlideIn 0.25s ease',
              }}
            >
              {autoOptimizeStatus}
            </span>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 3, borderRadius: 2, background: '#783afb', animation: `barPulse 1s ease-in-out ${i * 0.15}s infinite`, height: 14 }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Auto-optimize result bar ───────────────────────────────── */}
        {autoOptimizeBar && !isAutoOptimizing && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 500, minWidth: 560, maxWidth: 'calc(100vw - 40px)',
            background: '#09090b', borderRadius: 10,
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', padding: '0 10px 0 16px', height: 52, gap: 10,
            flexWrap: 'nowrap',
          }}>
            {/* Status badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#a1a1aa', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap' }}>
                Article optimized
              </span>
              {pendingImageCount > 0 && (
                <span style={{ fontSize: 12, color: '#71717a', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  · generating {pendingImageCount} image{pendingImageCount > 1 ? 's' : ''}…
                </span>
              )}
            </div>

            <div style={{ width: 1, height: 18, background: '#27272a', flexShrink: 0 }} />

            <div style={{ flex: 1 }} />

            {/* Retry */}
            <button
              type="button"
              onClick={() => {
                const preHtml = autoOptimizeBar.preHtml;
                setAutoOptimizeBar(null);
                const editor = (editorRef.current as any)?.getEditor?.();
                if (editor) editor.commands.setContent(preHtml);
                handleAutoOptimize(preHtml);
              }}
              style={{ fontSize: 13, fontWeight: 500, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '6px 10px', borderRadius: 6, transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; }}
            >
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
              Retry
            </button>

            {/* Discard */}
            <button
              type="button"
              onClick={() => {
                const editor = (editorRef.current as any)?.getEditor?.();
                if (editor) editor.commands.setContent(autoOptimizeBar.preHtml);
                setAutoOptimizeBar(null);
                setPendingImageCount(0);
              }}
              style={{ fontSize: 13, fontWeight: 500, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '6px 10px', borderRadius: 6, transition: 'color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; }}
            >
              Discard
            </button>

            {/* Accept */}
            <button
              type="button"
              onClick={() => { setAutoOptimizeBar(null); setPendingImageCount(0); }}
              style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#16a34a', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '7px 16px', transition: 'background 0.15s', flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#15803d'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#16a34a'; }}
            >
              Accept changes
            </button>
          </div>
        )}

        {/* ── Link review floating modal (Surfy-style) ─────────────── */}
        {linkBar && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 500, width: 560, maxWidth: 'calc(100vw - 40px)',
            background: '#09090b', borderRadius: 10,
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', padding: '0 10px 0 16px', height: 52, gap: 10,
          }}>
            {/* Link count badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#783afb', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#a1a1aa', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap' }}>
                {linkBar.count} link{linkBar.count !== 1 ? 's' : ''} inserted
              </span>
            </div>

            <div style={{ width: 1, height: 18, background: '#27272a', flexShrink: 0 }} />

            {/* Navigation ↑↓ */}
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              {[{ label: '↑', dir: -1 }, { label: '↓', dir: 1 }].map(({ label, dir }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    const positions = linkBar.positions;
                    if (!positions.length) return;
                    const next = Math.max(0, Math.min(positions.length - 1, linkNavIdx + dir));
                    setLinkNavIdx(next);
                    const editor = editorRef.current?.getEditor();
                    if (editor) {
                      editor.chain().focus().setTextSelection({ from: positions[next], to: positions[next] + 1 }).scrollIntoView().run();
                    }
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: 'none', background: '#1c1c1f', color: '#a1a1aa', cursor: 'pointer', fontSize: 13, transition: 'background 0.15s, color 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#27272a'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#1c1c1f'; e.currentTarget.style.color = '#a1a1aa'; }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            {/* Cancel */}
            <button
              type="button"
              onClick={() => {
                const editor = editorRef.current?.getEditor();
                if (editor) editor.commands.setContent(linkBar.preLinkHtml);
                setLinkBar(null);
              }}
              style={{ fontSize: 13, fontWeight: 500, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '6px 10px', borderRadius: 6, transition: 'color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; }}
            >
              Discard
            </button>

            {/* Accept */}
            <button
              type="button"
              onClick={() => setLinkBar(null)}
              style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#783afb', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '7px 16px', transition: 'background 0.15s', flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#6d28d9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#783afb'; }}
            >
              Accept links
            </button>
          </div>
        )}

        {/* Pixabay image search modal */}
        {showPixabay && (
          <PixabayImageModal
            defaultQuery={article?.target_keyword || ''}
            onSelect={handlePixabaySelect}
            onClose={() => setShowPixabay(false)}
          />
        )}

        <Toaster
          position="bottom-center"
          containerClassName="react_toaster"
          toastOptions={{
            style: {
              background: '#fff',
              color: '#111827',
              border: '1px solid #e4e4e7',
              fontSize: 13,
              fontFamily: 'var(--font-family-primary)',
            },
          }}
        />

        {/* ── AI glow overlay — last child so it renders above everything ── */}
        <div className={`ai-glow-ring${isAiActive ? ' active' : ''}`} />
      </div>
    </AppShell>
  );
};

export default ArticleEditorPage;
