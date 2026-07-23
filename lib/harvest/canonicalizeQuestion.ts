import { createHash } from 'crypto';
import { normalizeTerm } from '../termUtils';
import type { LlmCoverageSource } from '../llmCoverageQuestions';
import { computeQuestionScore, maxSourceWeight } from './questionScore';

const QUESTION_PREFIX_RE =
  /^(jak|czy|co|czym|ile|kiedy|gdzie|dlaczego|jaki|jaka|jakie|na czym polega|w jaki sposob|what|how|why|is|are|does|do)\b\s+/i;

export type HarvestEvidence = {
  engine: LlmCoverageSource | string;
  prompt?: string;
  rank?: number;
  rawText?: string;
};

export type HarvestDerivedFrom = {
  provider?: string;
  promptId?: string;
  responseId?: string;
  citationUrl?: string;
};

export type HarvestedQuestion = {
  id: string;
  question: string;
  text: string;
  canonical: string;
  canonicalKey: string;
  sources: LlmCoverageSource[];
  evidence: HarvestEvidence[];
  derivedFrom?: HarvestDerivedFrom;
  maxSourceWeight: number;
  sourceWeight: number;
  engineCoverage: number;
  frequency: number;
  quality: number;
  questionScore: number;
  confidence?: number;
  topicId?: string;
  intent?: string;
  entities?: string[];
};

export function canonicalizeQuestion(raw: string): string {
  let s = normalizeTerm(raw);
  for (let i = 0; i < 3; i += 1) {
    const next = s.replace(QUESTION_PREFIX_RE, '').trim();
    if (next === s) break;
    s = next;
  }
  return s.replace(/\?+$/g, '').trim();
}

export function questionIdFor(canonical: string): string {
  return createHash('sha1').update(canonical).digest('hex').slice(0, 16);
}

function preferDisplay(a: string, b: string): string {
  const aQ = /\?/.test(a) ? 1 : 0;
  const bQ = /\?/.test(b) ? 1 : 0;
  if (bQ !== aQ) return bQ > aQ ? b : a;
  return b.length > a.length ? b : a;
}

function resolveWeight(sources: LlmCoverageSource[], weightHint?: number): number {
  const fromSources = maxSourceWeight(sources);
  if (weightHint == null) return fromSources;
  const onlyOverviewOrReddit = sources.every((s) => s === 'ai_overview' || s === 'reddit');
  if (onlyOverviewOrReddit && sources.includes('ai_overview') && sources.length === 1) {
    return weightHint;
  }
  return Math.max(fromSources, weightHint);
}

function toEvidence(sources: LlmCoverageSource[]): HarvestEvidence[] {
  return sources.map((engine) => ({ engine }));
}

/** Merge rows that share a canonical key; union sources/evidence; keep best display + score. */
export function dedupeWithProvenance(
  rows: Array<{
    question: string;
    sources: LlmCoverageSource[];
    quality: number;
    weightHint?: number;
    provider?: string;
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
    const id = questionIdFor(canonicalKey);
    const score = computeQuestionScore(weight, quality, {
      frequency: 1,
      engineCoverage: sources.length,
    });

    const prev = map.get(canonicalKey);
    if (!prev) {
      map.set(canonicalKey, {
        id,
        question,
        text: question,
        canonical: canonicalKey,
        canonicalKey,
        sources,
        evidence: toEvidence(sources),
        derivedFrom: row.provider ? { provider: row.provider } : undefined,
        maxSourceWeight: weight,
        sourceWeight: weight,
        engineCoverage: sources.length,
        frequency: 1,
        quality,
        questionScore: score,
      });
      continue;
    }

    const mergedSources = [...new Set([...prev.sources, ...sources])];
    const hasLlmEngine = mergedSources.some((s) => s !== 'ai_overview' && s !== 'reddit');
    const mergedWeight = hasLlmEngine
      ? maxSourceWeight(mergedSources)
      : Math.max(prev.maxSourceWeight, resolveWeight(sources, row.weightHint));
    const frequency = prev.frequency + 1;
    const engineCoverage = mergedSources.length;
    const qualityKeep = Math.max(prev.quality, quality);
    const display = prev.questionScore >= score
      ? preferDisplay(row.question, prev.question)
      : preferDisplay(prev.question, question);

    map.set(canonicalKey, {
      id: prev.id,
      question: display,
      text: display,
      canonical: canonicalKey,
      canonicalKey,
      sources: mergedSources,
      evidence: toEvidence(mergedSources),
      derivedFrom: prev.derivedFrom || (row.provider ? { provider: row.provider } : undefined),
      maxSourceWeight: mergedWeight,
      sourceWeight: mergedWeight,
      engineCoverage,
      frequency,
      quality: qualityKeep,
      questionScore: computeQuestionScore(mergedWeight, qualityKeep, { frequency, engineCoverage }),
    });
  }

  return [...map.values()].sort((a, b) => b.questionScore - a.questionScore);
}
