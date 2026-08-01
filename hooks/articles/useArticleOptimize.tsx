import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { computeCoverageScores } from '../../lib/aiCoverage';
import { countOccurrences, type ScoreData, type NlpTerm } from '../../lib/contentScore';
import { scoreArticleHtml } from '../../lib/scoreArticleHtml';
import { computeOverallContentScore, type AiVisibilitySummary } from '../../lib/aiSearchScore';
import { computeOptimizeLiveSnapshot } from '../../lib/computeLiveArticleScores';
import type { CoverageItem, BucketScore, CoverageSnapshot } from '../../lib/aiCoverage';
import { getErrorMessage } from '../../lib/errors';
import { isAbortError } from '../../lib/abortSignal';
import { buildStreamingDoc } from '../../lib/optimizeReviewDoc';
import { substituteOptimizerPlaceholders } from '../../lib/optimizePostHtml';
import { splitSections } from '../../lib/articleSections';
import type { SectionEvent } from '../../lib/optimizeSectionEvents';
import { optimizeStore } from '../../components/articles/optimizeStore';
import { collectOptimizerPositions, type PMDocLike } from '../../lib/optimizeResolveAll';
import { prefersReducedMotion } from '../../lib/motion/gsap';
import type { Article, ContentOverride, DoSaveVersionMeta } from './useArticleEditorState';

function scrollToOptimizerSection(sectionId: string): void {
  document.querySelector(`[data-section-id="${sectionId}"]`)?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'center',
  });
}

export interface LiveRescoreState {
  liveItems: readonly CoverageItem[];
  aiNew: number;
  buckets: BucketScore[];
  remainingRows: Array<{ label: string; count: number }>;
}

export interface UseArticleOptimizeOptions {
  id: string | undefined;
  article: Article | null;
  getEditor: () => Editor | null;
  editorHtml: string;
  setEditorHtml: React.Dispatch<React.SetStateAction<string>>;
  wordCount: number;
  headingCount: number;
  scoreData: ScoreData;
  setScoreData: React.Dispatch<React.SetStateAction<ScoreData>>;
  domainBaseUrl: string;
  featuredImage: { url: string; alt: string } | null;
  coverageItems: CoverageItem[];
  coverageSnapshot: CoverageSnapshot | null;
  aiCoverageScore: number | null;
  aiVisibilitySummary: AiVisibilitySummary | null;
  doSave: (
    versionType?: string,
    opts?: { keepalive?: boolean },
    versionMeta?: DoSaveVersionMeta,
    contentOverride?: ContentOverride,
  ) => Promise<boolean>;
  setAutoSaveState: React.Dispatch<React.SetStateAction<'saved' | 'saving' | 'unsaved'>>;
  lastSavedSig: React.MutableRefObject<string | null>;
  lastVersionAt: React.MutableRefObject<number>;
}

