/**
 * OQ-8: keep "Info to cover" UI labels — swap data source to CCM when present.
 * Maps CCM via GraphQuery → same InfoFact / InfoTopicGroup shape as legacy coverage.
 */
import type { CanonicalContentModel } from '../ccm/types/ccm';
import { graphQuery } from '../ccm/graphQuery';
import { isFactNode } from '../ccm/types/graph';
import type { CoverageStatus } from '../ccm/types/status';
import type { InfoFact, InfoTopicGroup } from '../infoToCoverTopics';

function isCoveredStatus(status: CoverageStatus): boolean {
  return status === 'covered' || status === 'partial';
}

export type CcmInfoToCover = {
  readonly intent: InfoFact[];
  readonly topics: InfoTopicGroup[];
  readonly source: 'ccm';
};

/**
 * Build Info-to-cover accordion groups from CCM (facts + intents).
 * Topics = intents that have supporting facts; remainder → "Information to cover".
 */
export function buildInfoToCoverFromCcm(model: CanonicalContentModel): CcmInfoToCover {
  const q = graphQuery(model);
  const intents = q.findIntents();
  const facts = q.findFacts();
  const assigned = new Set<string>();

  const intent: InfoFact[] = intents.map((i) => ({
    id: i.id,
    text: i.label,
    covered: isCoveredStatus(i.status),
    sources: [],
  }));

  const topics: InfoTopicGroup[] = [];
  for (const intentNode of intents) {
    const supporting = q
      .neighbors(intentNode.id, 'supports', 'in')
      .filter(isFactNode);
    if (!supporting.length) continue;
    const groupFacts: InfoFact[] = supporting.map((f) => {
      assigned.add(f.id);
      return {
        id: f.id,
        text: f.statement,
        covered: isCoveredStatus(f.status),
        sources: [],
      };
    });
    topics.push({
      id: `ccm-topic-${intentNode.id}`,
      title: intentNode.label,
      facts: groupFacts,
    });
  }

  const rest = facts.filter((f) => !assigned.has(f.id));
  if (rest.length) {
    topics.push({
      id: 'ccm-topic-remaining',
      title: 'Information to cover',
      facts: rest.map((f) => ({
        id: f.id,
        text: f.statement,
        covered: isCoveredStatus(f.status),
        sources: [],
      })),
    });
  }

  if (!topics.length && facts.length) {
    topics.push({
      id: 'ccm-topic-all',
      title: 'Information to cover',
      facts: facts.map((f) => ({
        id: f.id,
        text: f.statement,
        covered: isCoveredStatus(f.status),
        sources: [],
      })),
    });
  }

  return { intent, topics, source: 'ccm' };
}

/** Prefer CCM when it has any facts or intents; else null (caller keeps legacy). */
export function preferCcmInfoToCover(
  model: CanonicalContentModel | null | undefined,
): CcmInfoToCover | null {
  if (!model) return null;
  const built = buildInfoToCoverFromCcm(model);
  if (!built.intent.length && !built.topics.some((t) => t.facts.length > 0)) {
    return null;
  }
  return built;
}
