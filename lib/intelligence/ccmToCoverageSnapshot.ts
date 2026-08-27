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
} from '../ai/aiCoverage';
import type { CanonicalContentModel } from '../ccm/types/ccm';
import { graphQuery } from '../ccm/graphQuery';
import type { CoverageStatus } from '../ccm/types/status';
import { normalizeFactKey } from '../ccm/builders/factEngine';
import { compactCoverageSnapshotItems, AI_COVERAGE_MAX } from '../curateCoverageItems';

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

  // Keys of items carried over from the previous snapshot's harvested rubric — the
  // questions AI engines actually answer for the keyword. They are the grading standard,
  // so the cap below must never trade them for CCM's own facts.
  const rubricKeys = new Set<string>();
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
      rubricKeys.add(key);
      items.push(prev);
    }
  }

  // `true` from an earlier LLM grade survives; a stale `false` does not veto the
  // heuristic. The projection previously inherited `false` graded against an article
  // that no longer exists, and froze it across every regeneration.
  //
  // ponytail: ceiling = the asymmetry runs the other way too — once `true`, no rewrite
  // can take it back, so coverage stays inflated even after the article stops answering
  // the main question early. Upgrade = invalidate the carried grade when the article's
  // content hash changes and re-grade instead of inheriting.
  const answersMainQuestionEarly =
    opts.previous?.answersMainQuestionEarly === true ||
    intents.some((i) => i.primary && isCovered(i.status));

  // Cap CCM dump — UI checklist must stay near AI_COVERAGE_MAX (not 100+ facts).
  // The rubric carried over above is the grading standard, so it is held out of
  // compaction entirely: `compactCoverageSnapshotItems` applies its OWN cap and drops
  // by type/score, which is exactly how article 13 lost 8 of its 10 harvested questions
  // and self-graded 33/33 on its own facts. Rubric kept whole, CCM facts compacted into
  // whatever budget remains.
  //
  // ponytail: ceiling = when the rubric alone reaches AI_COVERAGE_MAX the CCM budget hits
  // zero and every CCM-native fact is evicted, and the snapshot can still exceed the max
  // because the rubric is never trimmed. Upgrade = dedupe/compact the rubric against the
  // query once it exceeds the max, rather than letting it consume the whole budget.
  const query = model.metadata.primaryQuery ?? model.metadata.title;
  const rubric = items.filter((i) => rubricKeys.has(normalizeFactKey(i.label)));
  const ccmOnly = items.filter((i) => !rubricKeys.has(normalizeFactKey(i.label)));
  const ccmBudget = Math.max(0, AI_COVERAGE_MAX - rubric.length);
  const compactedCcm = query ? compactCoverageSnapshotItems(ccmOnly, query) : ccmOnly;
  const capped = [...rubric, ...compactedCcm.slice(0, ccmBudget)];

  const { overall, buckets } = computeCoverageScores(capped, answersMainQuestionEarly);

  const topics = intents.reduce<CoverageTopicGroup[]>((groups, intentNode) => {
      const supporting = q.neighbors(intentNode.id, 'supports', 'in');
      const itemIds = supporting.map((n) => n.id).filter((id) => capped.some((it) => it.id === id));
      if (itemIds.length) groups.push({ title: intentNode.label, itemIds });
      return groups;
    }, []);

  return {
    schemaVersion: 1,
    judgeVersion: 'ccm-projection|v1|heuristic',
    promptVersion: 'ccm-v1',
    model: 'ccm',
    createdAt: opts.createdAt,
    items: capped,
    buckets,
    answersMainQuestionEarly,
    overall,
    ...(topics.length ? { topics } : {}),
  };
}
