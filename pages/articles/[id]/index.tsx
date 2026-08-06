import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import AppShell from '../../../components/common/AppShell';
import { Button } from '../../../components/koala/core';
import { Icon } from '../../../components/koala/icons';
import ContentScorePanel from '../../../components/articles/ContentScorePanel';
import InternalLinksPanel from '../../../components/articles/InternalLinksPanel';
import KeywordSuggestInput from '../../../components/articles/KeywordSuggestInput';
import PixabayImageModal from '../../../components/articles/PixabayImageModal';
import WordPressExportModal from '../../../components/articles/WordPressExportModal';
import VersionHistoryPanel from '../../../components/articles/VersionHistoryPanel';
import CustomizationPanelModal from '../../../components/articles/CustomizationPanelModal';
import EditorOnboarding from '../../../components/articles/EditorOnboarding';
import { Thread, CommentAuthor } from '../../../components/articles/comments/CommentThreadBubble';
import EditorLoading from '../../../components/articles/EditorLoading';
import CompareVersionsModal from '../../../components/articles/CompareVersionsModal';
import OptimizeReviewBar from '../../../components/articles/OptimizeReviewBar';
import OptimizeCancelModal from '../../../components/articles/OptimizeCancelModal';
import OptimizeSaveModal from '../../../components/articles/OptimizeSaveModal';
import OptimizeSavedBanner from '../../../components/articles/OptimizeSavedBanner';
import { resolveArticleEntry, articleEntryHref } from '../../../lib/articleFlow';
import AnalysisProgressPanel from '../../../components/articles/AnalysisProgressPanel';
import type { AnalysisPhases } from '../../../lib/analysisPhases';
import { computeOptimizeLiveSnapshot } from '../../../lib/computeLiveArticleScores';
import { scoreArticleHtml } from '../../../lib/scoreArticleHtml';
import { liveCoverageItems, scoreDeltaGate } from '../../../lib/liveCoverage';
import { computeCoverageScores } from '../../../lib/aiCoverage';
import { filterSyntheticCitationTemplates } from '../../../lib/citationPrompts';
import { buildDeveloperReport, downloadDeveloperReport } from '../../../lib/articles/buildDeveloperReport';
import AoScoreFloat from '../../../components/articles/AoScoreFloat';
import { substituteOptimizerPlaceholders } from '../../../lib/optimizePostHtml';
import { collectOptimizerPositions } from '../../../lib/optimizeResolveAll';
import type { PMDocLike } from '../../../lib/optimizeResolveAll';
import { authClient } from '../../../lib/auth/client';
import { useFetchDomains } from '../../../services/domains';
import { useFetchSettings } from '../../../services/settings';
import { useContentSettings } from '../../../services/contentSettings';
import { useArticleKeywords } from '../../../services/articleKeywords';
import { ScoreData, NlpTerm, countOccurrences, computeContentScore } from '../../../lib/contentScore';
import type { AiVisibilitySummary } from '../../../lib/aiSearchScore';
import { computeOverallContentScore } from '../../../lib/aiSearchScore';
import type { CoverageItem, BucketScore, CoverageSnapshot } from '../../../lib/aiCoverage';
import { parseSnapshot } from '../../../lib/coverageStore';
import { readAnalyzeSession, resolveAnalyzingStatusOnLoad } from '../../../lib/deepAnalysisProgress';
import { getErrorMessage } from '../../../lib/errors';
import { isAbortError } from '../../../lib/abortSignal';
import type { SectionEvent } from '../../../lib/optimizeSectionEvents';
import { buildReviewDoc } from '../../../lib/optimizeReviewDoc';
import { optimizeStore } from '../../../components/articles/optimizeStore';
import { useBackgroundDeepAnalysis } from '../../../hooks/useBackgroundDeepAnalysis';
import { prefersReducedMotion } from '../../../lib/motion/gsap';
import type { ArticleEditorHandle } from '../../../lib/types/editor';
import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { PlagiarismResult } from '../../../components/articles/PlagiarismPanel';
import type { AiReadabilityResult } from '../../../components/articles/PrePublishPanel';
import { parseJsonish } from '../../../lib/types/json';
import ArticleEditor from '../../../components/articles/ArticleEditorClient';
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
  content_score?: number;
  word_count: number;
  featured_image: string | null;
  publish_target: string | null;
  publish_url: string | null;
  competitor_outlines_cache: string | null;
  internal_links_cache?: string | null;
  ai_info_to_cover?: string | null;
  ai_visibility_summary?: AiVisibilitySummary | null;
  language?: string;
  created_at?: string;
  updated_at?: string;
  plagiarism_json?: string | null;
  ai_readability_json?: string | null;
}

/** DB rows can stay `analyzing` after a failed/cancelled run — unlock the editor on load.
 *  Fresh import has status=analyzing with no job yet — keep analyzing so the hook can start. */
async function reconcileAnalyzingArticle(art: Article): Promise<Article> {
  if (art.status !== 'analyzing') return art;
  if (readAnalyzeSession(art.id)) return art;
  try {
    const res = await fetch(`/api/articles/job-progress?articleId=${art.id}`);
    if (res.status === 404) return art; // no job yet — useBackgroundDeepAnalysis starts it
    if (!res.ok) return art;
    const data = await res.json() as {
      status?: string;
      currentStage?: string | null;
      stageProgress?: number | null;
      progressMessage?: string | null;
      updatedAt?: string | null;
    };
    const next = resolveAnalyzingStatusOnLoad({
      status: data.status || '',
      currentStage: data.currentStage,
      stageProgress: data.stageProgress,
      progressMessage: data.progressMessage,
      updatedAt: data.updatedAt ?? null,
    });
    return next === art.status ? art : { ...art, status: next };
  } catch {
    return art;
  }
}

/** Task 9 placeholder nav for the results-panel adjustments cards — smooth-scrolls the
 *  editor to the given contentOptimizer section node. Real implementation already; Task 10/11
 *  may extend it (e.g. highlight-on-arrival). */
function scrollToOptimizerSection(sectionId: string): void {
  document.querySelector(`[data-section-id="${sectionId}"]`)?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'center',
  });
}

/* ── Icon button used in the top action bar ──────────────────────── */
const IconBtn = ({
  children, onClick, disabled, title, danger, active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
  active?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 32, height: 32, borderRadius: 8, border: 'none',
      background: active ? 'var(--koala-bg-secondary)' : 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      color: danger ? 'var(--koala-status-danger)' : (active ? 'var(--koala-text-primary)' : 'var(--koala-text-secondary)'),
      padding: 0, transition: 'color 0.15s, background 0.15s',
      fontFamily: 'var(--font-family-primary)',
    }}
    onMouseEnter={(e) => {
      if (disabled) return;
      e.currentTarget.style.color = danger ? 'var(--koala-status-danger)' : 'var(--koala-text-primary)';
      e.currentTarget.style.background = 'var(--koala-bg-secondary)';
    }}
    onMouseLeave={(e) => {
      if (disabled) return;
      e.currentTarget.style.color = danger ? 'var(--koala-status-danger)' : (active ? 'var(--koala-text-primary)' : 'var(--koala-text-secondary)');
      e.currentTarget.style.background = active ? 'var(--koala-bg-secondary)' : 'transparent';
    }}
  >
    {children}
  </button>
);

