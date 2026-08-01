import React from 'react';
import ContentScorePanel from '../ContentScorePanel';
import InternalLinksPanel from '../InternalLinksPanel';
import type { OptimizeLiveSnapshot } from '../../../lib/computeLiveArticleScores';
import type { ScoreData } from '../../../lib/contentScore';
import type { AiVisibilitySummary } from '../../../lib/aiSearchScore';
import type { CoverageItem, BucketScore, CoverageSnapshot } from '../../../lib/aiCoverage';
import type { PlagiarismResult } from '../PlagiarismPanel';
import type { AiReadabilityResult } from '../PrePublishPanel';
import type { DeepAnalysisUiState } from '../../../lib/deepAnalysisProgress';
import type { Article } from '../../../hooks/articles/useArticleEditorState';
import type { LiveRescoreState } from '../../../hooks/articles/useArticleOptimize';
import { VersionHistoryPanel } from './ArticleEditorModals';

export interface ArticleEditorSidebarProps {
  editorLocked: boolean;
  ranksmileDockOpen: boolean;
  setRanksmileDockEl: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
  showInternalLinksPanel: boolean;
  setShowInternalLinksPanel: (open: boolean) => void;
  showHistory: boolean;
  setShowHistory: (open: boolean) => void;
  article: Article;
  domains: DomainType[];
  plainText: string;
  wordCount: number;
  headingCount: number;
  scoreData: ScoreData;
  internalLinksCount: number;
  editorHtml: string;
  liveContentScore: number;
  isDeepAnalyzing: boolean;
  deepAnalysisUi: DeepAnalysisUiState | null;
  domainBaseUrl: string;
  onInsertLinks: (links: Array<{ anchorText: string; url: string }>) => Array<{ url: string; anchorText: string; success: boolean }>;
  onLinksAiActivity: (active: boolean) => void;
  articleKeywords: string[];
  internalArticles: Array<{ id: number; title: string; url: string }>;
  onRestoreVersion: (version: { id: number; content: string; score_data: string | null }) => void;
  optimizeState: 'idle' | 'optimizing' | 'reviewing';
  aoLiveSnapshot: OptimizeLiveSnapshot | null;
  preScoreRef: React.MutableRefObject<number>;
  optimizeReview: { postScore: number; seoDelta: number; postHtml: string; postText: string } | null;
  liveRescore: LiveRescoreState | null;
  aiVisibilityBaselineRef: React.MutableRefObject<number>;
  preContentScoreRef: React.MutableRefObject<number>;
  aiCoverageScore: number | null;
  aiVisibilitySummary: AiVisibilitySummary | null;
  onInternalLinks: () => void;
  onAutoOptimize: () => void;
  isAutoOptimizing: boolean;
  onCancelOptimize: () => void;
  onSaveOptimize: () => void;
  optimizeSaving: boolean;
  autoSaveState: 'saved' | 'saving' | 'unsaved';
  onMetaTitleChange: (v: string) => void;
  onMetaDescriptionChange: (v: string) => void;
  highlightTerms: boolean;
  onHighlightTermsChange: (v: boolean) => void;
  initialPlagiarism: PlagiarismResult | null | undefined;
  initialAiReadability: AiReadabilityResult | null | undefined;
  featuredImage: { url: string; alt: string } | null;
  onFeaturedImageChange: React.Dispatch<React.SetStateAction<{ url: string; alt: string } | null>>;
  onMarkDone: () => void;
  coverageItems: CoverageItem[];
  coverageBuckets: BucketScore[];
  coverageSnapshot: CoverageSnapshot | null;
  isRunningAiVisibility: boolean;
  onRunAiVisibility: () => void;
  onApplyReadability: (result: { criteria?: Array<{ suggestions?: string[] }> }) => void;
  onPlagiarismHighlight: (sentences: string[], focused: string | null) => void;
  readabilityAccepted: number;
}

