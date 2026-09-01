/**
 * Corpus Diff — v1→v2 structural/URL/term changes → planner signals (not planner logic).
 */
import { serpChangeRatio } from '../corpus/serpChange';

export type CorpusDiffInput = {
  prevUrls: string[];
  nextUrls: string[];
  prevTerms?: string[];
  nextTerms?: string[];
  prevVersion: number;
  nextVersion: number;
};

export type PlannerSignal = {
  kind: 'serp_churn' | 'term_churn' | 'new_competitors' | 'lost_competitors';
  severity: 'low' | 'medium' | 'high';
  detail: string;
  score: number;
};

export type CorpusDiffResult = {
  urlChangeRatio: number;
  termChangeRatio: number;
  addedUrls: string[];
  removedUrls: string[];
  signals: PlannerSignal[];
};

export function diffCorpora(input: CorpusDiffInput): CorpusDiffResult {
  const urlChangeRatio = serpChangeRatio(input.prevUrls, input.nextUrls);
  const prevSet = new Set(input.prevUrls.map((u) => u.replace(/\/$/, '')));
  const nextSet = new Set(input.nextUrls.map((u) => u.replace(/\/$/, '')));
  const addedUrls = [...nextSet].filter((u) => !prevSet.has(u));
  const removedUrls = [...prevSet].filter((u) => !nextSet.has(u));

  const prevT = new Set((input.prevTerms ?? []).map((t) => t.toLowerCase()));
  const nextT = new Set((input.nextTerms ?? []).map((t) => t.toLowerCase()));
  let shared = 0;
  for (const t of nextT) if (prevT.has(t)) shared += 1;
  const union = new Set([...prevT, ...nextT]).size || 1;
  const termChangeRatio = 1 - shared / union;

  const signals: PlannerSignal[] = [];
  if (urlChangeRatio >= 0.3) {
    signals.push({
      kind: 'serp_churn',
      severity: urlChangeRatio >= 0.5 ? 'high' : 'medium',
      detail: `SERP URLs changed ${(urlChangeRatio * 100).toFixed(0)}% (v${input.prevVersion}→v${input.nextVersion})`,
      score: Math.round(urlChangeRatio * 100),
    });
  }
  if (addedUrls.length) {
    signals.push({
      kind: 'new_competitors',
      severity: addedUrls.length >= 3 ? 'high' : 'medium',
      detail: `${addedUrls.length} new competitor URL(s)`,
      score: Math.min(100, addedUrls.length * 15),
    });
  }
  if (removedUrls.length) {
    signals.push({
      kind: 'lost_competitors',
      severity: 'low',
      detail: `${removedUrls.length} URL(s) left top results`,
      score: Math.min(80, removedUrls.length * 10),
    });
  }
  if (termChangeRatio >= 0.25) {
    signals.push({
      kind: 'term_churn',
      severity: termChangeRatio >= 0.4 ? 'high' : 'medium',
      detail: `Term set churn ${(termChangeRatio * 100).toFixed(0)}%`,
      score: Math.round(termChangeRatio * 100),
    });
  }

  return { urlChangeRatio, termChangeRatio, addedUrls, removedUrls, signals };
}
