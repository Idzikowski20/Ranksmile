import {
  checkCoverage,
  computeCoverageScores,
  type CoverageItem,
  type CoverageResult,
  type CoverageSnapshot,
  type CoverageTopicGroup,
} from '@/src/core/domain/coverage/aiCoverage';
import { deepseekJudge } from '@/src/infrastructure/ai/aiCoverageJudge';
import { analyzeIntroduction, deepseekIntroJudge } from '@/src/infrastructure/articles/introductionAnalyzer';
import { normalizeTerm } from '@/src/core/domain/terms/termUtils';
import { citationIntentItems } from '@/src/infrastructure/articles/citationPrompts';
import { curateAiCoverageItems, dedupePaaQuestions } from '@/src/infrastructure/coverage/curateCoverageItems';
import { mergeCoverageItems, buildSnapshot } from '@/src/infrastructure/coverage/coverageStore';
import { liveCoverageItems } from '@/src/infrastructure/coverage/liveCoverage';
import { splitSections } from '@/src/infrastructure/articles/articleSections';

export type PaaQuestion = { question: string; answer?: string };

const JUDGEABLE_TYPES = new Set<CoverageItem['type']>([
  'paa', 'fact', 'definition', 'comparison', 'example', 'intent',
]);

/**
 * The text the introduction judge grades: the article's opening prose.
 *
 * `splitSections(html)[0]` is everything before the first H2, which for a generated
 * article is the H1 and nothing else — the writer opens `<h1>…</h1><h2>…</h2><p>lead`.
 * The judge was handed a bare 100-character title, so `answerStartsEarly` could only
 * ever come back false and all five intent rows graded against a document with no
 * sentences in it. That cost the 15-point early-answer bonus plus the intent bucket,
 * on articles whose lead answers the question in its first sentence.
 *
 * A section with no real prose in it is therefore not an intro: fall back to the body.
 */
const MIN_INTRO_CHARS = 200;

export function introPlainTextFromHtml(html: string, plainTextFallback = ''): string {
  const introSection = splitSections(html)[0];
  if (introSection?.html) {
    const text = introSection.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length >= MIN_INTRO_CHARS) return text;
  }
  return plainTextFallback.slice(0, 2500);
}

/** Build merged coverage items from LLM questions + intro intent (no judge). */
export async function assembleCoverageItems(opts: {
  keyword: string;
  paaQuestions?: PaaQuestion[];
  llmQuestions?: Array<{ question: string; sources: import('@/src/core/domain/coverage/aiCoverage').LlmCoverageSource[] }>;
  competitorTopics?: string[];
  introPlain: string;
  languageCode?: string;
}): Promise<{ items: CoverageItem[]; answersMainQuestionEarly: boolean }> {
  const keyword = opts.keyword.trim();
  const curated = curateAiCoverageItems({
    keyword,
    llmQuestions: opts.llmQuestions,
    paaQuestions: opts.paaQuestions,
    competitorTopics: opts.competitorTopics,
  });
  const intentResult = await analyzeIntroduction(opts.introPlain, keyword, deepseekIntroJudge);
  const serpQuestions = [
    ...(opts.llmQuestions?.map((q) => q.question) ?? []),
    ...(opts.paaQuestions?.map((q) => q.question) ?? []),
  ];
  const baseIntent = citationIntentItems(keyword, intentResult.detectedMainQuestion, {
    serpQuestions,
    languageCode: opts.languageCode,
  })
    .filter((item) => !curated.knowledge.some((k) => normalizeTerm(k.label) === normalizeTerm(item.label)))
    .map((item) => {
      const match = opts.llmQuestions?.find((q) => q.question === item.label);
      return match?.sources?.length ? { ...item, llmSources: match.sources, source: 'llm' as const } : item;
    });

  const items = mergeCoverageItems({
    paa: curated.knowledge,
    intent: baseIntent,
    readability: [],
    entity: curated.entity,
  });

  return { items, answersMainQuestionEarly: intentResult.answerStartsEarly };
}

function judgeableSubset(items: readonly CoverageItem[]): CoverageItem[] {
  return items.filter((i) => JUDGEABLE_TYPES.has(i.type));
}

/** Run LLM judge or return empty verdicts when there is no article text. */
export async function judgeCoverageItems(
  plainText: string,
  items: readonly CoverageItem[],
): Promise<{ result: CoverageResult; judgeTokens: number }> {
  const judgeable = judgeableSubset(items);
  if (!plainText.trim()) {
    return {
      result: {
        items: judgeable.map((i) => ({
          id: i.id,
          covered: false,
          quality: 0,
          confidence: 0,
          needsExpansion: false,
          missing: [],
          reason: '',
        })),
        answersMainQuestionEarly: false,
      },
      judgeTokens: 0,
    };
  }
  const result = await checkCoverage(plainText, judgeable, deepseekJudge);
  return { result, judgeTokens: 6000 };
}