export function useArticleOptimize({
  id,
  article,
  getEditor,
  editorHtml,
  setEditorHtml,
  wordCount,
  headingCount,
  scoreData,
  setScoreData,
  domainBaseUrl,
  featuredImage,
  coverageItems,
  coverageSnapshot,
  aiCoverageScore,
  aiVisibilitySummary,
  doSave,
  setAutoSaveState,
  lastSavedSig,
  lastVersionAt,
}: UseArticleOptimizeOptions) {
  const [linkBar, setLinkBar] = useState<{ count: number; preLinkHtml: string; positions: number[] } | null>(null);
  const [linkNavIdx, setLinkNavIdx] = useState(0);
  const [isApplyingReadability, setIsApplyingReadability] = useState(false);
  const [readabilityBar, setReadabilityBar] = useState<{ preHtml: string } | null>(null);
  const [readabilityAcceptKey, setReadabilityAcceptKey] = useState(0);
  const [compareVersions, setCompareVersions] = useState<{ original: string; updated: string } | null>(null);
  const [isAutoOptimizing, setIsAutoOptimizing] = useState(false);
  const [autoOptimizeStatus, setAutoOptimizeStatus] = useState('Optimizing article…');
  const [optimizeState, setOptimizeState] = useState<'idle' | 'optimizing' | 'reviewing'>('idle');
  const preReviewHtmlRef = useRef<string>('');
  const optimizeMetaRef = useRef<{
    changedCount: number;
    creditDeducted: boolean;
    promptVersion: string;
    phase?: string;
    rounds?: number;
    lastSeo?: number;
    lastAi?: number;
    lastContent?: number;
  }>({ changedCount: 0, creditDeducted: false, promptVersion: '' });
  const preScoreRef = useRef<number>(0);
  const preContentScoreRef = useRef<number>(0);
  const changedSectionsRef = useRef<Array<{ sectionId: string; headingText: string; oldHtml: string; newHtml: string }>>([]);
  const [optimizeProgress, setOptimizeProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const [optimizeRemaining, setOptimizeRemaining] = useState(0);
  const [optimizeDocTick, setOptimizeDocTick] = useState(0);
  const [optimizeSaving, setOptimizeSaving] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [savedBannerOpen, setSavedBannerOpen] = useState(false);
  const [aoFloat, setAoFloat] = useState<{ key: number; label: string } | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const aiVisibilityBaselineRef = useRef<number>(0);
  const prevAiRef = useRef<number>(0);
  const floatSeqRef = useRef<number>(0);
  const attributionBeforeRef = useRef<BucketScore[]>([]);

  const aoLiveSnapshot = useMemo(() => {
    if (optimizeState === 'idle' || !scoreData) return null;
    return computeOptimizeLiveSnapshot({
      editorHtml,
      scoreData,
      keyword: article?.target_keyword || '',
      coverageItems,
      coverageSnapshot,
      aiVisibilitySummary,
      substitutePlaceholders: substituteOptimizerPlaceholders,
    });
  }, [optimizeState, editorHtml, scoreData, article?.target_keyword, coverageItems, coverageSnapshot, aiVisibilitySummary, optimizeDocTick]);

  const aoScoresReady = optimizeState === 'reviewing'
    || (optimizeState === 'optimizing' && editorHtml !== preReviewHtmlRef.current && optimizeProgress.processed > 0);

  const liveRescore: LiveRescoreState | null = aoScoresReady && aoLiveSnapshot ? {
    liveItems: aoLiveSnapshot.liveItems,
    aiNew: aoLiveSnapshot.ai,
    buckets: aoLiveSnapshot.buckets,
    remainingRows: aoLiveSnapshot.remainingRows,
  } : null;

  const remainingRows = aoScoresReady && aoLiveSnapshot ? aoLiveSnapshot.remainingRows : [];

  useEffect(() => {
    if (!aoScoresReady || !aoLiveSnapshot) return undefined;
    const tickDelta = Math.round(aoLiveSnapshot.ai) - Math.round(prevAiRef.current);
    prevAiRef.current = aoLiveSnapshot.ai;
    if (tickDelta > 0) {
      floatSeqRef.current += 1;
      setAoFloat({ key: floatSeqRef.current, label: `Optimization Impact +${tickDelta}` });
    }
    return undefined;
  }, [aoLiveSnapshot, aoScoresReady]);

  const optimizeReview = aoScoresReady && aoLiveSnapshot ? {
    postScore: aoLiveSnapshot.seo,
    seoDelta: Math.round(aoLiveSnapshot.seo) - Math.round(preScoreRef.current),
    postHtml: aoLiveSnapshot.postHtml,
    postText: aoLiveSnapshot.postText,
  } : null;

  const handleApplyReadability = async (result: { criteria?: Array<{ suggestions?: string[] }> }) => {
    const editor = getEditor();
    if (!editor || !id || isApplyingReadability) return;
    const suggestions = (result?.criteria || []).flatMap((c) => c.suggestions || []).filter(Boolean);
    if (!suggestions.length) return;
    const preHtml = editor.getHTML();
    setIsApplyingReadability(true);
    try {
      const res = await fetch('/api/articles/apply-readability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id, content: preHtml, suggestions }),
      });
      const data = await res.json();
      if (!res.ok || !data?.content) throw new Error(data?.error || 'Could not apply suggestions');
      if (data.warning) { toast(data.warning, { icon: '⚠️' }); return; }
      try { editor.commands.setContent(data.content); } catch { /* noop */ }
      setReadabilityBar({ preHtml });
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Could not apply suggestions');
    } finally {
      setIsApplyingReadability(false);
    }
  };

  const openCompareVersions = (preHtml: string) => {
    const editor = getEditor();
    setCompareVersions({ original: preHtml, updated: editor ? editor.getHTML() : '' });
  };

  const compareVersionsButton = (preHtml: string) => (
    <button
      type="button"
      onClick={() => openCompareVersions(preHtml)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#fff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '6px 8px', borderRadius: 6, transition: 'color 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#fff'; }}
    >
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9" /></svg>
      Compare versions
    </button>
  );

  const handleInsertLinks = (links: Array<{ anchorText: string; url: string }>) => {
    const editor = getEditor();
    if (!editor) return [];

    const preLinkHtml = editor.getHTML();
    const positions: number[] = [];

    const buildTextMap = () => {
      let fullText = '';
      const segments: Array<{ textStart: number; docPos: number; len: number }> = [];
      editor.state.doc.descendants((node: PMNode, pos: number) => {
        if (node.isText && node.text) {
          segments.push({ textStart: fullText.length, docPos: pos, len: node.text.length });
          fullText += node.text;
        }
      });
      return { fullText, segments };
    };

    const findInDoc = (anchorText: string): { from: number; to: number } | null => {
      const { fullText, segments } = buildTextMap();

      const textToDoc = (textIdx: number): number => {
        for (const seg of segments) {
          if (seg.textStart <= textIdx && textIdx < seg.textStart + seg.len) {
            return seg.docPos + (textIdx - seg.textStart);
          }
        }
        return -1;
      };

      let textIdx = fullText.indexOf(anchorText);
      if (textIdx !== -1) {
        const from = textToDoc(textIdx);
        if (from !== -1) return { from, to: from + anchorText.length };
      }

      textIdx = fullText.toLowerCase().indexOf(anchorText.toLowerCase());
      if (textIdx !== -1) {
        const from = textToDoc(textIdx);
        if (from !== -1) return { from, to: from + anchorText.length };
      }

      const normCh = (ch: string) =>
        ch.replace(/[–—‐‑‒―]/g, '-')
          .replace(/[\s ]+/g, ' ')
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

      const p3 = applyNormMatch(normFull.indexOf(normAnchor), normAnchor.length);
      if (p3) return p3;

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
        const resolvedPos = editor.state.doc.resolve(range.from);
        if (resolvedPos.parent?.type?.name === 'heading') {
          return { url, anchorText, success: false as const };
        }
        const linkAttrs = { href, target: '_blank', 'data-ranksmile-link': 'true' };
        editor.chain().setTextSelection(range).setLink(linkAttrs).run();
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

  const handleAutoOptimizeSections = async () => {
    const editor = getEditor();
    if (!editor) return;
    const preHtml: string = editor.getHTML();
    preReviewHtmlRef.current = preHtml;
    const keyword = article?.target_keyword || '';
    const preScored = scoreData
      ? scoreArticleHtml({
        html: preHtml,
        scoreData,
        keyword,
        coverageItems,
        answersMainQuestionEarly: coverageSnapshot?.answersMainQuestionEarly,
      })
      : null;
    preScoreRef.current = preScored?.seo ?? 0;
    const preAiBase = preScored?.ai ?? aiCoverageScore ?? scoreData?.ai_score ?? 0;
    const hasAiBaseline = (preScored?.liveItems.length ?? 0) > 0
      || aiCoverageScore != null
      || !!(aiVisibilitySummary && aiVisibilitySummary.prompts_total > 0)
      || (scoreData?.ai_score != null);
    preContentScoreRef.current = preScored
      ? (hasAiBaseline ? computeOverallContentScore(preScored.seo, preAiBase) : preScored.seo)
      : 0;
    aiVisibilityBaselineRef.current = preScored?.ai ?? coverageSnapshot?.overall ?? 0;
    prevAiRef.current = aiVisibilityBaselineRef.current;
    attributionBeforeRef.current = preScored
      ? computeCoverageScores(
        preScored.liveItems,
        coverageSnapshot?.answersMainQuestionEarly ?? false,
      ).buckets
      : [];
    setAoFloat(null);
    setActiveSectionId(null);
    changedSectionsRef.current = [];
    optimizeStore.clear();
    setOptimizeState('optimizing');
    setIsAutoOptimizing(true);
    setOptimizeProgress({ processed: 0, total: 0 });
    setAutoOptimizeStatus('Optimizing sections…');
    optimizeStore.setOnDocSync(() => {
      const ed = getEditor();
      if (ed) {
        setEditorHtml(ed.getHTML());
        setOptimizeDocTick((t) => t + 1);
      }
    });

    const resetIdle = () => {
      optimizeStore.clear();
      changedSectionsRef.current = [];
      setActiveSectionId(null);
      setOptimizeDocTick(0);
      setOptimizeState('idle');
      setIsAutoOptimizing(false);
      setOptimizeProgress({ processed: 0, total: 0 });
      setOptimizeRemaining(0);
      setAoFloat(null);
      setAutoOptimizeStatus('');
    };

    const aoSignal = optimizeStore.beginRun();

    try {
      const res = await fetch('/api/articles/optimize-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: preHtml, articleId: article?.id, scoreData, targetScore: 80, maxRounds: 4 }),
        signal: aoSignal,
      });
      if (res.status === 429) {
        const ej = await res.json().catch(() => ({}));
        if (ej.error === 'org_limit') {
          const at = ej.resetsAt ? new Date(ej.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          toast.error(`Your organization reached its AI limit.${at ? ` Resets at ${at}.` : ''}`);
          resetIdle();
          return;
        }
      }
      if (!res.ok || !res.body) throw new Error('Optimize request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const orderedEvents: SectionEvent[] = [];

      while (true) {
        if (aoSignal.aborted) {
          try { await reader.cancel(); } catch { /* ignore */ }
          resetIdle();
          return;
        }
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.trim()) continue;
          const eventLine = part.match(/^event: (\w+)/m);
          const dataLine = part.match(/^data: (.+)/ms);
          const eventType = eventLine?.[1] ?? 'message';
          if (!dataLine) continue;

          let payload: unknown;
          try { payload = JSON.parse(dataLine[1]); } catch (e) { console.error('[optimize-sections] JSON parse error', eventType, e); continue; }

          if (eventType === 'terms') {
            const { terms: enrichedTerms } = payload as { terms: NlpTerm[] };
            if (enrichedTerms?.length) {
              const plain = preHtml.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
              setScoreData((prev) => {
                const prevCount = prev.terms?.length ?? 0;
                if (enrichedTerms.length < prevCount) return prev;
                return {
                  ...prev,
                  terms: enrichedTerms.map((t) => ({
                    ...t,
                    current_count: countOccurrences(plain, t.term),
                  })),
                };
              });
            }
          } else if (eventType === 'meta') {
            const m = payload as { total: number; sections?: Array<{ sectionId: string }> };
            setOptimizeProgress({ processed: 0, total: m.total });
            const articleSections = splitSections(preHtml);
            articleSections.forEach((s) => {
              optimizeStore.set(s.id, { oldHtml: s.html, newHtml: s.html, changed: false });
            });
            const firstId = articleSections[0]?.id ?? null;
            setActiveSectionId(firstId);
            const streamHtml = buildStreamingDoc(preHtml, [], firstId);
            try { editor.commands.setContent(streamHtml, { emitUpdate: false }); } catch (e) { console.error('[optimize-sections] setContent error', e); }
            setEditorHtml(streamHtml);
            setOptimizeDocTick((t) => t + 1);
            if (firstId) {
              requestAnimationFrame(() => scrollToOptimizerSection(firstId));
            }
          } else if (eventType === 'section') {
            const ev = payload as SectionEvent;
            orderedEvents.push(ev);
            setActiveSectionId(ev.sectionId);
            optimizeStore.set(ev.sectionId, {
              oldHtml: ev.oldHtml, newHtml: ev.newHtml, changed: ev.changed,
              focus: ev.focus, mode: ev.mode, reason: ev.reason,
            });
            if (ev.changed) {
              changedSectionsRef.current.push({ sectionId: ev.sectionId, headingText: ev.headingText, oldHtml: ev.oldHtml, newHtml: ev.newHtml });
            }
            const articleSections = splitSections(preHtml);
            const currentIdx = articleSections.findIndex((s) => s.id === ev.sectionId);
            const nextId = currentIdx >= 0 ? articleSections[currentIdx + 1]?.id ?? null : null;
            setOptimizeProgress((p) => ({ ...p, processed: p.processed + 1 }));
            const streamHtml = buildStreamingDoc(preHtml, orderedEvents, nextId);
            try { editor.commands.setContent(streamHtml, { emitUpdate: false }); } catch (e) { console.error('[optimize-sections] setContent error', e); }
            setEditorHtml(streamHtml);
            setOptimizeDocTick((t) => t + 1);
            if (nextId) {
              requestAnimationFrame(() => scrollToOptimizerSection(nextId));
            }
          } else if (eventType === 'progress') {
            const p = payload as {
              round: number; seo: number; ai: number; content: number;
              phase?: string; targetContent?: number; targetSeo?: number; changed?: number;
            };
            // Don't flash scores before any HTML change — wait for a real edit.
            if (p.changed) {
              setAutoOptimizeStatus(
                `Round ${p.round} — SEO ${p.seo} · AI ${p.ai}`,
              );
            } else {
              setAutoOptimizeStatus(`Round ${p.round} — refining…`);
            }
          } else if (eventType === 'done') {
            const meta = payload as {
              changedCount: number; total: number; promptVersion: string; creditDeducted: boolean;
              seo?: number; ai?: number; content?: number; rounds?: number; phase?: string;
              outcome?: string;
              userMessage?: string;
              metrics?: { bodyAccepted?: number; faqAccepted?: boolean };
            };
            optimizeMetaRef.current = {
              changedCount: meta.changedCount,
              creditDeducted: meta.creditDeducted,
              promptVersion: meta.promptVersion,
              phase: meta.phase,
              rounds: meta.rounds,
              lastSeo: meta.seo,
              lastAi: meta.ai,
              lastContent: meta.content,
            };
            if (meta.changedCount > 0) {
              const reviewHtml = buildStreamingDoc(preHtml, orderedEvents, null);
              try { editor.commands.setContent(reviewHtml, { emitUpdate: false }); } catch (e) { console.error('[optimize-sections] setContent error', e); }
              setEditorHtml(reviewHtml);
              setOptimizeDocTick((t) => t + 1);
              setOptimizeState('reviewing');
              const statusMsg = meta.userMessage
                || (meta.outcome === 'faq_only'
                  ? 'Incomplete — FAQ only; review carefully before Save'
                  : `Review ${meta.changedCount} section${meta.changedCount === 1 ? '' : 's'}…`);
              setAutoOptimizeStatus(statusMsg);
              if (meta.outcome === 'faq_only' || meta.outcome === 'partial_body' || meta.outcome === 'incomplete_no_body') {
                toast(meta.userMessage || 'Partial optimization — SEO gaps may remain.', { icon: '⚠️', duration: 7000 });
              }
            } else if (meta.outcome === 'already_optimal') {
              setAutoOptimizeStatus('Already well-optimized — no changes needed.');
              toast('Your article is well-optimized — we didn’t find anything to improve. No credit deducted.', { icon: '✨', duration: 6000 });
              resetIdle();
            } else if (meta.outcome === 'no_usable_edit') {
              setAutoOptimizeStatus('Couldn’t apply rewrite — try again.');
              toast.error('Auto-Optimize got an incomplete rewrite and kept your article unchanged. Try again.', { duration: 6000 });
              resetIdle();
            } else {
              setAutoOptimizeStatus(meta.userMessage || 'No changes produced.');
              toast(meta.userMessage || 'Auto-Optimize didn’t change the article this time. No credit deducted.', { duration: 6000 });
              resetIdle();
            }
            return;
          } else if (eventType === 'error') {
            throw new Error((payload as { message?: string })?.message || 'Optimize failed');
          }
        }
      }
      resetIdle();
    } catch (err) {
      if (isAbortError(err) || optimizeStore.isRunAborted()) {
        resetIdle();
        return;
      }
      console.error('[optimize-sections] failed:', err);
      toast.error(getErrorMessage(err));
      resetIdle();
    }
  };

  useEffect(() => {
    if (optimizeState !== 'reviewing') return undefined;
    let ed: Editor | null = null;
    const check = () => {
      if (!ed) return;
      let pending = 0;
      ed.state.doc.descendants((n: PMNode) => {
        if (n.type.name === 'contentOptimizer') {
          const st = String(n.attrs.status ?? '');
          if (st === 'improved' || st === 'pending' || st === 'active') pending += 1;
        }
      });
      setOptimizeRemaining(pending);
    };
    const tryBind = () => {
      const e = getEditor();
      if (e && !ed) { ed = e; e.on('update', check); check(); return true; }
      return false;
    };
    if (!tryBind()) {
      const iv = setInterval(() => { if (tryBind()) clearInterval(iv); }, 200);
      return () => { clearInterval(iv); if (ed) ed.off('update', check); };
    }
    return () => { if (ed) ed.off('update', check); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optimizeState]);

  const resolveAllOptimizerNodes = () => {
    const editor = getEditor();
    if (!editor) return;
    const refs = collectOptimizerPositions(editor.state.doc as PMDocLike);
    refs.forEach((ref) => {
      const entry = optimizeStore.get(ref.sectionId);
      const html = entry?.newHtml || entry?.oldHtml || '';
      if (!html) return;
      editor.chain().insertContentAt({ from: ref.pos, to: ref.pos + ref.nodeSize }, html).run();
    });
  };

  const handleAcceptAll = () => { resolveAllOptimizerNodes(); };

  const navigateSection = (dir: 1 | -1) => {
    const editor = getEditor();
    if (!editor) return;
    const refs = collectOptimizerPositions(editor.state.doc as PMDocLike)
      .filter((r) => r.status === 'improved' || r.status === 'pending' || r.status === 'active')
      .slice().reverse();
    if (!refs.length) return;
    const caret = editor.state.selection.from;
    const targetRef = dir === 1
      ? (refs.find((r) => r.pos > caret) ?? refs[0])
      : ([...refs].reverse().find((r) => r.pos < caret) ?? refs[refs.length - 1]);
    editor.chain().focus().setTextSelection(targetRef.pos).run();
    scrollToOptimizerSection(targetRef.sectionId);
  };

  const handleConfirmCancel = () => {
    optimizeStore.cancelRun();
    const editor = getEditor();
    const restored = preReviewHtmlRef.current;
    if (editor) {
      try { editor.commands.setContent(restored, { emitUpdate: false }); } catch (e) { console.error('[optimize-cancel] setContent error', e); }
    }
    setEditorHtml(restored);
    optimizeStore.clear();
    changedSectionsRef.current = [];
    setActiveSectionId(null);
    setOptimizeDocTick(0);
    setOptimizeState('idle');
    setIsAutoOptimizing(false);
    setOptimizeProgress({ processed: 0, total: 0 });
    setOptimizeRemaining(0);
    setAoFloat(null);
    setAutoOptimizeStatus('');
    setCancelModalOpen(false);
  };

  const handleSaveOptimizeRun = async () => {
    const editor = getEditor();
    if (!editor) return;
    setOptimizeSaving(true);
    try {
      resolveAllOptimizerNodes();
      const html: string = editor.getHTML();
      setEditorHtml(html);
      const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
      const words = text ? text.split(/\s+/).length : 0;
      let headings = 0;
      let paragraphs = 0;
      editor.state.doc.descendants((n: PMNode) => {
        if (n.type.name === 'heading') headings += 1;
        if (n.type.name === 'paragraph' && n.textContent.trim()) paragraphs += 1;
      });
      await doSave(
        'auto_optimize',
        undefined,
        {
          changes: optimizeMetaRef.current.changedCount,
          promptVersion: optimizeMetaRef.current.promptVersion,
          creditDeducted: optimizeMetaRef.current.creditDeducted,
          lastContentScore: optimizeMetaRef.current.lastContent,
          lastSeo: optimizeMetaRef.current.lastSeo,
          lastAi: optimizeMetaRef.current.lastAi,
        },
        { html, text, words, headings, paragraphs },
      );
      lastSavedSig.current = JSON.stringify({
        h: html,
        t: article?.meta_title ?? '',
        d: article?.meta_description ?? '',
        k: article?.target_keyword ?? '',
        u: article?.meta_url ?? '',
        img: featuredImage?.url ?? null,
      });
      lastVersionAt.current = Date.now();
      setAutoSaveState('saved');
      setSaveModalOpen(false);
      setSavedBannerOpen(true);
      optimizeStore.clear();
      setOptimizeState('idle');
      setIsAutoOptimizing(false);
      setOptimizeRemaining(0);
    } catch (err) {
      console.error('[optimize-save] failed:', err);
      toast.error('Could not save Auto-Optimize changes');
    } finally {
      setOptimizeSaving(false);
    }
  };

  useEffect(() => {
    if (optimizeState !== 'reviewing') return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [optimizeState]);

  return {
    linkBar,
    setLinkBar,
    linkNavIdx,
    setLinkNavIdx,
    isApplyingReadability,
    readabilityBar,
    setReadabilityBar,
    readabilityAcceptKey,
    setReadabilityAcceptKey,
    compareVersions,
    setCompareVersions,
    isAutoOptimizing,
    autoOptimizeStatus,
    optimizeState,
    optimizeMetaRef,
    preScoreRef,
    preContentScoreRef,
    optimizeProgress,
    optimizeRemaining,
    optimizeSaving,
    cancelModalOpen,
    setCancelModalOpen,
    saveModalOpen,
    setSaveModalOpen,
    savedBannerOpen,
    setSavedBannerOpen,
    liveRescore,
    aoFloat,
    setAoFloat,
    activeSectionId,
    aiVisibilityBaselineRef,
    remainingRows,
    aoLiveSnapshot,
    optimizeReview,
    handleApplyReadability,
    compareVersionsButton,
    handleInsertLinks,
    handleAutoOptimizeSections,
    handleAcceptAll,
    navigateSection,
    handleConfirmCancel,
    handleSaveOptimizeRun,
  };
}
