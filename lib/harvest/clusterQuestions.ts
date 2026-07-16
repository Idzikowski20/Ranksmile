import { normalizeTerm } from '../termUtils';
import { tokensShareStem } from '../topicRelevance';
import type { HarvestedQuestion } from './canonicalizeQuestion';

export const PLACEHOLDER_THRESHOLD = 0.25;
export const PLACEHOLDER_TOPIC_ID = 'topic-placeholder';
export const PLACEHOLDER_TOPIC_TITLE = 'Information to cover';

const STOP = new Set([
  'oraz', 'jest', 'czy', 'jak', 'lub', 'dla', 'przy', 'przez', 'tego', 'tym',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was',
]);

export function tokenizeForHarvest(text: string): string[] {
  return normalizeTerm(text)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

export type TopicBucket = {
  id: string;
  title: string;
  questions: Array<HarvestedQuestion & { confidence: number }>;
};

function assignmentScore(question: string, topicTitle: string, titleTokenDf: Map<string, number>): {
  score: number;
  shared: number;
} {
  const qTokens = tokenizeForHarvest(question);
  const tTokens = tokenizeForHarvest(topicTitle);
  if (!qTokens.length || !tTokens.length) return { score: 0, shared: 0 };

  let shared = 0;
  let weightSum = 0;
  let hitWeight = 0;
  for (const tw of tTokens) {
    const df = titleTokenDf.get(tw) || 1;
    const w = 1 / Math.log(1 + df + 1);
    weightSum += w;
    const matched = qTokens.some((qw) => tokensShareStem(qw, tw) || qw === tw);
    if (matched) {
      shared += 1;
      hitWeight += w;
    }
  }
  const score = weightSum > 0 ? hitWeight / weightSum : 0;
  return { score, shared };
}

function buildTitleDf(titles: string[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const title of titles) {
    const seen = new Set(tokenizeForHarvest(title));
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  return df;
}

/** Outline-first clustering. Low-confidence → placeholder bucket. */
export function clusterQuestions(
  outlineTitles: string[],
  questions: HarvestedQuestion[],
): { topics: TopicBucket[]; lowConfidenceAssignments: number } {
  const titles = [...new Set(
    outlineTitles.map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => t.length >= 8 && t.length <= 80),
  )].slice(0, 12);

  const df = buildTitleDf(titles);
  const buckets = new Map<string, TopicBucket>();
  for (const title of titles) {
    const id = `topic-${normalizeTerm(title).slice(0, 48)}`;
    buckets.set(id, { id, title, questions: [] });
  }
  buckets.set(PLACEHOLDER_TOPIC_ID, {
    id: PLACEHOLDER_TOPIC_ID,
    title: PLACEHOLDER_TOPIC_TITLE,
    questions: [],
  });

  let lowConfidenceAssignments = 0;

  for (const q of questions) {
    let bestId = PLACEHOLDER_TOPIC_ID;
    let bestScore = 0;
    let bestShared = 0;

    for (const title of titles) {
      const id = `topic-${normalizeTerm(title).slice(0, 48)}`;
      const { score, shared } = assignmentScore(q.question, title, df);
      if (score > bestScore) {
        bestScore = score;
        bestShared = shared;
        bestId = id;
      }
    }

    const usePlaceholder =
      !titles.length
      || bestScore < PLACEHOLDER_THRESHOLD
      || bestShared < 2;

    if (usePlaceholder) {
      lowConfidenceAssignments += 1;
      bestId = PLACEHOLDER_TOPIC_ID;
      bestScore = Math.min(bestScore, PLACEHOLDER_THRESHOLD - 0.01);
    }

    const bucket = buckets.get(bestId) || buckets.get(PLACEHOLDER_TOPIC_ID)!;
    bucket.questions.push({ ...q, confidence: Math.min(1, Math.max(0, bestScore)) });
  }

  const topics = [...buckets.values()].filter(
    (b) => b.questions.length > 0 || b.id !== PLACEHOLDER_TOPIC_ID,
  ).filter((b) => b.questions.length > 0);

  return { topics, lowConfidenceAssignments };
}
