import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { countOccurrences, computeContentScore, type ScoreData } from '../../lib/contentScore';
import type { AiVisibilitySummary } from '../../lib/aiSearchScore';
import type { CoverageItem, BucketScore, CoverageSnapshot } from '../../lib/aiCoverage';
import { computeCoverageScores } from '../../lib/aiCoverage';
import { parseSnapshot } from '../../lib/coverageStore';
import { liveCoverageItems } from '../../lib/liveCoverage';
import { getErrorMessage } from '../../lib/errors';
import { parseJsonish } from '../../lib/types/json';
import type { PlagiarismResult } from '../../components/articles/PlagiarismPanel';
import type { AiReadabilityResult } from '../../components/articles/PrePublishPanel';
import type { Article } from './useArticleEditorState';

export interface UseArticleScoreOptions {
  id: string | undefined;
  article: Article | null;
  setArticle: React.Dispatch<React.SetStateAction<Article | null>>;
  scoreData: ScoreData;
  setScoreData: React.Dispatch<React.SetStateAction<ScoreData>>;
  editorHtml: string;
  plainText: string;
  wordCount: number;
  headingCount: number;
}

export function useArticleScore({
  id,
  article,
  setArticle,
  scoreData,
  setScoreData,
  editorHtml,
  plainText,
  wordCount,
  headingCount,
}: UseArticleScoreOptions) {
  const [aiVisibilitySummary, setAiVisibilitySummary] = useState<AiVisibilitySummary | null>(null);
  const [coverageItems, setCoverageItems] = useState<CoverageItem[]>([]);
  const [coverageBuckets, setCoverageBuckets] = useState<BucketScore[]>([]);
  const [aiCoverageScore, setAiCoverageScore] = useState<number | null>(null);
  const [coverageSnapshot, setCoverageSnapshot] = useState<CoverageSnapshot | null>(null);
  const [isRunningAiVisibility, setIsRunningAiVisibility] = useState(false);
  const [analysisReloadKey, setAnalysisReloadKey] = useState(0);
  const [plagSentences, setPlagSentences] = useState<string[]>([]);
  const [plagFocused, setPlagFocused] = useState<string | null>(null);

  const hydrateFromArticle = useCallback((art: Article) => {
    if (art.ai_visibility_summary) {
      setAiVisibilitySummary(art.ai_visibility_summary);
    }
    const snap = parseSnapshot(art.ai_info_to_cover);
    setCoverageItems(snap ? [...snap.items] : []);
    setCoverageBuckets(snap ? [...snap.buckets] : []);
    setAiCoverageScore(snap?.overall ?? null);
    setCoverageSnapshot(snap ?? null);
  }, []);

  const onAnalysisComplete = useCallback(async () => {
    const articleId = typeof id === 'string' ? id : null;
    if (articleId) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          const r = await fetch(`/api/articles/${articleId}`);
          if (r.ok) {
            const data = await r.json();
            const art = data.article as Article | undefined;
            if (art) {
              setArticle(art);
              if (art.score_data) {
                try { setScoreData(JSON.parse(art.score_data)); } catch { /* ignore */ }
              }
              if (art.ai_visibility_summary) {
                setAiVisibilitySummary(art.ai_visibility_summary);
              }
              const snap = parseSnapshot(art.ai_info_to_cover);
              if (snap?.items?.length) {
                setCoverageItems([...snap.items]);
                setCoverageBuckets([...snap.buckets]);
                setAiCoverageScore(snap.overall ?? null);
                setCoverageSnapshot(snap);
              }
              if (art.score_data || snap?.items?.length) break;
            }
          }
        } catch { /* retry */ }
        await new Promise((resolve) => { setTimeout(resolve, 1000); });
      }
    }
    setAnalysisReloadKey((k) => k + 1);
    toast.success('Analiza zakończona');
  }, [id, setArticle, setScoreData]);

  const onAnalysisError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  const handlePlagiarismHighlight = useCallback((sentences: string[], focused: string | null) => {
    setPlagSentences(sentences);
    setPlagFocused(focused);
  }, []);

  const internalLinksCount = useMemo(
    () => (editorHtml.match(/<a\s[^>]*href=/gi) || []).length,
    [editorHtml],
  );

  const liveAiCoverageScore = useMemo(() => {
    if (!coverageSnapshot?.items?.length) return aiCoverageScore;
    const liveItems = liveCoverageItems(coverageSnapshot.items, plainText, editorHtml);
    return computeCoverageScores(liveItems, !!coverageSnapshot.answersMainQuestionEarly).overall;
  }, [coverageSnapshot, plainText, editorHtml, aiCoverageScore]);

  const liveCoverageItemsState = useMemo(() => {
    if (!coverageSnapshot?.items?.length) return coverageItems;
    return [...liveCoverageItems(coverageSnapshot.items, plainText, editorHtml)];
  }, [coverageSnapshot, plainText, editorHtml, coverageItems]);

  const liveCoverageBuckets = useMemo(() => {
    if (!coverageSnapshot?.items?.length) return coverageBuckets;
    return computeCoverageScores(
      liveCoverageItems(coverageSnapshot.items, plainText, editorHtml),
      !!coverageSnapshot.answersMainQuestionEarly,
    ).buckets;
  }, [coverageSnapshot, plainText, editorHtml, coverageBuckets]);

  const liveContentScore = useMemo(() => {
    if (!scoreData) return 0;
    const paraCount = plainText.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
    const updatedTerms = scoreData.terms?.map((t) => ({
      ...t,
      current_count: countOccurrences(plainText, t.term),
    }));
    return computeContentScore(
      plainText,
      wordCount,
      headingCount,
      { ...scoreData, terms: updatedTerms ?? scoreData.terms },
      paraCount,
      internalLinksCount,
      editorHtml,
      article?.target_keyword || '',
      undefined,
      liveCoverageItemsState,
    );
  }, [plainText, wordCount, headingCount, scoreData, internalLinksCount, editorHtml, article?.target_keyword, liveCoverageItemsState]);

  const initialPlagiarism = useMemo(
    () => parseJsonish<PlagiarismResult>(article?.plagiarism_json),
    [article?.plagiarism_json],
  );

  const initialAiReadability = useMemo(
    () => parseJsonish<AiReadabilityResult>(article?.ai_readability_json),
    [article?.ai_readability_json],
  );

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
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsRunningAiVisibility(false);
    }
  };

  return {
    aiVisibilitySummary,
    setAiVisibilitySummary,
    coverageItems: liveCoverageItemsState,
    setCoverageItems,
    coverageBuckets: liveCoverageBuckets,
    setCoverageBuckets,
    aiCoverageScore: liveAiCoverageScore,
    setAiCoverageScore,
    coverageSnapshot,
    setCoverageSnapshot,
    isRunningAiVisibility,
    analysisReloadKey,
    plagSentences,
    plagFocused,
    hydrateFromArticle,
    onAnalysisComplete,
    onAnalysisError,
    handlePlagiarismHighlight,
    internalLinksCount,
    liveContentScore,
    initialPlagiarism,
    initialAiReadability,
    handleRunAiVisibility,
  };
}
