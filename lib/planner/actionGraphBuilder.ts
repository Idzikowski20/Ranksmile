import { computeKnowledgeGraphHash } from '../ccm/deterministicHash';
import { graphQuery } from '../ccm/graphQuery';
import { asObjectId, asPredicateId, asSubjectId } from '../ccm/ids';
import type { ActionGraph, EditAction } from '../ccm/types/actionGraph';
import type { CanonicalContentModel } from '../ccm/types/ccm';
import { isEvidenceSpanNode, isFactNode, type FactNode } from '../ccm/types/graph';
import type { RecommendationOp } from '../ccm/types/recommendationDsl';

export type BuildActionGraphOpts = {
  /** REQUIRED ISO — caller supplies. */
  readonly builtAt: string;
};

function factsSupportingIntent(
  model: CanonicalContentModel,
  intentId: string,
): readonly FactNode[] {
  const q = graphQuery(model);
  return q.neighbors(intentId, 'supports', 'in').filter(isFactNode);
}

function hasEvidence(model: CanonicalContentModel, factId: string): boolean {
  return graphQuery(model).findFacts({ hasEvidence: true }).some((f) => f.id === factId);
}

/**
 * Build immutable ActionGraph from CCM (Recommendation DSL ops).
 * Heuristic seeds — not full Planner.
 */
export function buildActionGraph(
  model: CanonicalContentModel,
  opts: BuildActionGraphOpts,
): ActionGraph {
  const actions: EditAction[] = [];
  let priority = 0;
  const q = graphQuery(model);
  const intents = q.findIntents();
  const facts = q.findFacts();


  for (const fact of facts) {
    if (fact.status === 'weak' || !hasEvidence(model, fact.id)) {
      priority += 1;
      const dsl: RecommendationOp = {
        op: 'STRENGTHEN_EVIDENCE',
        factId: fact.id,
        sectionHint: fact.sectionId,
        expected: {
          expectedScoreDelta: 2,
          expectedConfidenceMin: 0.6,
          expectedReasoning: 'Fact lacks evidence span',
        },
      };
      actions.push({
        id: `act_strengthen_${fact.id}`,
        kind: 'strengthen_evidence',
        priority,
        dependsOn: [],
        targetFact: {
          subject: fact.subject,
          predicate: fact.predicate,
          object: fact.object,
          statement: fact.statement,
        },
        sectionHint: fact.sectionId,
        promptFragment: `Strengthen evidence for: ${fact.statement}`,
        expectedImpact: 2,
        evidenceRequired: true,
        rationalePath: [fact.id],
        dsl,
      });
    }
  }

  for (const intent of intents) {
    const supporting = factsSupportingIntent(model, intent.id);
    if (supporting.length > 0) continue;
    priority += 1;
    const dsl: RecommendationOp = {
      op: 'COVER_INTENT',
      intentId: intent.id,
      expected: {
        expectedScoreDelta: 5,
        expectedVisibilityDelta: 0.1,
        expectedReasoning: `Intent "${intent.label}" has no supporting facts`,
      },
    };
    actions.push({
      id: `act_cover_${intent.id}`,
      kind: 'cover_intent',
      priority,
      dependsOn: [],
      targetIntentId: intent.id,
      promptFragment: `Cover intent: ${intent.label}`,
      expectedImpact: 5,
      evidenceRequired: true,
      rationalePath: [intent.id],
      dsl,
    });

    // Seed ADD_FACT under uncovered primary intents
    if (intent.primary) {
      priority += 1;
      const addDsl: RecommendationOp = {
        op: 'ADD_FACT',
        targetIntentId: intent.id,
        fact: {
          subject: asSubjectId(intent.label),
          predicate: asPredicateId('defines'),
          object: asObjectId('core'),
          statement: `Key fact covering: ${intent.label}`,
        },
        expected: {
          expectedScoreDelta: 4,
          expectedReasoning: 'Seed fact for uncovered primary intent',
        },
      };
      actions.push({
        id: `act_addfact_${intent.id}`,
        kind: 'add_fact',
        priority,
        dependsOn: [`act_cover_${intent.id}`],
        targetIntentId: intent.id,
        targetFact: {
          subject: intent.label,
          predicate: 'defines',
          object: 'core',
          statement: `Key fact covering: ${intent.label}`,
        },
        promptFragment: `Add a core fact for intent: ${intent.label}`,
        expectedImpact: 4,
        evidenceRequired: true,
        rationalePath: [intent.id],
        dsl: addDsl,
      });
    }
  }

  // Structure: no FAQ / summary flags on model.structure
  if (!model.structure.hasFaq || !model.structure.hasSummary) {
    priority += 1;
    const kind = !model.structure.hasSummary ? 'summary' : 'faq';
    const dsl: RecommendationOp = {
      op: 'FIX_STRUCTURE',
      kind,
      expected: {
        expectedScoreDelta: 1,
        expectedReasoning: `Missing ${kind} structure`,
      },
    };
    actions.push({
      id: `act_fix_${kind}`,
      kind: 'fix_structure',
      priority,
      dependsOn: [],
      promptFragment: `Add article ${kind}`,
      expectedImpact: 1,
      evidenceRequired: false,
      rationalePath: [],
      dsl,
    });
  }

  const roots = actions.filter((a) => a.dependsOn.length === 0).map((a) => a.id);

  return {
    schemaVersion: 1,
    immutable: true,
    fromCcmVersion: model.version,
    contentHash: model.contentHash,
    fromKnowledgeGraphHash: computeKnowledgeGraphHash(model.knowledge.graph),
    builtAt: opts.builtAt,
    actions,
    roots,
  };
}

/** Soft check: evidence nodes are never orphans (debug helper). */
export function countEvidenceSpans(model: CanonicalContentModel): number {
  return model.knowledge.graph.nodes.filter(isEvidenceSpanNode).length;
}
