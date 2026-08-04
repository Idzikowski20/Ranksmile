/**
 * Bridge immutable KnowledgeGraph → planner TargetKnowledgeGraph (v2 shape).
 */
import type {
  ClaimImportance,
  GainClass,
  TargetClaim,
  TargetKnowledgeGraph,
  TargetQuestion,
} from '../contentPlanner/types';
import { KNOWLEDGE_CONSENSUS_MIN } from './constants';
import type { CanonicalClaim, KnowledgeGraph } from './types';

function gainFromConsensus(c: number): GainClass {
  if (c >= 0.6) return 'core';
  if (c >= 0.25) return 'expected';
  return 'opportunity';
}

function importanceFromClaim(c: CanonicalClaim): ClaimImportance {
  if (c.importance === 'low') return 'nice_to_have';
  return 'required';
}

function claimToTarget(c: CanonicalClaim): TargetClaim {
  return {
    id: c.id,
    statement: c.statement,
    topic: c.cluster || c.statement.split(/\s+/).slice(0, 3).join(' '),
    type: /%|\d/.test(c.statement) ? 'stat' : 'fact',
    importance: importanceFromClaim(c),
    gainClass: gainFromConsensus(c.consensus),
    priority: c.importance,
    sources: c.evidence.map((e) => ({
      url: e.url,
      label: e.title || e.domain,
      confidence: e.weight,
    })),
    citationHint: c.evidence[0]?.url,
  };
}

export function knowledgeGraphToTargetKg(
  graph: KnowledgeGraph,
  paaQuestions: string[] = [],
): TargetKnowledgeGraph {
  const claims = graph.claims
    .filter(
      (c) =>
        c.consensus >= KNOWLEDGE_CONSENSUS_MIN
        || c.evidence.some((e) => e.kind === 'official'),
    )
    .map(claimToTarget);

  const qSet = new Map<string, string>();
  for (const q of paaQuestions) {
    const k = q.trim().toLowerCase();
    if (k) qSet.set(k, q.trim());
  }
  for (const g of graph.gaps) {
    if (g.kind !== 'opportunity_gap') continue;
    const k = g.topic.trim().toLowerCase();
    if (k) qSet.set(k, g.topic.trim());
  }

  const questions: TargetQuestion[] = [];
  let qi = 0;
  for (const [, question] of qSet) {
    questions.push({
      id: `q-ke-${qi++}`,
      question,
      requiredAnswerBrief: `Odpowiedz konkretnie na: ${question}`,
      importance: 'required',
      priority: qi <= 8 ? 'critical' : 'high',
      answeredByClaimIds: [],
      status: 'missing',
    });
  }

  const entities = graph.entities.map((e) => e.term).filter(Boolean).slice(0, 80);
  return { claims, questions, entities };
}
