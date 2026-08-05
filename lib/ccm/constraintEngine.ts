import type { CanonicalContentModel } from './types/ccm';
import { buildGraphIndexes } from './buildIndexes';
import { graphQuery, type GraphQuery } from './graphQuery';
import { isEvidenceSpanNode, isFactNode, isIntentNode } from './types/graph';

export type ConstraintSeverity = 'error' | 'warning';

export type ConstraintViolation = {
  readonly constraintId: string;
  readonly nodeIds: readonly string[];
  readonly message: string;
  readonly severity: ConstraintSeverity;
};

export type GraphConstraint = {
  readonly id: string;
  readonly severity: ConstraintSeverity;
  readonly description: string;
  check(q: GraphQuery, model: CanonicalContentModel): readonly ConstraintViolation[];
};

const factHasAnchor: GraphConstraint = {
  id: 'fact_has_anchor',
  severity: 'error',
  description: 'Fact MUST have Entity (uses) OR non-empty subject',
  check(q) {
    const out: ConstraintViolation[] = [];
    for (const fact of q.findFacts()) {
      const hasEntity = q.neighbors(fact.id, 'uses', 'out').length > 0;
      const hasSubject = fact.subject.trim().length > 0;
      if (!hasEntity && !hasSubject) {
        out.push({
          constraintId: 'fact_has_anchor',
          nodeIds: [fact.id],
          message: `Fact ${fact.id} has no entity uses and empty subject`,
          severity: 'error',
        });
      }
    }
    return out;
  },
};

const factNotOrphan: GraphConstraint = {
  id: 'fact_not_orphan',
  severity: 'warning',
  description: 'Covered/partial Fact MUST have statedIn or supportedBy',
  check(q) {
    const out: ConstraintViolation[] = [];
    for (const fact of q.findFacts({ status: ['covered', 'partial'] })) {
      const hasSupport =
        q.neighbors(fact.id, 'supportedBy', 'out').length > 0 ||
        q.neighbors(fact.id, 'statedIn', 'out').length > 0;
      if (!hasSupport) {
        out.push({
          constraintId: 'fact_not_orphan',
          nodeIds: [fact.id],
          message: `Covered fact ${fact.id} lacks supportedBy/statedIn`,
          severity: 'warning',
        });
      }
    }
    return out;
  },
};

const evidenceHasFact: GraphConstraint = {
  id: 'evidence_has_fact',
  severity: 'error',
  description: 'EvidenceSpan MUST be target of supportedBy',
  check(q, model) {
    const out: ConstraintViolation[] = [];
    for (const n of model.knowledge.graph.nodes) {
      if (!isEvidenceSpanNode(n)) continue;
      const inbound = q.neighbors(n.id, 'supportedBy', 'in');
      if (inbound.length === 0) {
        out.push({
          constraintId: 'evidence_has_fact',
          nodeIds: [n.id],
          message: `Orphan evidence_span ${n.id}`,
          severity: 'error',
        });
      }
    }
    return out;
  },
};

const intentTreeAcyclic: GraphConstraint = {
  id: 'intent_tree_acyclic',
  severity: 'error',
  description: 'parentOf Intent edges form a DAG',
  check(q) {
    const out: ConstraintViolation[] = [];
    for (const intent of q.findIntents()) {
      const seen = new Set<string>();
      let cur: string | undefined = intent.id;
      while (cur) {
        if (seen.has(cur)) {
          out.push({
            constraintId: 'intent_tree_acyclic',
            nodeIds: [...seen, cur],
            message: `Cycle in intent parentOf at ${cur}`,
            severity: 'error',
          });
          break;
        }
        seen.add(cur);
        const parents = q.neighbors(cur, 'parentOf', 'in').filter(isIntentNode);
        cur = parents[0]?.id;
      }
    }
    return out;
  },
};

const noDanglingEdge: GraphConstraint = {
  id: 'no_dangling_edge',
  severity: 'error',
  description: 'Edge endpoints must exist',
  check(q, model) {
    const out: ConstraintViolation[] = [];
    for (const e of model.knowledge.graph.edges) {
      if (!q.node(e.from) || !q.node(e.to)) {
        out.push({
          constraintId: 'no_dangling_edge',
          nodeIds: [e.from, e.to].filter(Boolean),
          message: `Dangling edge ${e.id}`,
          severity: 'error',
        });
      }
    }
    return out;
  },
};

const questionHasIntent: GraphConstraint = {
  id: 'question_has_intent',
  severity: 'warning',
  description: 'Question MUST link to Intent',
  check(q) {
    const out: ConstraintViolation[] = [];
    for (const question of q.findQuestions()) {
      const linked =
        q.neighbors(question.id, 'answers', 'out').some(isIntentNode) ||
        q.neighbors(question.id, 'answeredBy', 'in').some(isIntentNode);
      if (!linked) {
        out.push({
          constraintId: 'question_has_intent',
          nodeIds: [question.id],
          message: `Question ${question.id} has no intent link`,
          severity: 'warning',
        });
      }
    }
    return out;
  },
};

export const DEFAULT_CONSTRAINTS: readonly GraphConstraint[] = [
  factHasAnchor,
  factNotOrphan,
  evidenceHasFact,
  intentTreeAcyclic,
  noDanglingEdge,
  questionHasIntent,
];

export type ConstraintReport = {
  readonly violations: readonly ConstraintViolation[];
  readonly errorCount: number;
  readonly warningCount: number;
};

/** Run graph constraints via GraphQuery only (no raw indexes). */
export function runConstraints(
  model: CanonicalContentModel,
  constraints: readonly GraphConstraint[] = DEFAULT_CONSTRAINTS,
): ConstraintReport {
  const q = graphQuery(model);
  const violations = constraints.flatMap((c) => c.check(q, model));
  return {
    violations,
    errorCount: violations.filter((v) => v.severity === 'error').length,
    warningCount: violations.filter((v) => v.severity === 'warning').length,
  };
}

/** Downgrade covered facts that fail fact_not_orphan to weak (strip policy). */
export function applyConstraintStrip(
  model: CanonicalContentModel,
  report: ConstraintReport,
): CanonicalContentModel {
  const orphanFacts = new Set(
    report.violations
      .filter((v) => v.constraintId === 'fact_not_orphan')
      .flatMap((v) => v.nodeIds),
  );
  if (orphanFacts.size === 0) return model;
  const nodes = model.knowledge.graph.nodes.map((n) => {
    if (!isFactNode(n) || !orphanFacts.has(n.id)) return n;
    return { ...n, status: 'weak' as const, confidence: Math.min(n.confidence, 0.4) };
  });
  return {
    ...model,
    knowledge: {
      graph: { nodes, edges: model.knowledge.graph.edges },
      indexes: buildGraphIndexes(nodes, model.knowledge.graph.edges),
    },
    compiler: {
      ...model.compiler,
      partial: report.errorCount > 0 ? true : model.compiler.partial,
      notes: [
        ...model.compiler.notes,
        `constraints_errors=${report.errorCount}`,
        `constraints_warnings=${report.warningCount}`,
      ],
    },
  };
}
