import {
  checkCoverage,
  computeCoverageScores,
  deepseekJudge,
  type CoverageItem,
  type CoverageResult,
  type CoverageSnapshot,
} from './aiCoverage';
import { analyzeIntroduction, deepseekIntroJudge } from './introductionAnalyzer';
import { normalizeTerm } from './termUtils';
import { citationIntentItems } from './citationPrompts';
import { curateAiCoverageItems, dedupePaaQuestions } from './curateCoverageItems';
import { mergeCoverageItems, buildSnapshot } from './coverageStore';
import { liveCoverageItems } from './liveCoverage';
import { splitSections } from './articleSections';

export type PaaQuestion = { question: string; answer?: string };

const JUDGEABLE_TYPES = new Set<CoverageItem['type']>([
  'paa', 'fact', 'definition', 'comparison', 'example', 'intent',
]);

export function introPlainTextFromHtml(html: string, plainTextFallback = ''): string {
  const introSection = splitSections(html)[0];
  if (introSection?.html) {
    return introSection.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return plainTextFallback.slice(0, 2500);
}

/** Build merged coverage items from LLM questions + intro intent (no judge). */
export async function assembleCoverageItems(opts: {
  keyword: string;
  paaQuestions?: PaaQuestion[];
  llmQuestions?: Array<{ question: string; sources: import('./aiCoverage').LlmCoverageSource[] }>;
  introPlain: string;
  languageCode?: string;
}): Promise<{ items: CoverageItem[]; answersMainQuestionEarly: boolean }> {
  const keyword = opts.keyword.trim();
  const curated = curateAiCoverageItems({
    keyword,
    llmQuestions: opts.llmQuestions,
    paaQuestions: opts.paaQuestions,
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
  const out: NonNullable<CoverageSnapshot['topics']> = [];
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
  llmQuestions?: Array<{ question: string; sources: import('./aiCoverage').LlmCoverageSource[] }>;
  languageCode?: string;
  /** Optional harvested topic buckets (titles + questions) for snapshot.topics */
  harvestTopics?: Array<{ title: string; questions: Array<{ question: string }> }>;
}): Promise<{ snapshot: CoverageSnapshot; introTokens: number; judgeTokens: number }> {
  const introPlain = introPlainTextFromHtml(opts.html, opts.plainText);
  const { items, answersMainQuestionEarly } = await assembleCoverageItems({
    keyword: opts.keyword,
    paaQuestions: opts.paaQuestions,
    llmQuestions: opts.llmQuestions,
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
}): Promise<CoverageSnapshot> {
  const { result } = await judgeCoverageItems(opts.plainText, opts.items);
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