/* ── Ranksmile-style action-bar icons (20px) ─────────────────────────── */
const sIco = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const IcoDoneFilled = () => (<svg width={20} height={20} viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1ZM17.2071 9.70711C17.5976 9.31658 17.5976 8.68342 17.2071 8.29289C16.8166 7.90237 16.1834 7.90237 15.7929 8.29289L10.5 13.5858L8.20711 11.2929C7.81658 10.9024 7.18342 10.9024 6.79289 11.2929C6.40237 11.6834 6.40237 12.3166 6.79289 12.7071L9.79289 15.7071C10.1834 16.0976 10.8166 16.0976 11.2071 15.7071L17.2071 9.70711Z" /></svg>);
const IcoDoneOutline = () => (<svg width={20} height={20} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" {...sIco} /><path {...sIco} d="M8.4 12.3l2.4 2.4 4.8-5.4" /></svg>);
const IcoClock = () => (<svg width={20} height={20} viewBox="0 0 24 24"><path {...sIco} d="M22.7 13.5L20.7005 11.5L18.7 13.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.3019 3 18.1885 4.77814 19.7545 7.42909M12 7V12L15 14" /></svg>);
const IcoVoice = () => (<svg width={20} height={20} viewBox="0 0 24 24"><path {...sIco} d="M3 10L3 14M7.5 11V13M12 6V18M16.5 3V21M21 10V14" /></svg>);
const IcoGear = () => (<svg width={20} height={20} viewBox="0 0 24 24"><path {...sIco} d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" /><path {...sIco} d="M18.7273 14.7273C18.6063 15.0015 18.5702 15.3056 18.6236 15.6005C18.6771 15.8954 18.8177 16.1676 19.0273 16.3818L19.0818 16.4364C19.2509 16.6052 19.385 16.8057 19.4765 17.0265C19.568 17.2472 19.6151 17.4838 19.6151 17.7227C19.6151 17.9617 19.568 18.1983 19.4765 18.419C19.385 18.6397 19.2509 18.8402 19.0818 19.0091C18.913 19.1781 18.7124 19.3122 18.4917 19.4037C18.271 19.4952 18.0344 19.5423 17.7955 19.5423C17.5565 19.5423 17.3199 19.4952 17.0992 19.4037C16.8785 19.3122 16.678 19.1781 16.5091 19.0091L16.4545 18.9545C16.2403 18.745 15.9682 18.6044 15.6733 18.5509C15.3784 18.4974 15.0742 18.5335 14.8 18.6545C14.5311 18.7698 14.3018 18.9611 14.1403 19.205C13.9788 19.4489 13.8921 19.7347 13.8909 20.0273V20.1818C13.8909 20.664 13.6994 21.1265 13.3584 21.4675C13.0174 21.8084 12.5549 22 12.0727 22C11.5905 22 11.1281 21.8084 10.7871 21.4675C10.4461 21.1265 10.2545 20.664 10.2545 20.1818V20.1C10.2475 19.7991 10.1501 19.5073 9.97501 19.2625C9.79991 19.0176 9.55521 18.8312 9.27273 18.7273C8.99853 18.6063 8.69437 18.5702 8.39947 18.6236C8.10456 18.6771 7.83244 18.8177 7.61818 19.0273L7.56364 19.0818C7.39478 19.2509 7.19425 19.385 6.97353 19.4765C6.7528 19.568 6.51621 19.6151 6.27727 19.6151C6.03834 19.6151 5.80174 19.568 5.58102 19.4765C5.36029 19.385 5.15977 19.2509 4.99091 19.0818C4.82186 18.913 4.68775 18.7124 4.59626 18.4917C4.50476 18.271 4.45766 18.0344 4.45766 17.7955C4.45766 17.5565 4.50476 17.3199 4.59626 17.0992C4.68775 16.8785 4.82186 16.678 4.99091 16.5091L5.04545 16.4545C5.25503 16.2403 5.39562 15.9682 5.4491 15.6733C5.50257 15.3784 5.46647 15.0742 5.34545 14.8C5.23022 14.5311 5.03887 14.3018 4.79497 14.1403C4.55107 13.9788 4.26526 13.8921 3.97273 13.8909H3.81818C3.33597 13.8909 2.87351 13.6994 2.53253 13.3584C2.19156 13.0174 2 12.5549 2 12.0727C2 11.5905 2.19156 11.1281 2.53253 10.7871C2.87351 10.4461 3.33597 10.2545 3.81818 10.2545H3.9C4.2009 10.2475 4.49273 10.1501 4.73754 9.97501C4.98236 9.79991 5.16883 9.55521 5.27273 9.27273C5.39374 8.99853 5.42984 8.69437 5.37637 8.39947C5.3229 8.10456 5.18231 7.83244 4.97273 7.61818L4.91818 7.56364C4.74913 7.39478 4.61503 7.19425 4.52353 6.97353C4.43203 6.7528 4.38493 6.51621 4.38493 6.27727C4.38493 6.03834 4.43203 5.80174 4.52353 5.58102C4.61503 5.36029 4.74913 5.15977 4.91818 4.99091C5.08704 4.82186 5.28757 4.68775 5.50829 4.59626C5.72901 4.50476 5.96561 4.45766 6.20455 4.45766C6.44348 4.45766 6.68008 4.50476 6.9008 4.59626C7.12152 4.68775 7.32205 4.82186 7.49091 4.99091L7.54545 5.04545C7.75971 5.25503 8.03183 5.39562 8.32674 5.4491C8.62164 5.50257 8.9258 5.46647 9.2 5.34545H9.27273C9.54161 5.23022 9.77093 5.03887 9.93245 4.79497C10.094 4.55107 10.1807 4.26526 10.1818 3.97273V3.81818C10.1818 3.33597 10.3734 2.87351 10.7144 2.53253C11.0553 2.19156 11.5178 2 12 2C12.4822 2 12.9447 2.19156 13.2856 2.53253C13.6266 2.87351 13.8182 3.33597 13.8182 3.81818V3.9C13.8193 4.19253 13.906 4.47834 14.0676 4.72224C14.2291 4.96614 14.4584 5.15749 14.7273 5.27273C15.0015 5.39374 15.3056 5.42984 15.6005 5.37637C15.8954 5.3229 16.1676 5.18231 16.3818 4.97273L16.4364 4.91818C16.6052 4.74913 16.8057 4.61503 17.0265 4.52353C17.2472 4.43203 17.4838 4.38493 17.7227 4.38493C17.9617 4.38493 18.1983 4.43203 18.419 4.52353C18.6397 4.61503 18.8402 4.74913 19.0091 4.91818C19.1781 5.08704 19.3122 5.28757 19.4037 5.50829C19.4952 5.72901 19.5423 5.96561 19.5423 6.20455C19.5423 6.44348 19.4952 6.68008 19.4037 6.9008C19.3122 7.12152 19.1781 7.32205 19.0091 7.49091L18.9545 7.54545C18.745 7.75971 18.6044 8.03183 18.5509 8.32674C18.4974 8.62164 18.5335 8.9258 18.6545 9.2V9.27273C18.7698 9.54161 18.9611 9.77093 19.205 9.93245C19.4489 10.094 19.7347 10.1807 20.0273 10.1818H20.1818C20.664 10.1818 21.1265 10.3734 21.4675 10.7144C21.8084 11.0553 22 11.5178 22 12C22 12.4822 21.8084 12.9447 21.4675 13.2856C21.1265 13.6266 20.664 13.8182 20.1818 13.8182H20.1C19.8075 13.8193 19.5217 13.906 19.2778 14.0676C19.0339 14.2291 18.8425 14.4584 18.7273 14.7273Z" /></svg>);
/** Code brackets — Developer report download. */
const IcoCode = () => (<svg width={20} height={20} viewBox="0 0 24 24"><path {...sIco} d="M16 18l6-6-6-6M8 6l-6 6 6 6" /></svg>);
const IcoPanel = () => (<svg width={20} height={20} viewBox="0 0 24 24"><path {...sIco} d="M15 3V21M7.8 3H16.2C17.8802 3 18.7202 3 19.362 3.32698C19.9265 3.6146 20.3854 4.07354 20.673 4.63803C21 5.27976 21 6.11984 21 7.8V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3Z" /></svg>);
const IcoDots = () => (<svg width={20} height={20} viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12Z" /><path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M17 12C17 10.8954 17.8954 10 19 10C20.1046 10 21 10.8954 21 12C21 13.1046 20.1046 14 19 14C17.8954 14 17 13.1046 17 12Z" /><path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M3 12C3 10.8954 3.89543 10 5 10C6.10457 10 7 10.8954 7 12C7 13.1046 6.10457 14 5 14C3.89543 14 3 13.1046 3 12Z" /></svg>);
const IcoChevronR = () => (<svg width={18} height={18} viewBox="0 0 24 24"><path {...sIco} d="m9 18l6-6l-6-6" /></svg>);

/* Menu row used by the ⋯ actions menu */
const MenuRow = ({ icon, label, sub, chevron, onClick, disabled }: { icon: React.ReactNode; label: string; sub?: string; chevron?: boolean; onClick?: () => void; disabled?: boolean }) => (
  <button
    type="button"
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '8px 14px',
      border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
      fontFamily: 'var(--font-family-primary)', color: 'var(--koala-text-primary)', opacity: disabled ? 0.45 : 1,
    }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--koala-bg-secondary)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
  >
    <span style={{ color: 'var(--koala-text-primary)', display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 15, fontWeight: 500, lineHeight: '20px' }}>{label}</span>
      {sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--koala-text-tertiary)', lineHeight: '16px' }}>{sub}</span>}
    </span>
    {chevron && <span style={{ color: 'var(--koala-text-tertiary)', display: 'inline-flex', flexShrink: 0 }}><IcoChevronR /></span>}
  </button>
);

/* Voice picker popover (Search voices / SERP based / Custom voices / Add Custom Voice) */
const Check18 = () => (<svg viewBox="0 0 20 20" width={18} height={18} style={{ marginLeft: 'auto' }}><path fill="var(--koala-text-primary)" fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" /></svg>);

const VoicePopover = ({ style }: { style?: React.CSSProperties }) => {
  const router = useRouter();
  const [voices, setVoices] = useState<{ id: string; name: string; description: string; isDefault: boolean }[]>([]);
  const [selected, setSelected] = useState('serp');
  const [q, setQ] = useState('');

  const { data: contentSettings } = useContentSettings();
  const seeded = useRef(false);
  useEffect(() => {
    if (!contentSettings || seeded.current) return;
    seeded.current = true;
    setVoices(contentSettings.voices as { id: string; name: string; description: string; isDefault: boolean }[]);
    const def = contentSettings.voices.find((v) => v.isDefault);
    if (def) setSelected(def.id);
  }, [contentSettings]);

  const ql = q.trim().toLowerCase();
  const filtered = ql ? voices.filter((v) => v.name.toLowerCase().includes(ql)) : voices;
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, fontWeight: 500, color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)', textAlign: 'left' };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: 'var(--koala-bg-primary)', borderRadius: 12, padding: '8px 0', minWidth: 280, maxWidth: 320,
        boxShadow: '0px 8px 24px rgba(24,26,34,0.16), 0px 2px 6px rgba(24,26,34,0.08)',
        animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)', fontFamily: 'var(--font-family-primary)', ...style,
      }}
    >
      <div style={{ padding: '4px 12px 8px' }}>
        <input
          placeholder="Search voices" value={q} onChange={(e) => setQ(e.target.value)} onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', height: 40, padding: '0 12px', boxSizing: 'border-box', borderRadius: 8, border: '1px solid var(--koala-border-secondary)', outline: 'none', fontSize: 14, fontFamily: 'var(--font-family-primary)', color: 'var(--koala-text-primary)' }}
        />
      </div>

      <div style={{ maxHeight: 240, overflowY: 'auto' }} className="styled-scrollbar">
        <div style={{ padding: '6px 16px 4px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--koala-text-disabled)', letterSpacing: '0.04em' }}>Built-in voices</div>
        <button type="button" onClick={() => setSelected('serp')} style={rowStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--koala-bg-secondary)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          <span style={{ flex: 1 }}>SERP based</span>
          {selected === 'serp' && <Check18 />}
        </button>
        {filtered.map((v) => (
          <button key={v.id} type="button" onClick={() => setSelected(v.id)} style={rowStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--koala-bg-secondary)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
            {selected === v.id && <Check18 />}
          </button>
        ))}
      </div>

      <div style={{ height: 1, background: 'var(--koala-bg-secondary)', margin: '4px 0' }} />
      <button type="button" onClick={() => router.push('/settings/custom_voices')} style={rowStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--koala-bg-secondary)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
        <svg viewBox="0 0 24 24" width={18} height={18}><path d="M12 5v14M5 12h14" stroke="var(--koala-text-primary)" strokeWidth={2} strokeLinecap="round" /></svg>
        Add Custom Voice
      </button>
    </div>
  );
};

/* ── Content Editor breadcrumb (replaces workspace switcher in the topbar) ── */
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

const BcChevron = () => (
  <svg className="ce-breadcrumb__chevron" viewBox="0 0 24 24" width={20} height={20} aria-hidden>
    <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M8.293 5.293a1 1 0 0 1 1.414 0l6 6a1 1 0 0 1 0 1.414l-6 6a1 1 0 0 1-1.414-1.414L13.586 12 8.293 6.707a1 1 0 0 1 0-1.414" />
  </svg>
);

