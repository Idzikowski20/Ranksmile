import type { KnowledgeGraph, VerifierIssue, VerifierResult } from './types';

export function verifyKnowledgeGraph(graph: Omit<KnowledgeGraph, 'verifier'> & { verifier?: VerifierResult }): VerifierResult {
  const issues: VerifierIssue[] = [];

  const ids = new Set<string>();
  for (const c of graph.claims) {
    if (ids.has(c.id)) {
      issues.push({ code: 'duplicate_claim_id', message: `Duplicate claim id ${c.id}` });
    }
    ids.add(c.id);
    if (!c.evidence.length) {
      issues.push({ code: 'claim_without_evidence', message: `Claim ${c.id} has no evidence` });
    }
    if (!Number.isFinite(c.consensus)) {
      issues.push({ code: 'consensus_nan', message: `Claim ${c.id} consensus is not finite` });
    }
  }

  for (const b of graph.topicBlocks) {
    if (!b.title.trim()) {
      issues.push({ code: 'empty_topic_block', message: `Topic block ${b.id} has empty title` });
    }
  }

  for (const e of graph.entities) {
    if (!e.term.trim()) {
      issues.push({ code: 'empty_entity', message: 'Entity vote missing term' });
    }
    if (!Number.isFinite(e.consensus)) {
      issues.push({ code: 'entity_consensus_nan', message: `Entity ${e.term} consensus invalid` });
    }
  }

  return { ok: issues.length === 0, issues };
}
