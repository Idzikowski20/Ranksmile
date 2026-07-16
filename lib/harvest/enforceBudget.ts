import type { TopicBucket } from './clusterQuestions';
import type { HarvestedQuestion } from './canonicalizeQuestion';

export const MIN_TOPICS = 6;
export const MAX_TOPICS = 12;
export const MIN_PER = 3;
export const MAX_PER = 6;

export type BudgetedTopic = {
  id: string;
  title: string;
  questions: Array<HarvestedQuestion & { confidence: number }>;
};

type Q = HarvestedQuestion & { confidence: number };

function sortQs(arr: Q[]): Q[] {
  return [...arr].sort((a, b) => b.questionScore - a.questionScore);
}

function topicScore(t: BudgetedTopic): number {
  return t.questions.reduce((s, q) => s + q.questionScore, 0);
}

/**
 * Soft floor/ceil. Never drop a question if the topic would fall below MIN_PER.
 * Cap per topic at MAX_PER; cap topics at MAX_TOPICS (keep highest topicScore).
 */
export function enforceBudget(topics: TopicBucket[]): {
  topics: BudgetedTopic[];
  budgetRemovedQuestions: number;
} {
  let removed = 0;

  let working: BudgetedTopic[] = topics.map((t) => ({
    id: t.id,
    title: t.title,
    questions: sortQs(t.questions),
  }));

  // Cap per-topic at MAX_PER (keep top by score) — never below MIN_PER exists here since MAX>MIN
  working = working.map((t) => {
    if (t.questions.length <= MAX_PER) return t;
    const kept = t.questions.slice(0, MAX_PER);
    removed += t.questions.length - kept.length;
    return { ...t, questions: kept };
  });

  // Cap topic count — keep best by total questionScore
  if (working.length > MAX_TOPICS) {
    const ranked = [...working].sort((a, b) => topicScore(b) - topicScore(a));
    const dropped = ranked.slice(MAX_TOPICS);
    removed += dropped.reduce((s, t) => s + t.questions.length, 0);
    working = ranked.slice(0, MAX_TOPICS);
  }

  // Global surplus trim: drop lowest questionScore only from topics with count > MIN_PER
  const softTotalCap = MAX_TOPICS * MAX_PER;
  let total = working.reduce((s, t) => s + t.questions.length, 0);
  while (total > softTotalCap) {
    let victimTopic = -1;
    let victimQi = -1;
    let worstScore = Infinity;
    for (let ti = 0; ti < working.length; ti += 1) {
      const t = working[ti]!;
      if (t.questions.length <= MIN_PER) continue;
      const last = t.questions[t.questions.length - 1]!;
      if (last.questionScore < worstScore) {
        worstScore = last.questionScore;
        victimTopic = ti;
        victimQi = t.questions.length - 1;
      }
    }
    if (victimTopic < 0) break;
    working[victimTopic]!.questions.splice(victimQi, 1);
    removed += 1;
    total -= 1;
  }

  return {
    topics: working.filter((t) => t.questions.length > 0),
    budgetRemovedQuestions: removed,
  };
}

/** Median question count across topics. */
export function medianQuestionCount(topics: Array<{ questions: unknown[] }>): number {
  if (!topics.length) return 0;
  const counts = topics.map((t) => t.questions.length).sort((a, b) => a - b);
  const mid = Math.floor(counts.length / 2);
  if (counts.length % 2 === 0) {
    return (counts[mid - 1]! + counts[mid]!) / 2;
  }
  return counts[mid]!;
}
