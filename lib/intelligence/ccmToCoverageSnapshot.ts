/**
 * OQ-8 SoT: project CCM → CoverageSnapshot for `articles.ai_info_to_cover`.
 * Keeps Info to cover UI shape; merges prior PAA/SERP/llmSources items.
 */
import {
  computeCoverageScores,
  type CoverageItem,
  type CoverageSnapshot,
  type CoverageTopicGroup,
  type CoverageType,
  type Importance,
} from '../aiCoverage';
import type { CanonicalContentModel } from '../ccm/types/ccm';
import { graphQuery } from '../ccm/graphQuery';
import type { CoverageStatus } from '../ccm/types/status';
import { normalizeFactKey } from '../ccm/builders/factEngine';

function statusToQuality(status: CoverageStatus): number {
  switch (status) {
    case 'covered':
      return 4;
    case 'partial':
      return 2;
    case 'weak':
      return 1;
    default:
      return 0;
  }
}

function isCovered(status: CoverageStatus): boolean {
  return status === 'covered' || status === 'partial';
}

function factType(statement: string): CoverageType {
  if (/\d|%|\b(?:19|20)\d{2}\b/.test(statement)) return 'statistic';
  return 'fact';
}

function toImportance(v: Importance | string): Importance {
  if (v === 'critical' || v === 'recommended' || v === 'optional') return v;
  return 'recommended';
}

/**
 * Build CoverageSnapshot from CCM graph (intents + facts).
 * Previous snapshot: keep paa/serp/llmSources extras; copy llmSources onto matching labels.
 */
export function projectCcmToCoverageSnapshot(
  model: CanonicalContentModel,
  opts: {
    readonly createdAt: string;
    readonly previous?: CoverageSnapshot | null;
  },
): CoverageSnapshot {
  const q = graphQuery(model);
  const intents = q.findIntents();
  const facts = q.findFacts();
  const items: CoverageItem[] = [];
  const labelIndex = new Map<string, number>();

  for (const intent of intents) {
    const item: CoverageItem = {
      id: intent.id,
      label: intent.label,
      type: 'intent',
      category: 'intent',
      importance: intent.primary ? 'critical' : 'recommended',
      source: 'manual',
      covered: isCovered(intent.status),
      quality: statusToQuality(intent.status),
      confidence: intent.confidence,
      reason: 'ccm',
    };
    labelIndex.set(normalizeFactKey(item.label), items.length);
    items.push(item);
  }

  for (const fact of facts) {
    const item: CoverageItem = {
      id: fact.id,
      label: fact.statement,
      type: factType(fact.statement),
      category: 'knowledge',
      importance: toImportance(fact.importance),
      source: 'manual',
      covered: isCovered(fact.status),
      quality: statusToQuality(fact.status),
      confidence: fact.confidence,
      sectionId: fact.sectionId,
      reason: 'ccm',
    };
    labelIndex.set(normalizeFactKey(item.label), items.length);
    items.push(item);
  }

  for (const prev of opts.previous?.items ?? []) {
    const key = normalizeFactKey(prev.label);
    const idx = labelIndex.get(key);
    if (idx != null) {
      const cur = items[idx];
      if (prev.llmSources?.length && !cur.llmSources?.length) {
        items[idx] = { ...cur, llmSources: prev.llmSources };
      }
      continue;
    }
    const keepExtra =
      (prev.llmSources?.length ?? 0) > 0 ||
      prev.source === 'paa' ||
      prev.source === 'serp' ||
      prev.source === 'competitors';
    if (keepExtra) {
      labelIndex.set(key, items.length);
      items.push(prev);
    }
  }

  const answersMainQuestionEarly =
    opts.previous?.answersMainQuestionEarly ??
    intents.some((i) => i.primary && isCovered(i.status));

  const { overall, buckets } = computeCoverageScores(items, answersMainQuestionEarly);

  const topics: CoverageTopicGroup[] = intents
    .map((intentNode) => {
      const supporting = q.neighbors(intentNode.id, 'supports', 'in');
      const itemIds = supporting.map((n) => n.id).filter((id) => items.some((it) => it.id === id));
      if (!itemIds.length) return null;
      return { title: intentNode.label, itemIds };
    })
    .filter((t): t is CoverageTopicGroup => t != null);

  return {
    schemaVersion: 1,
    judgeVersion: 'ccm-projection|v1|heuristic',
    promptVersion: 'ccm-v1',
    model: 'ccm',
    createdAt: opts.createdAt,
    items,
    buckets,
    answersMainQuestionEarly,
    overall,
    ...(topics.length ? { topics } : {}),
  };
}
