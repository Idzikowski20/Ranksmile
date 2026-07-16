import { normalizeTerm } from '../termUtils';
import type { LlmCoverageSource } from '../llmCoverageQuestions';
import { computeQuestionScore, maxSourceWeight } from './questionScore';

const QUESTION_PREFIX_RE =
  /^(jak|czy|co|czym|ile|kiedy|gdzie|dlaczego|jaki|jaka|jakie|na czym polega|w jaki sposob|what|how|why|is|are|does|do)\b\s+/i;

export type HarvestedQuestion = {
  question: string;
  canonicalKey: string;
  sources: LlmCoverageSource[];
  maxSourceWeight: number;
  quality: number;
  questionScore: number;
};

export function canonicalizeQuestion(raw: string): string {
  let s = normalizeTerm(raw);
  // Strip repeated question prefixes
  for (let i = 0; i < 3; i += 1) {
    const next = s.replace(QUESTION_PREFIX_RE, '').trim();
    if (next === s) break;
    s = next;
  }
  return s.replace(/\?+$/g, '').trim();
}

function preferDisplay(a: string, b: string): string {
  const aQ = /\?/.test(a) ? 1 : 0;
  const bQ = /\?/.test(b) ? 1 : 0;
  if (bQ !== aQ) return bQ > aQ ? b : a;
  return b.length > a.length ? b : a;
}

function resolveWeight(
  sources: LlmCoverageSource[],
  weightHint?: number,
): number {
  const fromSources = maxSourceWeight(sources);
  if (weightHint == null) return fromSources;
  // Pure PAA rows are tagged ai_overview for icons but scored at PAA weight (3).
  const onlyOverviewOrReddit = sources.every((s) => s === 'ai_overview' || s === 'reddit');
  if (onlyOverviewOrReddit && sources.includes('ai_overview') && sources.length === 1) {
    return weightHint;
  }
  return Math.max(fromSources, weightHint);
}

/** Merge rows that share a canonical key; union sources; keep best display + score. */
export function dedupeWithProvenance(
  rows: Array<{
    question: string;
    sources: LlmCoverageSource[];
    quality: number;
    /** e.g. PAA provider → 3 */
    weightHint?: number;
  }>,
): HarvestedQuestion[] {
  const map = new Map<string, HarvestedQuestion>();

  for (const row of rows) {
    const question = (row.question || '').replace(/\s+/g, ' ').trim();
    if (!question) continue;
    const canonicalKey = canonicalizeQuestion(question);
    if (!canonicalKey || canonicalKey.length < 4) continue;

    const sources = [...new Set(row.sources)];
    const weight = resolveWeight(sources, row.weightHint);
    const quality = row.quality;
    const score = computeQuestionScore(weight, quality);

    const prev = map.get(canonicalKey);
    if (!prev) {
      map.set(canonicalKey, {
        question,
        canonicalKey,
        sources,
        maxSourceWeight: weight,
        quality,
        questionScore: score,
      });
      continue;
    }

    const mergedSources = [...new Set([...prev.sources, ...sources])];
    // After merge with real LLM engines, use true source weights (not PAA hint alone).
    const hasLlmEngine = mergedSources.some((s) => s !== 'ai_overview' && s !== 'reddit');
    const mergedWeight = hasLlmEngine
      ? maxSourceWeight(mergedSources)
      : Math.max(prev.maxSourceWeight, resolveWeight(sources, row.weightHint));
    const keepPrev = prev.questionScore >= score;
    const display = keepPrev
      ? preferDisplay(row.question, prev.question)
      : preferDisplay(prev.question, question);
    const qualityKeep = Math.max(prev.quality, quality);
    map.set(canonicalKey, {
      question: display,
      canonicalKey,
      sources: mergedSources,
      maxSourceWeight: mergedWeight,
      quality: qualityKeep,
      questionScore: computeQuestionScore(mergedWeight, qualityKeep),
    });
  }

  return [...map.values()].sort((a, b) => b.questionScore - a.questionScore);
}
