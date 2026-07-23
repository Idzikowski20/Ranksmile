/**
 * Bridge OrganicKeyword → Q1 Observation primitives (no full Action engine in v1).
 */
import type { Observation } from '../primitives/types';
import type { OrganicDataset, OrganicKeyword } from './types';

function droppedFromTop10(keywords: OrganicKeyword[]): OrganicKeyword[] {
  return keywords.filter((k) => {
    if (k.previousPosition == null || k.position == null) return false;
    return k.previousPosition <= 10 && k.position > 10;
  });
}

function growingKeywords(keywords: OrganicKeyword[]): OrganicKeyword[] {
  return keywords.filter((k) => k.state === 'growing');
}

function decliningKeywords(keywords: OrganicKeyword[]): OrganicKeyword[] {
  return keywords.filter((k) => k.state === 'declining');
}

/** Aggregate organic facts into Observations for Recommendation Engine later. */
export function keywordsToObservations(
  dataset: OrganicDataset,
  opts?: { domainId?: number },
): Observation[] {
  const now = new Date().toISOString();
  const out: Observation[] = [];
  const dropped = droppedFromTop10(dataset.keywords);
  if (dropped.length > 0) {
    out.push({
      id: `organic-drop-top10-${dataset.domain}`,
      kind: 'visibility_drop',
      source: 'organic',
      observedAt: now,
      domainId: opts?.domainId,
      title: `${dropped.length} keywords dropped from Top 10 to 11–20+`,
      detail: dropped.slice(0, 8).map((k) => k.keyword).join(', '),
      severity: dropped.length >= 10 ? 'high' : 'medium',
      score: dropped.length,
      relatedTopicIds: ['uncategorized'],
      payload: { keywordIds: dropped.map((k) => k.id), count: dropped.length },
    });
  }

  const growing = growingKeywords(dataset.keywords);
  if (growing.length > 0) {
    out.push({
      id: `organic-growing-${dataset.domain}`,
      kind: 'rank_growing',
      source: 'organic',
      observedAt: now,
      domainId: opts?.domainId,
      title: `${growing.length} keywords growing`,
      detail: growing.slice(0, 8).map((k) => `${k.keyword} (${k.change30d})`).join(', '),
      severity: 'low',
      score: growing.length,
      payload: { keywordIds: growing.map((k) => k.id), state: 'growing' },
    });
  }

  const declining = decliningKeywords(dataset.keywords);
  if (declining.length > 0) {
    out.push({
      id: `organic-declining-${dataset.domain}`,
      kind: 'visibility_drop',
      source: 'organic',
      observedAt: now,
      domainId: opts?.domainId,
      title: `${declining.length} keywords declining`,
      detail: declining.slice(0, 8).map((k) => k.keyword).join(', '),
      severity: declining.length >= 15 ? 'high' : 'medium',
      score: declining.length,
      payload: { keywordIds: declining.map((k) => k.id), state: 'declining' },
    });
  }

  return out;
}
