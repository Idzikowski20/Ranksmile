import type { CoverageItem, LlmCoverageSource } from './aiCoverage';
import type { ArticleFact } from './articleFactTypes';
import {
  citationIntentItems,
  citationItemId,
  isUsefulCitationPrompt,
  scoreCitationPrompt,
  filterSyntheticCitationTemplates,
  isMisalignedSyntheticCitation,
} from './citationPrompts';
import { isCorpusNoiseSentence } from './corpusNoiseFilter';
import { isKeywordOnTopic, seedTokens } from './topicRelevance';
import { normalizeTerm } from './termUtils';

/** Target curated AI Search checklist size (citation prompts + PAA). */
export const AI_COVERAGE_MAX = 35;
export const AI_COVERAGE_PAA_MAX = 28;
export const AI_COVERAGE_INTENT_COUNT = 8;

const NOISE_PATTERNS: RegExp[] = [
  /\bpraca\b/i,
  /\bjooble\b/i,
  /\bofert pracy\b/i,
  /\bopinie\b.*\bagencj/i,
  /\blinkedin\b/i,
  /\bfacebook\b/i,
  /\blubimyczytac\b/i,
  /\bporównywark/i,
  /\bksiążk/i,
  /\bcreative commons\b/i,
  /\bcookie/i,
  /\bwikipedia\b/i,
  /\bparsoid\b/i,
];

const HIGH_VALUE_PATTERNS: RegExp[] = [
  /\b(cennik|koszt|ile kosztuje|ile bierze)\b/i,
  /\b(warto|polecany|wybrać|wybrac|kogo wybrać)\b/i,
  /\b(zdrad|niewierno|obserwac|licencj|wywiad)\b/i,
  /\b(jak wybrac|jak znalezc|co to jest)\b/i,
];

/** Dedupe PAA rows by normalized question text. */
export function dedupePaaQuestions(
  questions: Array<{ question: string; answer?: string }>,
): Array<{ question: string; answer?: string }> {
  const seen = new Set<string>();
  const out: Array<{ question: string; answer?: string }> = [];
  for (const q of questions) {
    const key = normalizeTerm(q.question);
    if (!key || key.length < 8 || seen.has(key)) continue;
    if (isCorpusNoiseSentence(q.question)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

/** Score a PAA question for inclusion in the curated AI Search checklist. */
export function scorePaaQuestion(question: string, keyword: string): number {
  const q = question.trim();
  if (!q || q.length < 10) return 0;
  if (NOISE_PATTERNS.some((re) => re.test(q))) return 0;
  if (isCorpusNoiseSentence(q)) return 0;

  const citationScore = scoreCitationPrompt(q, keyword);
  if (citationScore > 0) return citationScore;

  let score = 0;
  if (isKeywordOnTopic(q, keyword)) score += 45;
  else {
    const seeds = seedTokens(keyword);
    const words = normalizeTerm(q).split(/\s+/);
    const overlap = seeds.filter((s) => words.includes(s)).length;
    if (overlap >= 1 && words.length >= 2) score += 20;
    else return 0;
  }

  if (/^(co|jak|ile|czy|kiedy|gdzie|dlaczego|jaka|jaki)\b/i.test(q)) score += 12;
  if (HIGH_VALUE_PATTERNS.some((re) => re.test(q))) score += 15;
  if (q.length > 100) score -= 15;
  if (/\?\s*$/.test(q)) score += 5;

  return score;
}

export function curateAiCoverageItems(opts: {
  keyword: string;
  paaQuestions?: Array<{ question: string; answer?: string }>;
  llmQuestions?: Array<{ question: string; sources: LlmCoverageSource[] }>;
  articleFacts?: ArticleFact[];
}): { knowledge: CoverageItem[]; entity: CoverageItem[] } {
  const keyword = opts.keyword.trim();
  const llmRows = opts.llmQuestions ?? [];
  const paaRows = (opts.paaQuestions ?? []).map((q) => ({
    question: q.question,
    sources: ['ai_overview'] as LlmCoverageSource[],
  }));

  const ranked = [...llmRows, ...paaRows]
    .map((row) => ({
      question: row.question,
      score: scoreCitationPrompt(row.question, keyword) || scorePaaQuestion(row.question, keyword),
      sources: row.sources,
    }))
    .filter((row) => row.score > 0 && isUsefulCitationPrompt(row.question, keyword))
    .sort((a, b) => b.score - a.score || a.question.length - b.question.length);

  const seen = new Set<string>();
  const knowledge: CoverageItem[] = [];
  for (const row of ranked) {
    const key = normalizeTerm(row.question);
    if (seen.has(key)) continue;
    seen.add(key);
    knowledge.push({
      id: citationItemId(row.question, 'paa'),
      label: row.question,
      type: 'paa' as const,
      category: 'knowledge' as const,
      importance: row.score >= 70 ? 'critical' as const : 'recommended' as const,
      source: 'llm' as const,
      covered: false,
      quality: 0,
      llmSources: row.sources.length ? row.sources : undefined,
    });
    if (knowledge.length >= AI_COVERAGE_MAX - AI_COVERAGE_INTENT_COUNT) break;
  }

  return { knowledge, entity: [] };
}

/** Shrink legacy bloated snapshots down to the curated checklist. */
export function compactCoverageSnapshotItems(
  items: readonly CoverageItem[],
  keyword: string,
): CoverageItem[] {
  if (items.length <= AI_COVERAGE_MAX) return [...items];

  const intent = items.filter((i) => i.category === 'intent' || i.type === 'intent');
  const knowledge = items.filter((i) =>
    i.type === 'paa' || i.type === 'fact' || i.type === 'definition' || i.type === 'comparison',
  );
  const hasLegacyIntent = intent.some((i) => /answer the main question|set expectations/i.test(i.label));
  const intentKeptRaw = hasLegacyIntent
    ? citationIntentItems(keyword, undefined, {
      serpQuestions: knowledge.map((i) => i.label),
    })
    : intent;
  const intentKept = filterSyntheticCitationTemplates(intentKeptRaw, keyword);
  const rankedKnowledge = knowledge
    .map((i) => ({
      item: i,
      score: scorePaaQuestion(i.label, keyword) || scoreCitationPrompt(i.label, keyword),
    }))
    .filter((row) => row.score > 0 && !isCorpusNoiseSentence(row.item.label))
    .filter((row) => !isMisalignedSyntheticCitation(row.item.label, keyword))
    .sort((a, b) => b.score - a.score || b.item.quality - a.item.quality);

  const knowledgeBudget = Math.max(0, AI_COVERAGE_MAX - intentKept.length);
  const keptKnowledge = rankedKnowledge.slice(0, knowledgeBudget).map((row) => row.item);

  return [...intentKept, ...keptKnowledge];
}