function judgeMeta(): { judgeVersion: string; promptVersion: string; model: string; createdAt: string } {
  const [promptVersion, model] = deepseekJudge.version.split('|');
  return {
    judgeVersion: deepseekJudge.version,
    promptVersion,
    model,
    createdAt: new Date().toISOString(),
  };
}

/** Map harvested topic titles → coverage item ids after curation. */
export function mapHarvestTopicsToItemIds(
  harvestTopics: Array<{ title: string; questions: Array<{ question: string }> }>,
  items: readonly CoverageItem[],
): CoverageSnapshot['topics'] {
  const byLabel = new Map<string, string>();
  for (const it of items) {
    byLabel.set(normalizeTerm(it.label), it.id);
  }
  const out: CoverageTopicGroup[] = [];
  for (const topic of harvestTopics) {
    const itemIds: string[] = [];
    for (const q of topic.questions) {
      const id = byLabel.get(normalizeTerm(q.question));
      if (id && !itemIds.includes(id)) itemIds.push(id);
    }
    if (itemIds.length) out.push({ title: topic.title, itemIds });
  }
  return out.length ? out : undefined;
}

/** Deep-analysis path: curate → judge → buildSnapshot. */
export async function buildGradedCoverageSnapshot(opts: {
  keyword: string;
  plainText: string;
  html: string;
  paaQuestions?: PaaQuestion[];
  llmQuestions?: Array<{ question: string; sources: import('@/src/core/domain/coverage/aiCoverage').LlmCoverageSource[] }>;
  languageCode?: string;
  /** Optional harvested topic buckets (titles + questions) for snapshot.topics */
  harvestTopics?: Array<{ title: string; questions: Array<{ question: string }> }>;
}): Promise<{ snapshot: CoverageSnapshot; introTokens: number; judgeTokens: number }> {
  const introPlain = introPlainTextFromHtml(opts.html, opts.plainText);
  const { items, answersMainQuestionEarly } = await assembleCoverageItems({
    keyword: opts.keyword,
    paaQuestions: opts.paaQuestions,
    llmQuestions: opts.llmQuestions,
    // Topic titles already arrive with harvestTopics (used for UI grouping); score them
    // too, the way Surfer scores its topics pool.
    competitorTopics: opts.harvestTopics?.map((t) => t.title).filter(Boolean),
    introPlain,
    languageCode: opts.languageCode,
  });
  const { result, judgeTokens } = await judgeCoverageItems(opts.plainText, items);
  result.answersMainQuestionEarly = answersMainQuestionEarly;
  const topics = opts.harvestTopics?.length
    ? mapHarvestTopicsToItemIds(opts.harvestTopics, items)
    : undefined;
  const snapshot = buildSnapshot(items, result, judgeMeta(), topics);
  return { snapshot, introTokens: 3000, judgeTokens };
}

/** Regrade path: judge → live presence rescoring. */
export async function buildRegradedCoverageSnapshot(opts: {
  items: CoverageItem[];
  plainText: string;
  html: string;
  answersMainQuestionEarly: boolean;
  baseSnapshot: CoverageSnapshot;
  /** Verdicts already obtained (the caller judged in parallel); skips the judge call. */
  judged?: CoverageResult;
}): Promise<CoverageSnapshot> {
  const result = opts.judged ?? (await judgeCoverageItems(opts.plainText, opts.items)).result;
  result.answersMainQuestionEarly = opts.answersMainQuestionEarly;

  const verdictById = new Map(result.items.map((v) => [v.id, v]));
  const merged: CoverageItem[] = opts.items.map((it) => {
    const vd = verdictById.get(it.id);
    if (!vd) return it;
    return {
      ...it,
      covered: !!vd.covered,
      quality: vd.quality ?? it.quality,
      confidence: vd.confidence ?? it.confidence,
      needsExpansion: vd.needsExpansion ?? it.needsExpansion,
      missing: vd.missing ?? it.missing,
      reason: vd.reason ?? it.reason,
      sectionId: vd.sectionId ?? it.sectionId,
    };
  });

  const liveGraded = [...liveCoverageItems(merged, opts.plainText, opts.html)];
  const { overall, buckets } = computeCoverageScores(liveGraded, result.answersMainQuestionEarly);
  const meta = judgeMeta();
  return {
    ...opts.baseSnapshot,
    judgeVersion: meta.judgeVersion,
    promptVersion: meta.promptVersion,
    model: meta.model,
    createdAt: meta.createdAt,
    items: liveGraded,
    buckets,
    answersMainQuestionEarly: result.answersMainQuestionEarly,
    overall,
  };
}