export function ArticleEditorSidebar({
  editorLocked,
  ranksmileDockOpen,
  setRanksmileDockEl,
  showInternalLinksPanel,
  setShowInternalLinksPanel,
  showHistory,
  setShowHistory,
  article,
  domains,
  plainText,
  wordCount,
  headingCount,
  scoreData,
  internalLinksCount,
  editorHtml,
  liveContentScore,
  isDeepAnalyzing,
  deepAnalysisUi,
  domainBaseUrl,
  onInsertLinks,
  onLinksAiActivity,
  articleKeywords,
  internalArticles,
  onRestoreVersion,
  optimizeState,
  aoLiveSnapshot,
  preScoreRef,
  optimizeReview,
  liveRescore,
  aiVisibilityBaselineRef,
  preContentScoreRef,
  aiCoverageScore,
  aiVisibilitySummary,
  onInternalLinks,
  onAutoOptimize,
  isAutoOptimizing,
  onCancelOptimize,
  onSaveOptimize,
  optimizeSaving,
  autoSaveState,
  onMetaTitleChange,
  onMetaDescriptionChange,
  highlightTerms,
  onHighlightTermsChange,
  initialPlagiarism,
  initialAiReadability,
  featuredImage,
  onFeaturedImageChange,
  onMarkDone,
  coverageItems,
  coverageBuckets,
  coverageSnapshot,
  isRunningAiVisibility,
  onRunAiVisibility,
  onApplyReadability,
  onPlagiarismHighlight,
  readabilityAccepted,
}: ArticleEditorSidebarProps) {
  return (
    <div className="koala-panel editor-side-panel-card">
      {editorLocked ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="styled-scrollbar">
          <ContentScorePanel
            plainText={plainText}
            wordCount={wordCount}
            headingCount={headingCount}
            scoreData={scoreData}
            internalLinksCount={internalLinksCount}
            html={editorHtml}
            keyword={article.target_keyword || ''}
            articleId={article.id}
            domainSlug={domains.find((d) => d.ID === article.domain_id)?.slug}
            cachedOutlines={article.competitor_outlines_cache}
            fallbackScore={article.content_score}
            title={article.title || ''}
            metaTitle={article.meta_title || ''}
            metaDescription={article.meta_description || ''}
            isDeepAnalyzing={isDeepAnalyzing}
            deepAnalysisUi={deepAnalysisUi}
          />
        </div>
      ) : ranksmileDockOpen ? (
        <div ref={setRanksmileDockEl} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} />
      ) : showInternalLinksPanel ? (
        <InternalLinksPanel
          articleId={article.id}
          keyword={article.target_keyword || ''}
          plainText={plainText}
          domainBaseUrl={domainBaseUrl}
          domains={domains}
          onClose={() => setShowInternalLinksPanel(false)}
          onInsertLinks={onInsertLinks}
          onAiActivity={onLinksAiActivity}
          articleKeywords={articleKeywords}
          internalArticles={internalArticles}
        />
      ) : showHistory ? (
        <VersionHistoryPanel
          articleId={article.id}
          currentWordCount={wordCount}
          currentScore={liveContentScore}
          onClose={() => setShowHistory(false)}
          onRestore={onRestoreVersion}
        />
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="styled-scrollbar">
          <ContentScorePanel
            plainText={plainText}
            wordCount={wordCount}
            headingCount={headingCount}
            scoreData={scoreData}
            internalLinksCount={internalLinksCount}
            html={editorHtml}
            scoreDeltas={optimizeState === 'reviewing' && aoLiveSnapshot ? (() => {
              const aiBase = aiVisibilityBaselineRef.current || (scoreData?.ai_score ?? 0);
              const hasAi = aiCoverageScore != null || !!(aiVisibilitySummary && aiVisibilitySummary.prompts_total > 0) || scoreData?.ai_score != null;
              const seoDelta = Math.max(0, aoLiveSnapshot.seo - preScoreRef.current);
              const aiDelta = Math.round(aoLiveSnapshot.ai) - Math.round(aiBase);
              const overallDelta = aoLiveSnapshot.overall - preContentScoreRef.current;
              return {
                seo: seoDelta > 0 ? seoDelta : undefined,
                overall: overallDelta > 0 ? overallDelta : undefined,
                ai: hasAi && aiDelta > 0 ? aiDelta : undefined,
              };
            })() : undefined}
            optimizeLiveScores={optimizeState === 'reviewing' && aoLiveSnapshot ? {
              seo: aoLiveSnapshot.seo,
              ai: aoLiveSnapshot.ai,
              overall: aoLiveSnapshot.overall,
            } : undefined}
            keyword={article.target_keyword || ''}
            onInternalLinks={onInternalLinks}
            onAutoOptimize={onAutoOptimize}
            isAutoOptimizing={isAutoOptimizing}
            optimizeState={optimizeState}
            onCancelOptimize={onCancelOptimize}
            onSaveOptimize={onSaveOptimize}
            optimizeSaving={optimizeSaving}
            saveState={autoSaveState}
            articleId={article.id}
            domainSlug={domains.find((d) => d.ID === article.domain_id)?.slug}
            cachedOutlines={article.competitor_outlines_cache}
            fallbackScore={article.content_score}
            title={article.title || ''}
            metaTitle={article.meta_title || ''}
            metaDescription={article.meta_description || ''}
            onMetaTitleChange={onMetaTitleChange}
            onMetaDescriptionChange={onMetaDescriptionChange}
            highlightTerms={highlightTerms}
            onHighlightTermsChange={onHighlightTermsChange}
            initialPlagiarism={initialPlagiarism}
            initialAiReadability={initialAiReadability}
            featuredImage={featuredImage}
            onFeaturedImageChange={onFeaturedImageChange}
            isDone={article.status === 'accepted'}
            onMarkDone={onMarkDone}
            aiVisibilitySummary={aiVisibilitySummary}
            coverageItems={aoLiveSnapshot ? aoLiveSnapshot.liveItems : coverageItems}
            coverageBuckets={aoLiveSnapshot ? aoLiveSnapshot.buckets : coverageBuckets}
            coverageSnapshot={coverageSnapshot}
            aiCoverageScore={aiCoverageScore}
            isRunningAiVisibility={isRunningAiVisibility}
            onRunAiVisibility={onRunAiVisibility}
            onApplyReadability={onApplyReadability}
            onPlagiarismHighlight={onPlagiarismHighlight}
            readabilityAccepted={readabilityAccepted}
            isDeepAnalyzing={isDeepAnalyzing}
            deepAnalysisUi={deepAnalysisUi}
          />
        </div>
      )}
    </div>
  );
}
