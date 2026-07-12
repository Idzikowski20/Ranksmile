import {
  computeCoverageScores,
  type CoverageSnapshot,
} from './aiCoverage';
import { analyzeIntroduction, deepseekIntroJudge } from './introductionAnalyzer';
import { citationIntentItems, remapLegacyCitationItem } from './citationPrompts';
import { liveCoverageItems } from './liveCoverage';
import { compactCoverageSnapshotItems, AI_COVERAGE_MAX } from './curateCoverageItems';
import {
  buildRegradedCoverageSnapshot,
  introPlainTextFromHtml,
} from './buildCoverageSnapshot';

export function needsCoverageRegrade(snap: CoverageSnapshot, plainText: string): boolean {
  if (!plainText.trim() || plainText.length < 200) return false;
  if (!snap.items.length) return false;
  if (snap.items.length > AI_COVERAGE_MAX) return true;
  if (snap.overall > 0) return false;
  const gradedCoverage = snap.items.some((i) => i.covered && i.quality > 0);
  return !gradedCoverage;
}

/** Re-run LLM coverage judge when snapshot was graded on empty/keyword-mode content. */
export async function regradeCoverageSnapshot(opts: {
  snapshot: CoverageSnapshot;
  plainText: string;
  html: string;
  keyword: string;
}): Promise<CoverageSnapshot | null> {
  if (!needsCoverageRegrade(opts.snapshot, opts.plainText) && opts.snapshot.items.length <= AI_COVERAGE_MAX) return null;
  if (!process.env.DEEPSEEK_API_KEY) return null;

  const compacted = compactCoverageSnapshotItems(opts.snapshot.items, opts.keyword)
    .map(remapLegacyCitationItem);
  const workingSnap = compacted.length < opts.snapshot.items.length
    ? { ...opts.snapshot, items: compacted }
    : opts.snapshot;

  const introPlain = introPlainTextFromHtml(opts.html, opts.plainText);
  const intentResult = await analyzeIntroduction(introPlain, opts.keyword, deepseekIntroJudge);
  const intentGraded = citationIntentItems(opts.keyword, intentResult.detectedMainQuestion);
  const knowledgeItems = workingSnap.items
    .filter((i) => i.category !== 'intent' && i.type !== 'intent')
    .map(remapLegacyCitationItem);
  const itemsToJudge = [...intentGraded, ...knowledgeItems];

  return buildRegradedCoverageSnapshot({
    items: itemsToJudge,
    plainText: opts.plainText,
    html: opts.html,
    answersMainQuestionEarly: intentResult.answerStartsEarly,
    baseSnapshot: workingSnap,
  });
}

export function coverageScoreFromSnapshot(
  snap: CoverageSnapshot,
  plainText: string,
  html: string,
): number {
  const live = liveCoverageItems(snap.items, plainText, html);
  return computeCoverageScores(live, !!snap.answersMainQuestionEarly).overall;
}
