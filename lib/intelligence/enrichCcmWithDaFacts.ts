/**
 * Fact Engine v2: merge DA / AI-visibility seeds into CCM graph (no LLM).
 */
import type { CanonicalContentModel } from '../ccm/types/ccm';
import { buildGraphIndexes } from '../ccm/buildIndexes';
import type {
  CitationNode,
  EvidenceSpanNode,
  FactNode,
  KgEdge,
  KgNode,
  QuestionNode,
} from '../ccm/types/graph';
import { isFactNode, isIntentNode } from '../ccm/types/graph';
import type { CoverageStatus } from '../ccm/types/status';
import { normalizeFactKey, parseSpoHeuristic } from '../ccm/builders/factEngine';
import type { DaFactSeed } from './loadDaFactSeeds';

function readinessToStatus(readiness: number): CoverageStatus {
  if (readiness >= 65) return 'covered';
  if (readiness >= 40) return 'partial';
  if (readiness >= 20) return 'weak';
  return 'missing';
}

function firstBlockId(model: CanonicalContentModel): string {
  return model.ast.blocks[0]?.blockId ?? 'b_da';
}

/**
 * Add Fact / Question / Citation / Evidence from DA seeds; dedupe vs existing facts.
 * Returns same model when nothing to add.
 */
export function enrichCcmWithDaFacts(
  model: CanonicalContentModel,
  seeds: readonly DaFactSeed[],
): CanonicalContentModel {
  if (!seeds.length) return model;

  const existingKeys = new Set(
    model.knowledge.graph.nodes.filter(isFactNode).map((f) => normalizeFactKey(f.statement)),
  );

  const nodes: KgNode[] = [...model.knowledge.graph.nodes];
  const edges: KgEdge[] = [...model.knowledge.graph.edges];
  let added = 0;

  const primaryIntent = model.knowledge.graph.nodes.find(
    (n) => isIntentNode(n) && n.primary,
  );
  const blockId = firstBlockId(model);

  for (const seed of seeds) {
    const key = normalizeFactKey(seed.statement);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);

    const status = readinessToStatus(seed.readiness);
    const spo = parseSpoHeuristic(seed.statement);
    const confidence = Math.min(1, 0.45 + seed.readiness / 200);

    const fact: FactNode = {
      id: seed.id,
      kind: 'fact',
      statement: seed.statement,
      subject: spo?.subject ?? '',
      predicate: spo?.predicate ?? 'states',
      object: spo?.object ?? '',
      entityIds: [],
      importance: seed.readiness >= 40 ? 'recommended' : 'optional',
      confidence,
      status,
      verification: 'asserted',
      sectionId: blockId,
    };
    nodes.push(fact);
    added += 1;

    if (seed.prompt.length >= 8 && /[?]/.test(seed.prompt)) {
      const qid = `daq_${seed.id}`;
      const question: QuestionNode = {
        id: qid,
        kind: 'question',
        question: seed.prompt,
        answeredByFactIds: status === 'covered' || status === 'partial' ? [fact.id] : [],
        answeredBySectionIds: [],
        importance: 'recommended',
        confidence: 0.7,
        status,
      };
      nodes.push(question);
      if (primaryIntent) {
        edges.push({
          id: `e_answers_${qid}_${primaryIntent.id}`,
          type: 'answers',
          from: qid,
          to: primaryIntent.id,
          confidence: 0.55,
        });
      }
    }

    if (seed.url || seed.domain) {
      const cid = `dac_${seed.id}`;
      const citation: CitationNode = {
        id: cid,
        kind: 'citation',
        label: seed.domain || seed.url || 'source',
        url: seed.url,
        importance: 'optional',
        confidence: 0.6,
        status: 'covered',
      };
      nodes.push(citation);
      edges.push({
        id: `e_ref_${fact.id}_${cid}`,
        type: 'references',
        from: fact.id,
        to: cid,
        confidence: 0.6,
      });
    }

    if (status === 'covered' || status === 'partial') {
      const snippet = seed.statement.slice(0, 160);
      const ev: EvidenceSpanNode = {
        id: `ev_${seed.id}`,
        kind: 'evidence_span',
        blockId,
        startOffset: 0,
        endOffset: Math.min(snippet.length, 80),
        snippet,
        evidenceKind: 'context',
        confidence: confidence,
        status: 'covered',
      };
      nodes.push(ev);
      edges.push({
        id: `e_supportedBy_${fact.id}_${ev.id}`,
        type: 'supportedBy',
        from: fact.id,
        to: ev.id,
        confidence: ev.confidence,
      });
    }

    if (primaryIntent && (status === 'covered' || status === 'partial')) {
      edges.push({
        id: `e_supports_${fact.id}_${primaryIntent.id}`,
        type: 'supports',
        from: fact.id,
        to: primaryIntent.id,
        confidence: 0.55,
      });
    }
  }

  if (!added) return model;

  const indexes = buildGraphIndexes(nodes, edges);
  return {
    ...model,
    knowledge: {
      graph: { nodes, edges },
      indexes,
    },
    compiler: {
      ...model.compiler,
      // ponytail: note-only; hash stays content-based from source compile
      notes: [...(model.compiler.notes ?? []), `da-facts:+${added}`],
    },
  };
}