const EditorBreadcrumb = ({ domain, title, keywords, language, createdAt, modifiedAt }: {
  domain: string; title: string; keywords: string[]; language?: string; createdAt?: string; modifiedAt?: string;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const loc = BC_COUNTRY[(language || 'pl').toLowerCase()] || BC_COUNTRY.en;
  const kwList = keywords.length ? keywords : [];

  return (
    <div className="ce-breadcrumb">
      <Link href="/dashboard" className="ce-breadcrumb__favicon">
        <img alt="" width={20} height={20} src={`https://www.google.com/s2/favicons?domain=${domain || 'ranksmile'}&sz=32`} />
      </Link>
      <div className="ce-breadcrumb__rest">
        <BcChevron />
        <Link href="/articles" className="ce-breadcrumb__trail">Articles</Link>
        <BcChevron />
        <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, position: 'relative' }}>
          <span className="ce-breadcrumb__current">{title || 'Untitled'}</span>
          <button type="button" aria-label="Article info" className="ce-breadcrumb__info" onClick={() => setOpen((v) => !v)}>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" /></svg>
          </button>

          {open && (
            <div className="ce-breadcrumb__popover" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span className="ce-breadcrumb__popover-label">Keywords{kwList.length ? ` (${kwList.length})` : ''}</span>
                  <span className="ce-breadcrumb__popover-value" style={{ wordBreak: 'break-word' }}>{kwList.length ? kwList.join(', ') : '—'}</span>
                </div>
                {kwList.length > 0 && (
                  <button
                    type="button"
                    aria-label="Copy keywords"
                    className="ce-breadcrumb__icon-btn"
                    onClick={() => { navigator.clipboard?.writeText(kwList.join(', ')); toast.success('Keywords copied'); }}
                  >
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}><path d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6" /></svg>
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span className="ce-breadcrumb__popover-label">Location</span>
                <span className="ce-breadcrumb__popover-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <img alt="" width={18} height={13} style={{ borderRadius: 2 }} src={`https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/${loc.cc}.svg`} />
                  {loc.name}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span className="ce-breadcrumb__popover-label">Last Modified</span>
                <span className="ce-breadcrumb__popover-value">{bcFmtDate(modifiedAt)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span className="ce-breadcrumb__popover-label">Created</span>
                <span className="ce-breadcrumb__popover-value">{bcFmtDate(createdAt)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ArticleEditorPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { data: domainsData } = useFetchDomains(router);
  const { data: appSettingsData } = useFetchSettings();
  const appSettings: SettingsType = appSettingsData?.settings || {};
  const domains: DomainType[] = domainsData?.domains || [];

  const editorRef = useRef<ArticleEditorHandle | null>(null);
  const getEditor = (): Editor | null => editorRef.current?.getEditor() ?? null;
  const pixabayCallbackRef = useRef<((img: { url: string; alt: string }) => void) | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false); // true while a save PUT is in flight (prevents overlapping saves)
  const lastSavedSig = useRef<string | null>(null);
  const lastVersionAt = useRef(0);
  const flushRef = useRef<((unload?: boolean) => void) | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [highlightTerms, setHighlightTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [autoSaveState, setAutoSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [showPixabay, setShowPixabay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [showInternalLinksPanel, setShowInternalLinksPanel] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  /** Toolbar Publish → WordPress export modal. */
  const [showWpExportModal, setShowWpExportModal] = useState(false);
  // Ranksmile docks into the right panel: ArticleEditor notifies open-state; the dock <div> is the portal target.
  const [ranksmileDockOpen, setRanksmileDockOpen] = useState(false);
  const [ranksmileDockEl, setRanksmileDockEl] = useState<HTMLElement | null>(null);
  const [showCustomization, setShowCustomization] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [actionsMenu, setActionsMenu] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [commentThreads, setCommentThreads] = useState<Thread[]>([]);
  const [commentsVersion, setCommentsVersion] = useState(0);
  // Comment identity = signed-in user + Google/GSC profile photo (same source as the topbar).
  const session = authClient.useSession?.();
  const [gscPicture, setGscPicture] = useState('');
  useEffect(() => {
    fetch('/api/gsc/accounts', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { const a = d?.accounts?.[0]; if (a?.picture) setGscPicture(a.picture); })
      .catch(() => {});
  }, []);
  const commentAuthor: CommentAuthor = useMemo(() => ({
    name: session?.data?.user?.name || session?.data?.user?.email || 'You',
    color: 'var(--koala-text-brand)',
    avatar: gscPicture || undefined,
  }), [session?.data?.user?.name, session?.data?.user?.email, gscPicture]);
  const actionsRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<HTMLDivElement>(null);
  const [domainBaseUrl, setDomainBaseUrl] = useState('');
  const [linkBar, setLinkBar] = useState<{ count: number; preLinkHtml: string; positions: number[] } | null>(null);
  const [linkNavIdx, setLinkNavIdx] = useState(0);
  // AI Readability "Apply All" → structure-only optimize, reviewed via its own bottom bar.
  const [isApplyingReadability, setIsApplyingReadability] = useState(false);
  const [readabilityBar, setReadabilityBar] = useState<{ preHtml: string } | null>(null);
  // Bumped when the readability optimize is Accepted → the panel marks its suggestions done.
  const [readabilityAcceptKey, setReadabilityAcceptKey] = useState(0);
  // "Compare versions" modal — ORIGINAL (pre-optimize) vs NEW (current editor) side-by-side diff.
  const [compareVersions, setCompareVersions] = useState<{ original: string; updated: string } | null>(null);
  // Plagiarism highlights pushed up from the Plagiarism panel → red underlines in the editor.
  const [plagSentences, setPlagSentences] = useState<string[]>([]);
  const [plagFocused, setPlagFocused] = useState<string | null>(null);
  const handlePlagiarismHighlight = useCallback((sentences: string[], focused: string | null) => {
    setPlagSentences(sentences);
    setPlagFocused(focused);
  }, []);
  const [isAutoOptimizing, setIsAutoOptimizing] = useState(false);
  const [autoOptimizeStatus, setAutoOptimizeStatus] = useState('Optimizing article…');
  // AO-7: section-by-section Auto-Optimize state machine (idle → optimizing → reviewing).
  // `isAutoOptimizing` stays true for the whole flow so autosave + the panel button-disable hold.
  const [optimizeState, setOptimizeState] = useState<'idle' | 'optimizing' | 'reviewing'>('idle');
  const preReviewHtmlRef = useRef<string>(''); // snapshot for AO-8 cancel/restore
  const optimizeMetaRef = useRef<{ changedCount: number; creditDeducted: boolean; promptVersion: string }>({ changedCount: 0, creditDeducted: false, promptVersion: '' });
  // AO-8b: results-panel inputs captured during the SSE run — pre-optimize content score
  // baseline (gauge/ScoreTrio delta) + the changed sections' display data (word-delta stats).
  const preScoreRef = useRef<number>(0);
  const preContentScoreRef = useRef<number>(0);
  const changedSectionsRef = useRef<Array<{ sectionId: string; headingText: string; oldHtml: string; newHtml: string }>>([]);
  // AO-8a: review lifecycle chrome — processed counter, save-in-flight, cancel-confirm modal.
  const [optimizeProgress, setOptimizeProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const [optimizeRemaining, setOptimizeRemaining] = useState(0); // unresolved contentOptimizer nodes (review label)
  const [optimizeDocTick, setOptimizeDocTick] = useState(0);
  const [optimizeSaving, setOptimizeSaving] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [savedBannerOpen, setSavedBannerOpen] = useState(false);
  const [ranksmileAiActive, setRanksmileAiActive] = useState(false);
  const [linksAiActive, setLinksAiActive] = useState(false);
  const [aiVisibilitySummary, setAiVisibilitySummary] = useState<AiVisibilitySummary | null>(null);
  const [coverageItems, setCoverageItems] = useState<CoverageItem[]>([]);
  const [coverageBuckets, setCoverageBuckets] = useState<BucketScore[]>([]);
  const [aiCoverageScore, setAiCoverageScore] = useState<number | null>(null);
  const [coverageSnapshot, setCoverageSnapshot] = useState<CoverageSnapshot | null>(null);
  const [isRunningAiVisibility, setIsRunningAiVisibility] = useState(false);
  const [articleKeywords, setArticleKeywords] = useState<string[]>([]);
  const [breadcrumbKeywords, setBreadcrumbKeywords] = useState<string[]>([]);
  const [analysisReloadKey, setAnalysisReloadKey] = useState(0);

  const onAnalysisComplete = useCallback(async () => {
    const articleId = typeof id === 'string' ? id : null;
    if (articleId) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          const r = await fetch(`/api/articles/${articleId}`);
          if (r.ok) {
            const data = await r.json();
            const art = data.article;
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
    toast.success('Analysis complete');
  }, [id]);
  const onAnalysisError = useCallback((message: string) => {
    toast.error(message);
    // Unlock the editor — failed runs may leave status='analyzing' in local state until refetch.
    setArticle((prev) => (prev ? { ...prev, status: 'draft' } : prev));
  }, []);

  const { ui: deepAnalysisUi, isAnalyzing: isDeepAnalyzing } = useBackgroundDeepAnalysis({
    articleId: article?.id ?? null,
    articleStatus: article?.status,
    metaUrl: article?.meta_url,
    targetKeyword: article?.target_keyword,
    enabled: !isLoading && !!article,
    onComplete: onAnalysisComplete,
    onError: onAnalysisError,
  });

  const editorLocked = isDeepAnalyzing;

  // Typed analysis phases for the side panel. The job row already carries them (the
  // sidecar's stage events are mapped in job-progress), so this only reads.
  const [analysisPhases, setAnalysisPhases] = useState<AnalysisPhases | null>(null);
  useEffect(() => {
    if (!id || Array.isArray(id) || !isDeepAnalyzing) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/articles/job-progress?articleId=${id}&jobType=deep_analysis`);
        if (!res.ok || cancelled) return;
        const data = await res.json() as { phases?: AnalysisPhases | null };
        if (data.phases && !cancelled) setAnalysisPhases(data.phases);
      } catch { /* the panel just keeps its last known phases */ }
    };
    tick().catch(() => {});
    const timer = setInterval(() => { tick().catch(() => {}); }, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [id, isDeepAnalyzing]);

  useEffect(() => {
    if (!isDeepAnalyzing) return;
    setPanelCollapsed(false);
    setShowHistory(false);
    setShowInternalLinksPanel(false);
  }, [isDeepAnalyzing]);

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

  // Article keywords — one shared/deduped fetch feeds both the breadcrumb info
  // popover and the internal-links panel.
  const { data: keywordRows } = useArticleKeywords(id);
  useEffect(() => {
    if (!keywordRows) return;
    setArticleKeywords(keywordRows.map((k) => k.keyword));
    setBreadcrumbKeywords(keywordRows.map((k) => k.keyword).filter(Boolean));
  }, [keywordRows]);

  // Comment count for the toolbar badge (shared comments left via the share link).
  useEffect(() => {
    if (!id) return;
    fetch(`/api/articles/${id}/comments`)
      .then(r => r.json())
      .then(d => setCommentThreads(d.threads || []))
      .catch(() => {});
  }, [id, commentsVersion]);

  // Listen for Pixabay open events dispatched from TipTap image node toolbar
  useEffect(() => {
    const handler = (e: Event) => {
      const { onSelect } = (e as CustomEvent).detail as { onSelect: (img: { url: string; alt: string }) => void };
      pixabayCallbackRef.current = onSelect;
      setShowPixabay(true);
    };
    window.addEventListener('ranksmile:open-pixabay', handler);
    return () => window.removeEventListener('ranksmile:open-pixabay', handler);
  }, []);

  // The Content Editor must scroll INTERNALLY (fixed dark shell + scrollable
  // body) at ALL widths, not just desktop. Opt <html> into the editor
  // height-chain while this page is mounted; cleanup restores normal page
  // scrolling for every other route.
  useEffect(() => {
    document.documentElement.classList.add('editor-route');
    return () => document.documentElement.classList.remove('editor-route');
  }, []);

  useEffect(() => {
    if (!id || Array.isArray(id)) return undefined;
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/articles/${id}`)
      .then((r) => r.json())
      .then(async (data) => {
        if (cancelled) return;
        // Unfinished New-Content wizard (draft has saved state, no body yet) → resume.
        // Outline review is the exception: the wizard sends the user here with an empty
        // draft on purpose, so resuming would bounce them back to writing-mode forever.
        const entry = resolveArticleEntry(data.article || {}, {
          outlineReview: router.query.reviewOutline === '1',
        });
        const resumeHref = articleEntryHref(String(id), entry);
        if (entry.kind === 'wizard' && resumeHref) {
          router.replace(resumeHref);
          return;
        }
        if (data.article) {
          let art = data.article as Article;
          if (art.status === 'analyzing') {
            const reconciled = await reconcileAnalyzingArticle(art);
            if (cancelled) return;
            if (reconciled.status !== art.status) {
              art = reconciled;
              fetch(`/api/articles/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'draft' }),
              }).catch(() => {});
            }
          }
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
          const snap = parseSnapshot(art.ai_info_to_cover);
          setCoverageItems(snap ? [...snap.items] : []);
          setCoverageBuckets(snap ? [...snap.buckets] : []);
          setAiCoverageScore(snap?.overall ?? null);
          setCoverageSnapshot(snap ?? null);
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
            Promise.all([
              fetch(`/api/domains`).then((r) => r.json()),
              fetch(`/api/articles?domainId=${art.domain_id}`).then((r) => r.json()),
            ])
              .then(([dd, d]) => {
                const dom = (dd.domains || []).find((d: DomainType) => d.ID === art.domain_id);
                if (dom?.domain) setDomainBaseUrl(`https://${dom.domain}`);
                const others = (d.articles || [])
                  .filter((a: { id: number; status?: string }) => a.id !== art.id && a.status === 'published')
                  .map((a: { id: number; title: string; meta_url?: string | null }) => ({ id: a.id, title: a.title, url: a.meta_url || '' }));
                setInternalArticles(others);
              })
              .catch(() => {});
          }

          // Preload competitor outlines during editor setup (not on panel click).
          if (art.target_keyword && art.id) {
            let hasCache = false;
            if (art.competitor_outlines_cache) {
              try {
                const parsed = JSON.parse(art.competitor_outlines_cache);
                const list = Array.isArray(parsed) ? parsed : (parsed.competitors || []);
                hasCache = list.length > 0;
              } catch { /* fetch below */ }
            }
            if (!hasCache) {
              void fetch('/api/articles/competitor-outlines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  keyword: art.target_keyword,
                  language: art.language || 'pl',
                  num: 5,
                  articleId: art.id,
                }),
              })
                .then((compRes) => compRes.json())
                .then((compData: { competitors?: unknown[] }) => {
                  if (compData.competitors?.length) {
                    setArticle((prev) => (prev ? {
                      ...prev,
                      competitor_outlines_cache: JSON.stringify(compData.competitors),
                    } : prev));
                  }
                })
                .catch(() => {});
            }
          }
        }
      }
      )
      .catch(() => {
        if (!cancelled) toast.error('Failed to load article');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
    // router.replace is stable enough to omit — including `router` re-runs this effect
    // and remounts the TipTap loader on every route object identity change.
  }, [id, analysisReloadKey]);

  useEffect(() => {
    if (!actionsMenu && !voiceOpen) return undefined;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (voiceOpen && voiceRef.current && !voiceRef.current.contains(t)) setVoiceOpen(false);
      if (actionsMenu && actionsRef.current && !actionsRef.current.contains(t)) { setActionsMenu(false); setVoiceOpen(false); }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [actionsMenu, voiceOpen]);

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

  // The parent re-renders on every editor keystroke (setEditorHtml). Memoize the per-render work
  // that fed ContentScorePanel — a full-HTML regex and two JSON.parse of cached blobs — so it only
  // recomputes when its actual input changes (was running on every keystroke).
  const internalLinksCount = useMemo(() => (editorHtml.match(/<a\s[^>]*href=/gi) || []).length, [editorHtml]);

  /** Main centre gauge — same formula as AO live snapshot / Save. */
  const liveContentScore = useMemo(() => {
    if (!scoreData) return 0;
    const keyword = article?.target_keyword || '';
    return scoreArticleHtml({
      html: editorHtml,
      scoreData,
      keyword,
      coverageItems: filterSyntheticCitationTemplates(coverageItems, keyword),
      answersMainQuestionEarly: coverageSnapshot?.answersMainQuestionEarly,
      internalLinksCount,
    }).seo;
  }, [editorHtml, scoreData, article?.target_keyword, coverageItems, coverageSnapshot, internalLinksCount]);

  // Live AI Search checklist + score — re-derive covered/overall from editor text.
  // Without this, emptied articles kept frozen snap.overall (e.g. 34) and "Covered" flags.
  const liveAiCoverage = useMemo(() => {
    const keyword = article?.target_keyword || '';
    const baseItems = filterSyntheticCitationTemplates(coverageItems, keyword);
    if (!baseItems.length) {
      return { items: baseItems, buckets: coverageBuckets, overall: null as number | null };
    }
    const scored = scoreArticleHtml({
      html: editorHtml,
      scoreData: scoreData || {
        terms: [], words_target: 1, words_min: 1, words_max: 1,
        headings_target: 1, headings_min: 1, headings_max: 1,
      },
      keyword,
      coverageItems: baseItems,
      answersMainQuestionEarly: coverageSnapshot?.answersMainQuestionEarly,
    });
    const { overall, buckets } = computeCoverageScores(
      scored.liveItems,
      !!coverageSnapshot?.answersMainQuestionEarly,
    );
    return { items: scored.liveItems, buckets, overall };
  }, [coverageItems, editorHtml, coverageBuckets, coverageSnapshot, article?.target_keyword, scoreData]);

  // AO-8b: unified live scores during Auto-Optimize — one synchronous pass keeps SEO, AI, and overall aligned.
  // Gate overlays until the editor actually differs from the pre-run HTML (no fake ↑ before edits).
  const aoLiveSnapshot = useMemo(() => {
    if (optimizeState === 'idle' || !scoreData) return null;
    const keyword = article?.target_keyword || '';
    return computeOptimizeLiveSnapshot({
      editorHtml,
      scoreData,
      keyword,
      coverageItems: filterSyntheticCitationTemplates(coverageItems, keyword),
      coverageSnapshot,
      aiVisibilitySummary,
      substitutePlaceholders: substituteOptimizerPlaceholders,
    });
  }, [optimizeState, editorHtml, scoreData, article?.target_keyword, coverageItems, coverageSnapshot, aiVisibilitySummary, optimizeDocTick]);

  const aoScoresReady = optimizeState === 'reviewing'
    || (optimizeState === 'optimizing' && editorHtml !== preReviewHtmlRef.current && optimizeProgress.processed > 0);

  // Floating "Optimization Impact +N" chip — side effect only; scores come from aoLiveSnapshot.
  const [aoFloat, setAoFloat] = useState<{ key: number; label: string } | null>(null);
  // First/current streaming section id (from meta/section SSE events) — drives the bar subtitle (Task 12).
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  /** Section currently being scanned (shimmer) — 1-based index drives the bottom bar. */
  const [scanningSectionId, setScanningSectionId] = useState<string | null>(null);
  // Run-start AI-visibility baseline (frozen overall) → gates the gauge's cumulative ↑N via scoreDeltaGate.
  const aiVisibilityBaselineRef = useRef<number>(0);
  // Previous tick's aiNew — gates the float via THIS tick's delta (not the cumulative run total).
  // Initialized to the same value as aiVisibilityBaselineRef.current at run start.
  const prevAiRef = useRef<number>(0);
  // Monotonic counter for the float's React `key` (Date.now() could collide across fast ticks).
  const floatSeqRef = useRef<number>(0);
  // Attribution "before" buckets — run-start baseline, advanced to the current buckets on each Accept.
  const attributionBeforeRef = useRef<BucketScore[]>([]);

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

  const initialPlagiarism = useMemo(() => parseJsonish<PlagiarismResult>(article?.plagiarism_json), [article?.plagiarism_json]);
  const initialAiReadability = useMemo(() => parseJsonish<AiReadabilityResult>(article?.ai_readability_json), [article?.ai_readability_json]);

  const handleRestoreVersion = (version: { id: number; content: string; score_data: string | null }) => {
    const editor = editorRef.current?.getEditor();
    // emitUpdate:true → fires onUpdate → handleEditorChange → autosave persists the restored content.
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

  // ── Shared persistence used by both auto-save and programmatic saves ──
  // keepalive is opt-in: it lets a request survive page teardown (tab-hide / unload / nav) but caps
  // the body at ~64KB. Normal autosaves MUST NOT use it — a long article exceeds 64KB and the
  // browser would silently drop every save. Only the unload flush passes keepalive (small delta).
  const doSave = async (
    versionType?: string,
    opts?: { keepalive?: boolean },
    // AO-8a: optional run metadata embedded into the snapshot's score_data (Auto-Optimize Save).
    versionMeta?: { changes: number; promptVersion: string; creditDeducted: boolean },
    // AO-8a: explicit content snapshot so the Auto-Optimize Save persists the freshly-resolved
    // doc without waiting for the editor's async onChange to settle React state.
    contentOverride?: { html: string; text: string; words: number; headings: number; paragraphs: number },
  ) => {
    if (!id) return false;
    const html = contentOverride?.html ?? editorHtml;
    const text = contentOverride?.text ?? plainText;
    // Update current_count for each term + store computed score so list view stays in sync
    const updatedTerms = scoreData.terms.map((t) => ({
      ...t,
      current_count: countOccurrences(text, t.term),
    }));
    const keyword = article?.target_keyword || '';
    const scored = scoreArticleHtml({
      html,
      scoreData: { ...scoreData, terms: updatedTerms },
      keyword,
      coverageItems: filterSyntheticCitationTemplates(coverageItems, keyword),
      answersMainQuestionEarly: coverageSnapshot?.answersMainQuestionEarly,
    });
    const updatedScoreData: ScoreData & { _heading_count?: number; _paragraph_count?: number; _computed_score?: number; _content_score?: number; _ao_meta?: { changes: number; promptVersion: string; creditDeducted: boolean } } = {
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
    if (versionMeta) updatedScoreData._ao_meta = versionMeta;

    // Persist internal links panel state from localStorage
    let internalLinksCache: object | undefined;
    try {
      const raw = localStorage.getItem(`internal-links-${id}`);
      if (raw) internalLinksCache = JSON.parse(raw);
    } catch { /* ignore */ }

    const res = await fetch(`/api/articles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      ...(opts?.keepalive ? { keepalive: true } : {}), // only on unload (best-effort, <64KB body cap)
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
    setScoreData(updatedScoreData);
    setArticle((prev) => (prev ? {
      ...prev,
      content_score: contentScore,
      score_data: JSON.stringify(updatedScoreData),
      word_count: scored.words,
    } : prev));
    return true;
  };

  // ── Auto-save: persist silently after edits settle. A version snapshot is
  // created at most once every 2 min of editing so Version History stays useful
  // without flooding it on every keystroke. ──
  const autoSave = async (sig: string, opts?: { unload?: boolean }) => {
    // Never run two saves at once. If one is already in flight, skip — the finally-block below
    // re-checks for newer edits (flushRef) once it finishes, so nothing typed mid-save is lost.
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
      // Self-heal transient blips: retry shortly instead of waiting for the next edit.
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => { void autoSave(sig); }, 3000);
    } finally {
      savingRef.current = false;
    }
    // Coalesce ONLY on success: persist anything edited while this save ran (flushRef reads the
    // latest state). On failure the 3s retry handles it — re-flushing here would tight-loop.
    if (ok) flushRef.current?.();
  };

  // Debounced auto-save: fires ~1s after the last edit to content / meta / image.
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
    // Record the loaded state as the baseline without saving it.
    if (lastSavedSig.current === null) { lastSavedSig.current = sig; return undefined; }
    if (sig === lastSavedSig.current || isAutoOptimizing) return undefined;
    setAutoSaveState('unsaved');
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => { void autoSave(sig); }, 800);
    return () => { if (autoTimer.current) clearTimeout(autoTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorHtml, featuredImage, article?.meta_title, article?.meta_description, article?.target_keyword, article?.meta_url, isLoading, isAutoOptimizing]);

  // Always-fresh "save the latest state if it's dirty" — used by the flush triggers below.
  // unload=true → the page is going away, so the PUT must outlive it (keepalive).
  flushRef.current = (unload?: boolean) => {
    if (isLoading || !article || isAutoOptimizing) return;
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

  // Flush pending edits immediately on tab-hide / close, in-app navigation, and Cmd/Ctrl+S —
  // so changes are never lost to the debounce window (the main gap vs. Ranksmile-style autosave).
  useEffect(() => {
    // Page-teardown flushes (tab-hide / close / in-app nav) need keepalive so the PUT survives;
    // Cmd/Ctrl+S is a manual save while the page stays, so it uses a normal (uncapped) request.
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

  const openPublishPanel = useCallback(async () => {
    try { await doSave(); } catch { /* open anyway */ }
    if (ranksmileDockOpen) editorRef.current?.toggleRanksmile?.();
    setShowHistory(false);
    setShowInternalLinksPanel(false);
    setVoiceOpen(false);
    setActionsMenu(false);
    setShowWpExportModal(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- doSave closes over latest editor state
  }, [ranksmileDockOpen]);

  const handleDownloadDeveloperReport = useCallback(() => {
    if (!article) {
      toast.error('Article not loaded');
      return;
    }
    try {
      const keyword = article.target_keyword || '';
      const report = buildDeveloperReport({
        article: {
          id: article.id,
          domain_id: article.domain_id,
          title: article.title,
          status: article.status,
          target_keyword: article.target_keyword,
          meta_title: article.meta_title,
          meta_description: article.meta_description,
          meta_url: article.meta_url,
          language: article.language,
          content_score: article.content_score,
          word_count: article.word_count,
          featured_image: article.featured_image,
          publish_target: article.publish_target,
          publish_url: article.publish_url,
          created_at: article.created_at,
          updated_at: article.updated_at,
          score_data_raw: article.score_data,
          competitor_outlines_cache: article.competitor_outlines_cache,
          ai_info_to_cover_raw: article.ai_info_to_cover ?? null,
          plagiarism_json: article.plagiarism_json ?? null,
          ai_readability_json: article.ai_readability_json ?? null,
        },
        html: editorHtml,
        plainText,
        wordCount,
        headingCount,
        paragraphCount,
        internalLinksCount,
        scoreData,
        coverageItems: filterSyntheticCitationTemplates(coverageItems, keyword),
        coverageBuckets: liveAiCoverage.buckets,
        coverageSnapshot,
        aiVisibilitySummary,
        aiCoverageScore: liveAiCoverage.overall ?? aiCoverageScore,
      });
      downloadDeveloperReport(report, article.id);
      toast.success('Developer report downloaded');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to build report');
    }
  }, [
    article,
    editorHtml,
    plainText,
    wordCount,
    headingCount,
    paragraphCount,
    internalLinksCount,
    scoreData,
    coverageItems,
    liveAiCoverage.buckets,
    liveAiCoverage.overall,
    coverageSnapshot,
    aiVisibilitySummary,
    aiCoverageScore,
  ]);

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

  // "Apply All" from the AI Readability panel — send the suggestions to the sidecar, which
  // rewrites the article HTML applying them (structure only), then show the review bar.
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
      if (data.warning) { toast(data.warning, { icon: '⚠️' }); return; } // content unchanged → no review bar
      try { editor.commands.setContent(data.content); } catch { /* noop */ }
      setReadabilityBar({ preHtml });
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Could not apply suggestions');
    } finally {
      setIsApplyingReadability(false);
    }
  };

  // Open the side-by-side diff of a pre-optimize snapshot vs. the current editor content.
  const openCompareVersions = (preHtml: string) => {
    const editor = getEditor();
    setCompareVersions({ original: preHtml, updated: editor ? editor.getHTML() : '' });
  };
  // Shared "Compare versions" button for the Auto-Optimize and Optimize-AI-Readability bars.
  const compareVersionsButton = (preHtml: string) => (
    <button
      type="button"
      onClick={() => openCompareVersions(preHtml)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--koala-bg-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '6px 8px', borderRadius: 6, transition: 'color 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--koala-text-disabled)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--koala-bg-primary)'; }}
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

    // Build a flat text map: full concatenated text + offset→docPos mapping
    // This handles anchor text that spans ProseMirror node boundaries
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

  // AO-7: section-by-section Auto-Optimize. Streams /api/articles/optimize-sections, collects
  // ordered section events, then loads a "review doc" where each CHANGED section becomes a
  // contentOptimizer node (Accept/Reject). isAutoOptimizing spans the whole flow so autosave +
  // the format toolbar stay suspended until every section is resolved (Step D) or we bail out.
  const handleAutoOptimizeSections = async () => {
    const editor = getEditor();
    if (!editor) return;
    const preHtml: string = editor.getHTML();
    preReviewHtmlRef.current = preHtml;
    // AO-8b: snapshot the pre-optimize scores with the SAME formula as live gauges / Save.
    const keyword = article?.target_keyword || '';
    const preScored = scoreData
      ? scoreArticleHtml({
        html: preHtml,
        scoreData,
        keyword,
        coverageItems: filterSyntheticCitationTemplates(coverageItems, keyword),
        answersMainQuestionEarly: coverageSnapshot?.answersMainQuestionEarly,
      })
      : null;
    preScoreRef.current = preScored?.seo ?? 0;
    const hasAiBaseline = (preScored?.liveItems.length ?? 0) > 0
      || aiCoverageScore != null
      || !!(aiVisibilitySummary && aiVisibilitySummary.prompts_total > 0)
      || (scoreData?.ai_score != null);
    preContentScoreRef.current = preScored
      ? (hasAiBaseline ? preScored.overall : preScored.seo)
      : 0;
    // Task 11: capture the run-start AI baseline (gates the "Optimization Impact" float) and the
    // run-start attribution "before" buckets (re-scored from the pre-optimize content so the first
    // Accept's attribution measures against a like-for-like baseline). Reset per-run float state.
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
    setScanningSectionId(null);
    changedSectionsRef.current = [];
    optimizeStore.clear();
    setOptimizeState('optimizing');
    setIsAutoOptimizing(true);
    setOptimizeProgress({ processed: 0, total: 0 });
    setAutoOptimizeStatus('Optimizing article…');
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
      setScanningSectionId(null);
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
        body: JSON.stringify({ content: preHtml, articleId: article?.id, scoreData, targetScore: 90, maxRounds: 4 }),
        signal: aoSignal,
      });
      // Org-wide AI budget exhausted — surface the same message the legacy flow uses, then bail.
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
              setScoreData((prev) => ({
                ...prev,
                terms: enrichedTerms.map((t) => ({
                  ...t,
                  current_count: countOccurrences(plain, t.term),
                })),
              }));
            }
          } else if (eventType === 'meta') {
            const m = payload as { total: number; wholeArticle?: boolean };
            setOptimizeProgress({ processed: 0, total: m.total });
          } else if (eventType === 'section') {
            const ev = payload as SectionEvent;
            orderedEvents.push(ev);
            optimizeStore.set(ev.sectionId, {
              oldHtml: ev.oldHtml, newHtml: ev.newHtml, changed: ev.changed,
              focus: ev.focus, mode: ev.mode, reason: ev.reason,
            });
            if (ev.changed) {
              changedSectionsRef.current.push({ sectionId: ev.sectionId, headingText: ev.headingText, oldHtml: ev.oldHtml, newHtml: ev.newHtml });
            }
          } else if (eventType === 'progress') {
            const p = payload as {
              round: number; processed?: number; seo: number; ai: number; content: number;
              targetContent?: number; targetSeo?: number; changed?: number;
            };
            setOptimizeProgress((prev) => ({
              processed: p.processed ?? p.round,
              total: prev.total || p.round,
            }));
            // Don't flash baseline scores before any HTML change — wait for a real edit.
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
              wholeArticle?: boolean; outcome?: string; userMessage?: string;
            };
            optimizeMetaRef.current = { changedCount: meta.changedCount, creditDeducted: meta.creditDeducted, promptVersion: meta.promptVersion };
            setScanningSectionId(null);
            if (meta.changedCount > 0) {
              // Per-section contentOptimizer atoms → ContentOptimizerNodeView wordDiff
              // (same red/green marks as CompareVersions / See changes). Never dump raw newHtml.
              for (const ev of orderedEvents) {
                optimizeStore.set(ev.sectionId, {
                  oldHtml: ev.oldHtml, newHtml: ev.newHtml, changed: ev.changed,
                  focus: ev.focus, mode: ev.mode, reason: ev.reason,
                });
              }
              const reviewHtml = buildReviewDoc(orderedEvents);
              try { editor.commands.setContent(reviewHtml, { emitUpdate: false }); } catch (e) { console.error('[optimize-sections] setContent error', e); }
              setEditorHtml(reviewHtml);
              setOptimizeDocTick((t) => t + 1);
              setOptimizeState('reviewing');
              const nChanged = orderedEvents.filter((e) => e.changed).length;
              const statusMsg = meta.userMessage
                || (meta.outcome === 'faq_only'
                  ? 'Incomplete — FAQ only; review carefully before Save'
                  : `Review ${nChanged} section${nChanged === 1 ? '' : 's'}…`);
              setAutoOptimizeStatus(statusMsg);
              setOptimizeRemaining(nChanged);
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
      // Stream ended without a done event — treat as no-op.
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

  // AO-7 Step D: while reviewing, count remaining contentOptimizer nodes. When the user has
  // resolved (Accept/Reject) every section → none remain → return to idle and resume autosave,
  // which persists the now-clean document. The editor mounts asynchronously (dynamic import) and
  // can remount mid-review, so poll-bind the listener like the caret binder above — otherwise the
  // review could never complete and isAutoOptimizing would stay stuck true (autosave dead).
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

  // ── AO-8a: review lifecycle commands ──────────────────────────────────────
  // Resolve every remaining contentOptimizer node to its optimized (newHtml) version.
  // Splice from HIGHEST pos to LOWEST so earlier replacements don't invalidate later
  // positions. When the last node is resolved the review-completion effect above sees
  // zero nodes and transitions back to idle — we never duplicate that logic here.
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

  // Jump the caret to the next/prev unresolved section and scroll it into view.
  const navigateSection = (dir: 1 | -1) => {
    const editor = getEditor();
    if (!editor) return;
    // collectOptimizerPositions returns DESCENDING; reverse for document order.
    const refs = collectOptimizerPositions(editor.state.doc as PMDocLike)
      .filter((r) => r.status === 'improved' || r.status === 'pending' || r.status === 'active')
      .slice().reverse();
    if (!refs.length) return;
    const caret = editor.state.selection.from;
    const targetRef = dir === 1
      ? (refs.find((r) => r.pos > caret) ?? refs[0])
      : ([...refs].reverse().find((r) => r.pos < caret) ?? refs[refs.length - 1]);
    // Task 12: TipTap's tr.scrollIntoView() is an instant native scroll with no smooth/reduced-motion
    // option, so set the caret via PM but perform the actual scroll via the DOM-level helper (same one
    // Task 9's adjustments-card click uses) so prev/next nav is smooth (instant under reduced motion).
    editor.chain().focus().setTextSelection(targetRef.pos).run();
    scrollToOptimizerSection(targetRef.sectionId);
  };

  // Cancel: abort in-flight AO, restore pre-optimize article, discard suggestions.
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
    setScanningSectionId(null);
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

  // Save: resolve any remaining sections (so persisted HTML never contains placeholder
  // divs), then persist the resolved doc as an `auto_optimize` version snapshot with run
  // metadata embedded in score_data. The review-completion effect handles the idle exit.
  const handleSaveOptimizeRun = async () => {
    const editor = getEditor();
    if (!editor) return;
    setOptimizeSaving(true);
    try {
      resolveAllOptimizerNodes(); // resolve-all FIRST → no contentOptimizer atoms remain
      const html: string = editor.getHTML();
      setEditorHtml(html); // keep page state in sync (effect will also sync on transition)
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
        { changes: optimizeMetaRef.current.changedCount, promptVersion: optimizeMetaRef.current.promptVersion, creditDeducted: optimizeMetaRef.current.creditDeducted },
        { html, text, words, headings, paragraphs },
      );
      // We just persisted the resolved doc AND created a version. Mark this exact state as
      // saved so the debounced autosave (which re-arms once isAutoOptimizing flips false and
      // editorHtml has changed) sees no diff — preventing a redundant PUT and a spurious
      // `manual_save` version stacked on top of this `auto_optimize` one. sig shape MUST match
      // the autosave/flush effect's { h, t, d, k, u, img }.
      lastSavedSig.current = JSON.stringify({
        h: html,
        t: article?.meta_title ?? '',
        d: article?.meta_description ?? '',
        k: article?.target_keyword ?? '',
        u: article?.meta_url ?? '',
        img: featuredImage?.url ?? null,
      });
      lastVersionAt.current = Date.now(); // a racing autosave must not snapshot another version
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

  // AO-8a exit-guard: warn before leaving (tab close / reload) while a review is unresolved,
  // so suggested changes aren't silently lost. Active only during the reviewing state.
  useEffect(() => {
    if (optimizeState !== 'reviewing') return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [optimizeState]);

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
      <AppShell
        domains={domains}
        showAddModal={() => {}}
        showSettings={() => {}}
        showSidebar={false}
        topbarTitle=""
        contentClassName="article-editor-shell"
        hideMobileNav
      >
        {/* Ranksmile-style loading screen inside the editor gray wrapper */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 8, position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', background: 'var(--koala-bg-primary)', borderRadius: 12, border: '1px solid var(--koala-border-primary)', overflow: 'hidden' }}>
            <EditorLoading />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!article) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--koala-bg-secondary)', gap: 16 }}>
        <p style={{ color: 'var(--koala-text-disabled)' }}>Article not found.</p>
        <Link href="/articles"><a style={{ color: 'var(--color-surface-raised)' }}>← Back to list</a></Link>
      </div>
    );
  }

  const PANEL_W = 320;
  const PANEL_GAP = 4; // 0.25rem

  return (
    <AppShell
      domains={domains}
      showAddModal={() => setShowAddDomain(true)}
      showSettings={() => setShowSettings(true)}
      showSidebar={false}
      topbarTitle={article.target_keyword || article.title}
      breadcrumb={(
        <EditorBreadcrumb
          domain={domains.find((d) => d.ID === article.domain_id)?.domain || ''}
          title={article.target_keyword || article.title}
          keywords={breadcrumbKeywords.length ? breadcrumbKeywords : (article.target_keyword ? [article.target_keyword] : [])}
          language={article.language}
          createdAt={article.created_at}
          modifiedAt={article.updated_at}
        />
      )}
      contentClassName="article-editor-shell"
      hideMobileNav
    >
      <style>{`
        @keyframes barPulse {
          0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
          50%       { transform: scaleY(1.4); opacity: 1; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Ranksmile-SEO-style image NodeView ──────────────────────── */
        [data-ranksmile-image] { margin: 0.5rem 0; }
        .ranksmile-image-group {
          display: flex; flex-direction: column; gap: 0.5rem;
          background: var(--koala-bg-primary); border-radius: 0.5rem; overflow: hidden;
          padding-bottom: 0.25rem;
          position: relative;
        }
        .ProseMirror-selectednode .ranksmile-image-group {
          outline: 2px solid var(--koala-border-focus); border-radius: 0.5rem;
        }
        .ranksmile-image-container {
          position: relative; overflow: hidden;
          transition: all 0.2s ease-in-out;
        }
        .group:hover .ranksmile-image-container { border-radius: 0; }
        .ranksmile-image-overlay {
          position: absolute; inset: 0; z-index: 4;
          background: var(--koala-text-primary); opacity: 0;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.1s ease-in-out;
          border-radius: 0;
        }
        .group:hover .ranksmile-image-overlay {
          opacity: 0.24;
          border-bottom-right-radius: 0.75rem;
          border-bottom-left-radius: 0.75rem;
        }
        .ranksmile-image-img {
          display: block; width: 100%; height: auto; min-height: 100px;
          max-width: 100%; object-fit: cover; aspect-ratio: 16 / 9;
          transition: border-radius 0.2s ease-in-out;
        }
        .group:hover .ranksmile-image-img {
          border-bottom-right-radius: 0.75rem;
          border-bottom-left-radius: 0.75rem;
        }
        .ranksmile-image-toolbar {
          position: absolute; bottom: 0; z-index: 5; width: 100%;
          overflow: hidden; max-height: 0;
          transition: max-height 0.1s ease-in-out;
        }
        .group:hover .ranksmile-image-toolbar { max-height: 300px; }
        .ranksmile-toolbar-inner {
          display: flex; flex-direction: column; gap: 1px;
          background: var(--koala-bg-primary); border-radius: 0.5rem;
        }
        .ranksmile-toolbar-prompt-row {
          display: flex; align-items: flex-end; justify-content: space-between;
          min-height: 48px; padding: 0.5rem 0.75rem;
          background: var(--koala-bg-secondary); border-radius: 0.5rem 0.5rem 0 0;
        }
        .ranksmile-toolbar-prompt-icon {
          display: flex; align-items: flex-end; justify-content: center;
          width: 21px; height: 100%; padding-bottom: 0.375rem;
          color: var(--koala-text-secondary); flex-shrink: 0;
        }
        .ranksmile-toolbar-prompt-input {
          flex: 1; min-height: 28px; border: none; background: transparent;
          padding: 0.25rem 0; font-size: 0.875rem; line-height: 1.25rem;
          color: var(--koala-text-primary); resize: none; outline: none;
          font-family: var(--font-family-primary);
          box-shadow: none;
        }
        .ranksmile-toolbar-prompt-input::placeholder { color: var(--koala-text-secondary); }
        .ranksmile-toolbar-send-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 0.375rem; border: none; border-radius: 0.375rem;
          background: var(--koala-bg-secondary); color: var(--koala-text-primary); cursor: pointer;
          flex-shrink: 0; transition: background 0.15s;
        }
        .ranksmile-toolbar-send-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ranksmile-toolbar-send-btn:not(:disabled):hover { background: var(--koala-border-primary); }
        .ranksmile-toolbar-actions-row {
          display: flex; align-items: center; gap: 0.5rem;
          height: 48px; padding: 0.5rem 0.75rem;
          background: var(--koala-bg-secondary); border-radius: 0 0 0.5rem 0.5rem;
        }
        .ranksmile-toolbar-actions-left {
          display: flex; align-items: center; gap: 0.5rem; flex: 1;
        }
        .ranksmile-toolbar-actions-right {
          display: flex; align-items: center; gap: 0.125rem;
        }
        .ranksmile-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 0.25rem 0.75rem; border: none; border-radius: 0.375rem;
          font-size: 0.8125rem; line-height: 1rem; font-weight: 600;
          font-family: var(--font-family-primary); cursor: pointer;
          transition: background 0.15s; white-space: nowrap;
        }
        .ranksmile-btn-ghost {
          background: var(--koala-bg-secondary); color: var(--koala-text-primary);
        }
        .ranksmile-btn-ghost:hover { background: var(--koala-border-primary); }
        .ranksmile-btn-ghost:active { background: var(--koala-border-secondary); }
        .ranksmile-toolbar-drag-text {
          font-size: 0.875rem; line-height: 1.25rem; color: var(--koala-text-secondary);
          overflow: hidden; white-space: nowrap;
        }
        .ranksmile-btn-delete {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 0.375rem; border: none; border-radius: 0;
          background: transparent; color: inherit; cursor: pointer;
          transition: opacity 0.15s;
        }
        .ranksmile-btn-delete:hover { opacity: 0.8; }
        .ranksmile-audio-bars { display: flex; gap: 0.125rem; }
        .ranksmile-audio-bar { width: 4px; height: 12px; background: var(--koala-status-success); }
        /* ── Glow effect during AI image generation ─────────────── */
        @keyframes ranksmileGlow {
          0%, 100% { box-shadow: 0 0 15px color-mix(in srgb, var(--koala-text-brand) 30%, transparent), 0 0 35px color-mix(in srgb, var(--koala-text-brand) 15%, transparent); }
          50%      { box-shadow: 0 0 25px color-mix(in srgb, var(--koala-text-brand) 50%, transparent), 0 0 55px color-mix(in srgb, var(--koala-text-brand) 30%, transparent); }
        }
        .ranksmile-image-generating .ranksmile-image-group::before {
          content: '';
          position: absolute;
          inset: -8px;
          z-index: -1;
          pointer-events: none;
          border-radius: 0.625rem;
          animation: ranksmileGlow 1.5s ease-in-out infinite;
        }
        .ranksmile-image-generating.ranksmile-image-group {
          overflow: visible;
        }
        .ranksmile-alt-row {
          display: flex; align-items: center; height: 20px;
          padding-right: 0.5rem; gap: 0;
        }
        .ranksmile-alt-input {
          flex: 1; border: none; outline: none; padding-right: 0.75rem;
          font-size: 0.875rem; line-height: 1.25rem; color: var(--koala-text-secondary);
          background: transparent; font-family: var(--font-family-primary);
        }
        .ranksmile-alt-input::placeholder { color: var(--koala-text-secondary); }
        .ranksmile-alt-input:disabled { background: var(--koala-bg-primary); }
        .ranksmile-alt-clear-btn {
          display: inline-flex; align-items: center; justify-content: center;
          border: none; border-radius: 0; background: transparent;
          padding: 0; font-size: 0.875rem; line-height: 1.25rem;
          color: var(--koala-text-secondary); cursor: pointer; font-family: var(--font-family-primary);
          font-weight: 600; visibility: hidden; white-space: nowrap;
          transition: color 0.15s;
        }
        .group:hover .ranksmile-alt-clear-btn { visibility: visible; }
        .ranksmile-alt-clear-btn:hover { color: var(--koala-bg-inverse); }
        .ranksmile-alt-clear-btn:active { color: var(--koala-text-primary); }
      `}</style>

      {/* ── Editor workspace ─────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: 4,
          gap: 0,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 0,
        }}
      >

        <Head>
          <title>{`${article.meta_title || article.title || 'Editor'} – Ranksmile`}</title>
          {article.schema_json && (() => {
            try {
              const schema = JSON.parse(article.schema_json);
              return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema, null, 2) }} />;
            } catch { return null; }
          })()}
        </Head>

        {/* ── Main content row ─────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}>

          {/* ── Auto-save status (floating, bottom-left) — only while saving/unsaved ── */}
          {autoSaveState !== 'saved' && (
          <div
            title={autoSaveState === 'saving' ? 'Saving…' : 'Unsaved changes'}
            style={{
              position: 'absolute', bottom: 12, left: 12, zIndex: 80,
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
              background: 'rgba(255,255,255,0.92)', border: '1px solid var(--koala-border-primary)', boxShadow: '0 1px 3px rgba(24,26,34,0.08)',
              backdropFilter: 'blur(6px)', fontSize: 12, fontWeight: 500, color: 'var(--koala-text-tertiary)',
              fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap', pointerEvents: 'none',
            }}
          >
            {autoSaveState === 'saving' ? (
              <div style={{ width: 13, height: 13, border: '2px solid var(--koala-border-primary)', borderTopColor: 'var(--koala-text-brand)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            ) : (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--koala-status-warning)', flexShrink: 0 }} />
            )}
            {autoSaveState === 'saving' ? 'Saving…' : 'Unsaved'}
          </div>
          )}


          {/* ── Editor card (white rounded, padding-right for panel) ── */}
          <div
            className="ce-editor-card"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'var(--koala-bg-primary)',
              borderRadius: 12,
              border: '1px solid var(--koala-border-primary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              marginRight: panelCollapsed ? 0 : PANEL_W + PANEL_GAP,
              transition: 'margin-right 0.2s ease',
              position: 'relative',
            }}
          >
            <ArticleEditor
              editorRef={editorRef}
              onRanksmileOpenChange={setRanksmileDockOpen}
              ranksmileDockEl={ranksmileDockEl}
              content={article.content || ''}
              keyword={article.target_keyword}
              metaTitle={article.meta_title}
              metaDescription={article.meta_description}
              scoreData={scoreData}
              internalArticles={internalArticles}
              reviewMode={!!linkBar}
              formattingSuspended={optimizeState === 'optimizing'}
              readOnly={editorLocked}
              highlightTerms={highlightTerms}
              onAiActivity={setRanksmileAiActive}
              articleKeyword={article?.target_keyword || ''}
              plagiarismSentences={plagSentences}
              plagiarismFocused={plagFocused}
              onChange={handleEditorChange}
              onMetaTitleChange={handleMetaTitleChange}
              onMetaDescriptionChange={handleMetaDescriptionChange}
              initialFeaturedImage={featuredImage}
              onFeaturedImageChange={setFeaturedImage}
              onHeadingsChange={setEditorHeadings}
              threads={commentThreads}
              commentAuthor={commentAuthor}
              commentArticleId={String(article.id)}
              bottomBarRightReserve={panelCollapsed ? 0 : PANEL_W + PANEL_GAP}
              onCommentsChanged={() => setCommentsVersion((v) => v + 1)}
              onCreateComment={async (quote, draft) => {
                // Optimistic: show a pending pin instantly, reconcile after the POST.
                const tmp = `tmp_${Math.random().toString(36).slice(2, 10)}`;
                setCommentThreads((prev) => [...prev, { id: tmp, parentId: null, quote, text: draft.text, images: draft.images, author: commentAuthor.name, color: commentAuthor.color, avatar: commentAuthor.avatar, resolved: false, reactions: {}, createdAt: Date.now(), updatedAt: null, replies: [], pending: true }]);
                try {
                  const r = await fetch(`/api/articles/${id}/comments`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quote, text: draft.text, images: draft.images, author: commentAuthor.name, color: commentAuthor.color, avatar: commentAuthor.avatar || '' }),
                  });
                  const d = await r.json();
                  setCommentsVersion((v) => v + 1);
                  return d.comment?.id as string | undefined;
                } catch { setCommentThreads((prev) => prev.filter((t) => t.id !== tmp)); return undefined; }
              }}
            />
            {editorLocked && (
              <div
                aria-hidden
                style={{
                  position: 'absolute', inset: 0, zIndex: 30,
                  display: 'flex', flexDirection: 'column',
                  background: 'var(--koala-bg-primary)', borderRadius: 12,
                }}
              >
                <EditorLoading message="Analyzing imported content…" />
              </div>
            )}
          </div>

          {/* ── Compact actions bar (shown when the side panel is hidden) ── */}
          <AnimatePresence>
          {panelCollapsed && (
            <motion.div
              key="collapsedbar"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, delay: 0.12 }}
              style={{
                position: 'absolute', top: 14, right: 12, zIndex: 95, display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <div ref={actionsRef} style={{ position: 'relative', display: 'inline-flex' }}>
                <IconBtn disabled={editorLocked} onClick={() => { setActionsMenu((o) => !o); setVoiceOpen(false); }} title="More"><IcoDots /></IconBtn>
                {actionsMenu && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200, minWidth: 244,
                    background: 'var(--koala-bg-primary)', borderRadius: 12, padding: '6px 0',
                    boxShadow: '0px 8px 24px rgba(24,26,34,0.16), 0px 2px 6px rgba(24,26,34,0.08)',
                    animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)',
                  }}>
                    <MenuRow
                      disabled={editorLocked}
                      icon={article.status === 'accepted' ? <IcoDoneFilled /> : <IcoDoneOutline />}
                      label={article.status === 'accepted' ? 'Unmark as done' : 'Mark as done'}
                      onClick={() => { handleAcceptReject(article.status === 'accepted' ? 'reject' : 'accept'); setActionsMenu(false); }}
                    />
                    <MenuRow disabled={editorLocked} icon={<IcoClock />} label="Version history" onClick={() => { setPanelCollapsed(false); setShowInternalLinksPanel(false); setShowHistory(true); setActionsMenu(false); }} />
                    <MenuRow disabled={editorLocked} icon={<IcoGear />} label="Settings" onClick={() => { setShowCustomization(true); setActionsMenu(false); }} />
                    <MenuRow disabled={editorLocked} icon={<IcoCode />} label="Developer" sub="Download full report" onClick={() => { handleDownloadDeveloperReport(); setActionsMenu(false); }} />
                    <div style={{ position: 'relative' }}>
                      <MenuRow disabled={editorLocked} icon={<IcoVoice />} label="Voice" sub="SERP based" chevron onClick={() => setVoiceOpen((v) => !v)} />
                      {voiceOpen && <VoicePopover style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200 }} />}
                    </div>
                  </div>
                )}
              </div>
              <IconBtn disabled={editorLocked} onClick={() => setPanelCollapsed(false)} title="Show side panel"><IcoPanel /></IconBtn>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={editorLocked || !id}
                icon={<Icon name="UploadSimple" size={16} weight="bold" />}
                onClick={() => { void openPublishPanel(); }}
              >
                Publish
              </Button>
            </motion.div>
          )}
          </AnimatePresence>

          {/* ── Right panel (absolute, two cards stacked) ───────────
              Plain div (not motion enter-from-offscreen): parent has overflow:hidden,
              so initial x: PANEL_W+24 parks the panel outside the clip and it can stay
              invisible if the spring never commits — empty gray gutter, no Publish/score. */}
          {!panelCollapsed && (
          <div
            className="ce-right-panel"
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
            {/* Top card: action icons + preview */}
            <div className="koala-panel editor-side-toolbar" style={{ position: 'relative', zIndex: voiceOpen ? 150 : undefined }}>
              {/* Left: action icon buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Mark / unmark as done */}
                <span data-tour="done" style={{ display: 'inline-flex' }}>
                  <IconBtn
                    disabled={editorLocked}
                    onClick={() => handleAcceptReject(article.status === 'accepted' ? 'reject' : 'accept')}
                    title={article.status === 'accepted' ? 'Unmark as done' : 'Mark as done'}
                  >
                    <span style={{ color: article.status === 'accepted' ? 'var(--koala-text-primary)' : 'var(--koala-text-secondary)', display: 'inline-flex' }}>
                      {article.status === 'accepted' ? <IcoDoneFilled /> : <IcoDoneOutline />}
                    </span>
                  </IconBtn>
                </span>

                {/* Version History */}
                <span data-tour="version" style={{ display: 'inline-flex' }}>
                  <IconBtn disabled={editorLocked} onClick={() => { setShowInternalLinksPanel(false); setShowHistory((v) => !v); }} title="Version History">
                    <IcoClock />
                  </IconBtn>
                </span>

                {/* Voice */}
                <div ref={voiceRef} data-tour="voice" style={{ position: 'relative', display: 'inline-flex' }}>
                  <IconBtn disabled={editorLocked} onClick={() => setVoiceOpen((v) => !v)} title="Voice">
                    <IcoVoice />
                  </IconBtn>
                  {voiceOpen && <VoicePopover style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200 }} />}
                </div>

                {/* Settings (customization panel) */}
                <span data-tour="settings" style={{ display: 'inline-flex' }}>
                  <IconBtn disabled={editorLocked} onClick={() => setShowCustomization(true)} title="Settings"><IcoGear /></IconBtn>
                </span>

                {/* Developer report dump */}
                <span data-tour="developer" style={{ display: 'inline-flex' }}>
                  <IconBtn disabled={editorLocked || !article} onClick={handleDownloadDeveloperReport} title="Developer — download full report">
                    <IcoCode />
                  </IconBtn>
                </span>
              </div>

              {/* Right: panel toggle + Publish */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span data-tour="hide-panel" style={{ display: 'inline-flex' }}>
                  <IconBtn disabled={editorLocked} onClick={() => { setPanelCollapsed(true); setVoiceOpen(false); }} title="Hide side panel"><IcoPanel /></IconBtn>
                </span>
                <Button
                  data-tour="publish"
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={editorLocked || !id}
                  icon={<Icon name="UploadSimple" size={16} weight="bold" />}
                  onClick={() => { void openPublishPanel(); }}
                >
                  Publish
                </Button>
              </div>
            </div>

            {/* Bottom card: keyword + content score OR panel */}
            <div className="koala-panel editor-side-panel-card">
              {isDeepAnalyzing && analysisPhases ? (
                // Entered the editor before the analysis finished — show what the
                // pipeline is doing instead of an empty Content Score.
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="styled-scrollbar">
                  <AnalysisProgressPanel phases={analysisPhases} />
                </div>
              ) : editorLocked ? (
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="styled-scrollbar">
                  <ContentScorePanel
                    plainText={plainText}
                    wordCount={wordCount}
                    headingCount={headingCount}
                    scoreData={scoreData}
                    internalLinksCount={internalLinksCount}
                    html={editorHtml}
                    keyword={article?.target_keyword || ''}
                    articleId={article.id}
                    domainSlug={domains.find((d) => d.ID === article?.domain_id)?.slug}
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
                // Docked Ranksmile pane — the editor portals RanksmileChatPanel into this element.
                <div ref={setRanksmileDockEl} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} />
              ) : showInternalLinksPanel ? (
                <InternalLinksPanel
                  articleId={article.id}
                  keyword={article.target_keyword || ''}
                  plainText={plainText}
                  domainBaseUrl={domainBaseUrl}
                  domains={domains}
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
                  currentScore={liveContentScore}
                  onClose={() => setShowHistory(false)}
                  onRestore={handleRestoreVersion}
                />
              ) : (
                <>
                  {/* ContentScorePanel fills remaining height */}
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="styled-scrollbar">
                    <ContentScorePanel
                      plainText={plainText}
                      wordCount={wordCount}
                      headingCount={headingCount}
                      scoreData={scoreData}
                      internalLinksCount={internalLinksCount}
                      html={editorHtml}
                      scoreDeltas={aoScoresReady && aoLiveSnapshot ? (() => {
                        const aiBase = aiVisibilityBaselineRef.current;
                        const seoBase = preScoreRef.current;
                        const contentBase = preContentScoreRef.current;
                        const hasAi = aiCoverageScore != null || !!(aiVisibilitySummary && aiVisibilitySummary.prompts_total > 0) || scoreData?.ai_score != null;
                        const seoDelta = Math.round(aoLiveSnapshot.seo) - Math.round(seoBase);
                        const aiDelta = Math.round(aoLiveSnapshot.ai) - Math.round(aiBase);
                        const overallDelta = Math.round(aoLiveSnapshot.overall) - Math.round(contentBase);
                        return {
                          seo: seoDelta !== 0 ? seoDelta : undefined,
                          overall: overallDelta !== 0 ? overallDelta : undefined,
                          ai: hasAi && aiDelta !== 0 ? aiDelta : undefined,
                        };
                      })() : undefined}
                      optimizeLiveScores={aoScoresReady && aoLiveSnapshot ? {
                        seo: aoLiveSnapshot.seo,
                        ai: aoLiveSnapshot.ai,
                        overall: aoLiveSnapshot.overall,
                      } : undefined}
                      keyword={article?.target_keyword || ''}
                      onInternalLinks={() => { setShowHistory(false); setShowInternalLinksPanel(true); }}
                      onAutoOptimize={() => handleAutoOptimizeSections()}
                      isAutoOptimizing={isAutoOptimizing}
                      optimizeState={optimizeState}
                      onCancelOptimize={() => setCancelModalOpen(true)}
                      onSaveOptimize={() => setSaveModalOpen(true)}
                      optimizeSaving={optimizeSaving}
                      saveState={autoSaveState}
                      articleId={article.id}
                      domainSlug={domains.find((d) => d.ID === article?.domain_id)?.slug}
                      cachedOutlines={article.competitor_outlines_cache}
                      fallbackScore={article.content_score}
                      title={article.title || ''}
                      metaTitle={article.meta_title || ''}
                      metaDescription={article.meta_description || ''}
                      onMetaTitleChange={handleMetaTitleChange}
                      onMetaDescriptionChange={handleMetaDescriptionChange}
                      highlightTerms={highlightTerms}
                      onHighlightTermsChange={setHighlightTerms}
                      initialPlagiarism={initialPlagiarism}
                      initialAiReadability={initialAiReadability}
                      featuredImage={featuredImage}
                      onFeaturedImageChange={setFeaturedImage}
                      isDone={article.status === 'accepted'}
                      onMarkDone={() => handleAcceptReject('accept')}
                      aiVisibilitySummary={aiVisibilitySummary}
                      coverageItems={aoLiveSnapshot ? aoLiveSnapshot.liveItems : liveAiCoverage.items}
                      coverageBuckets={aoLiveSnapshot ? aoLiveSnapshot.buckets : liveAiCoverage.buckets}
                      coverageSnapshot={coverageSnapshot}
                      aiCoverageScore={aoLiveSnapshot ? aoLiveSnapshot.ai : (liveAiCoverage.overall ?? aiCoverageScore)}
                      isRunningAiVisibility={isRunningAiVisibility}
                      onRunAiVisibility={handleRunAiVisibility}
                      onApplyReadability={handleApplyReadability}
                      onPlagiarismHighlight={handlePlagiarismHighlight}
                      readabilityAccepted={readabilityAcceptKey}
                      isDeepAnalyzing={isDeepAnalyzing}
                      deepAnalysisUi={deepAnalysisUi}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
          )}
        </div>

        {/* ── Auto-optimize loading indicator (legacy flow only; AO-8a uses OptimizeReviewBar) ── */}
        {isAutoOptimizing && optimizeState === 'idle' && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10000, width: 520, maxWidth: 'calc(100vw - 40px)',
            background: 'var(--koala-text-primary)', borderRadius: 10,
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, gap: 12,
          }}>
            <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.15)', borderTopColor: 'var(--koala-text-brand)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            <span
              key={autoOptimizeStatus}
              style={{
                fontSize: 13, color: 'var(--koala-text-disabled)', fontFamily: 'var(--font-family-primary)',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                animation: 'fadeSlideIn 0.25s ease',
              }}
            >
              {autoOptimizeStatus}
            </span>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 3, borderRadius: 2, background: 'var(--koala-text-brand)', animation: `barPulse 1s ease-in-out ${i * 0.15}s infinite`, height: 14 }} />
              ))}
            </div>
          </div>
        )}

        {/* ── AO-8a: section-by-section Auto-Optimize review toolbar ── */}
        {optimizeState !== 'idle' && (
          <OptimizeReviewBar
            state={optimizeState}
            processed={optimizeProgress.processed}
            total={optimizeProgress.total}
            remaining={optimizeRemaining}
            changedCount={optimizeMetaRef.current.changedCount}
            onCancel={() => setCancelModalOpen(true)}
            onSave={() => setSaveModalOpen(true)}
            saving={optimizeSaving}
            rightReserve={panelCollapsed ? 0 : PANEL_W + PANEL_GAP}
            currentSection={optimizeState === 'optimizing' && optimizeProgress.total > 0
              ? Math.min(optimizeProgress.processed + 1, optimizeProgress.total)
              : undefined}
            activeStatusLabel={optimizeState === 'optimizing' ? autoOptimizeStatus : undefined}
          />
        )}

        {/* ── Task 11: "Optimization Impact +N" float. Fixed near the score-gauge/topbar area
            (top-right, left of the right panel). AoScoreFloat is position:absolute + self-removing. ── */}
        {aoFloat && (
          <div style={{
            position: 'fixed', top: 70, zIndex: 9000, pointerEvents: 'none',
            right: (panelCollapsed ? 0 : PANEL_W + PANEL_GAP) + 24,
          }}>
            <AoScoreFloat key={aoFloat.key} label={aoFloat.label} onDone={() => setAoFloat(null)} />
          </div>
        )}

        {/* ── AO-8a: cancel-confirmation modal ── */}
        <OptimizeCancelModal
          open={cancelModalOpen}
          onGoBack={() => setCancelModalOpen(false)}
          onConfirm={handleConfirmCancel}
        />

        {/* ── AO-8a: save-confirmation modal ── */}
        <OptimizeSaveModal
          open={saveModalOpen}
          onContinueEditing={() => setSaveModalOpen(false)}
          onSave={handleSaveOptimizeRun}
          saving={optimizeSaving}
        />

        {/* ── AO-8a: top-right saved confirmation banner ── */}
        <OptimizeSavedBanner
          open={savedBannerOpen}
          onOpenHistory={() => {
            setSavedBannerOpen(false);
            setPanelCollapsed(false);
            setShowInternalLinksPanel(false);
            setShowHistory(true);
          }}
          onClose={() => setSavedBannerOpen(false)}
        />

        {/* ── AI Readability optimize: working ──────────────────────── */}
        {isApplyingReadability && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 500, minWidth: 560, maxWidth: 'calc(100vw - 40px)',
            background: 'var(--koala-text-primary)', borderRadius: 10,
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, gap: 12,
          }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--koala-text-disabled)', fontFamily: 'var(--font-family-primary)' }}>Optimize AI Readability</span>
            <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.15)', borderTopColor: 'var(--koala-text-brand)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--koala-bg-primary)', fontFamily: 'var(--font-family-primary)' }}>Working</span>
          </div>
        )}

        {/* ── AI Readability optimize: result bar (Compare versions added in a later step) ── */}
        {readabilityBar && !isApplyingReadability && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 500, minWidth: 560, maxWidth: 'calc(100vw - 40px)',
            background: 'var(--koala-text-primary)', borderRadius: 10,
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', padding: '0 10px 0 16px', height: 52, gap: 16,
          }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--koala-text-disabled)', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap' }}>Optimize AI Readability</span>

            {/* Compare versions */}
            {compareVersionsButton(readabilityBar.preHtml)}

            {/* Cancel — revert the editor to the pre-apply state (autosave re-persists it). */}
            <button
              type="button"
              onClick={() => {
                const preHtml = readabilityBar.preHtml;
                const editor = getEditor();
                if (editor) editor.commands.setContent(preHtml);
                setReadabilityBar(null);
              }}
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--koala-bg-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '6px 8px', borderRadius: 6, transition: 'color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--koala-text-disabled)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--koala-bg-primary)'; }}
            >
              Cancel
            </button>

            {/* Accept — snapshot the optimized content as a new version. */}
            <button
              type="button"
              onClick={async () => {
                setReadabilityBar(null);
                try {
                  setAutoSaveState('saving');
                  await doSave('readability_optimize');
                  lastVersionAt.current = Date.now();
                  setAutoSaveState('saved');
                  setReadabilityAcceptKey((k) => k + 1);
                  toast.success('Changes accepted — version saved');
                } catch {
                  setAutoSaveState('unsaved');
                  toast.error('Could not save version');
                }
              }}
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--koala-text-primary)', background: 'var(--koala-bg-primary)', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '7px 16px', transition: 'opacity 0.15s', flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              Accept
            </button>
          </div>
        )}

        {/* ── Compare versions modal (shared by Auto-Optimize + AI Readability bars) ── */}
        {compareVersions && (
          <CompareVersionsModal
            original={compareVersions.original}
            updated={compareVersions.updated}
            terms={[article?.target_keyword, ...((scoreData?.terms || []).map((t) => t.term))].filter(Boolean) as string[]}
            onClose={() => setCompareVersions(null)}
          />
        )}

        {/* ── Link review floating modal (Ranksmile-style) ─────────────── */}
        {linkBar && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 500, width: 560, maxWidth: 'calc(100vw - 40px)',
            background: 'var(--koala-text-primary)', borderRadius: 10,
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', padding: '0 10px 0 16px', height: 52, gap: 10,
          }}>
            {/* Link count badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--koala-text-brand)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--koala-text-disabled)', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap' }}>
                {linkBar.count} link{linkBar.count !== 1 ? 's' : ''} inserted
              </span>
            </div>

            <div style={{ width: 1, height: 18, background: 'var(--koala-border-primary)', flexShrink: 0 }} />

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
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: 'none', background: 'var(--koala-bg-secondary)', color: 'var(--koala-text-disabled)', cursor: 'pointer', fontSize: 13, transition: 'background 0.15s, color 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--koala-border-primary)'; e.currentTarget.style.color = 'var(--koala-text-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--koala-bg-secondary)'; e.currentTarget.style.color = 'var(--koala-text-disabled)'; }}
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
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--koala-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '6px 10px', borderRadius: 6, transition: 'color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--koala-text-disabled)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--koala-text-tertiary)'; }}
            >
              Discard
            </button>

            {/* Accept */}
            <button
              type="button"
              onClick={() => setLinkBar(null)}
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--koala-bg-primary)', background: 'var(--koala-text-brand)', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '7px 16px', transition: 'background 0.15s', flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--koala-text-brand)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--koala-text-brand)'; }}
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

        {showWpExportModal && article?.id != null && (
          <WordPressExportModal
            articleId={article.id}
            onClose={() => setShowWpExportModal(false)}
          />
        )}

        {/* Content Editor customization panel */}
        <CustomizationPanelModal
          open={showCustomization}
          slug={domains.find((d) => d.ID === article?.domain_id)?.slug}
          keyword={article?.target_keyword || ''}
          onClose={() => setShowCustomization(false)}
        />

        {/* First-visit onboarding coachmark (Ask Ranksmile + Content Score) */}
        <EditorOnboarding />
      </div>
    </AppShell>
  );
};

export default ArticleEditorPage;
